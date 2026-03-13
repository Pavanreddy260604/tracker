import crypto from 'crypto';
import mongoose from 'mongoose';
import { IngestionManifest } from '../models/IngestionManifest';
import { MasterScript, IMasterScript } from '../models/MasterScript';
import { MasterScriptSourceLine } from '../models/MasterScriptSourceLine';
import { MasterScriptValidationReport } from '../models/MasterScriptValidationReport';
import { VoiceSample } from '../models/VoiceSample';
import {
    ParsedElement,
    ParsedScene,
    masterScriptParserService
} from './masterScriptParser.service';
import { masterScriptValidatorService } from './masterScriptValidator.service';
import { llamaindexService } from './llamaindex.service';
import { vectorService } from './vector.service';
import { geAuditService, GeAuditResult } from './geAudit.service';
import {
    extractStructuredTextFromRawContent
} from '../utils/fileParser';
import type {
    ExtractedMasterScriptSource,
    MasterScriptSourceFormat,
    MasterScriptSourceLayoutLine
} from '../types/masterScriptLayout';

type GateStatus = 'pending' | 'passed' | 'failed';

interface StartMasterScriptProcessingResult {
    scriptVersion: string;
    gateStatus: GateStatus;
}

interface CreateMasterScriptInput extends Partial<IMasterScript> {
    extractedSource?: ExtractedMasterScriptSource;
}

export class AdminService {
    private readonly scenePreviewChars = 3500;

    private createScriptVersion(): string {
        return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    async startMasterScriptProcessing(scriptId: string): Promise<StartMasterScriptProcessingResult> {
        const script = await MasterScript.findById(scriptId);
        if (!script) throw new Error('Master script not found');

        if (script.status === 'processing') {
            return {
                scriptVersion: script.processingScriptVersion || script.activeScriptVersion || this.createScriptVersion(),
                gateStatus: (script.gateStatus as GateStatus) || 'pending'
            };
        }

        const scriptVersion = script.processingScriptVersion || this.createScriptVersion();
        script.processingScriptVersion = scriptVersion;
        script.gateStatus = 'pending';
        script.status = 'processing';
        script.progress = script.readerReady ? 5 : 0;
        script.processedChunks = 0;
        script.ragReady = false;
        script.lastValidationSummary = `Ingestion started for ${scriptVersion}`;
        await script.save();

        void this.processMasterScript(scriptId, scriptVersion).catch((error: any) => {
            console.error(`[AdminService] Background ingestion failed for ${scriptId}:`, error);
        });

        return {
            scriptVersion,
            gateStatus: 'pending'
        };
    }

    /**
     * Ingests a master script into the structured parser/validator/audit pipeline.
     */
    async processMasterScript(scriptId: string, scriptVersion?: string): Promise<void> {
        const script = await MasterScript.findById(scriptId);
        if (!script) throw new Error('Master script not found');

        const processingVersion =
            scriptVersion ||
            script.processingScriptVersion ||
            script.activeScriptVersion ||
            this.createScriptVersion();
        const manifest = await this.prepareManifest(script._id, processingVersion);

        try {
            await this.resetVersionArtifacts(script._id, processingVersion, { preserveSourceLines: true });
            const extractedSource = await this.ensureSourceLayoutForVersion(script, processingVersion, manifest);

            script.status = 'processing';
            script.progress = 5;
            script.processedChunks = 0;
            script.processingScriptVersion = processingVersion;
            script.gateStatus = 'pending';
            script.readerReady = extractedSource.lines.length > 0;
            script.ragReady = false;
            this.applySourceMetadata(script, extractedSource);
            script.lastValidationSummary = `Parsing ${processingVersion}`;
            await script.save();

            const parsed = masterScriptParserService.parse(extractedSource, processingVersion);
            if (parsed.elements.length === 0) {
                throw new Error('Structured parser produced no chunks');
            }

            script.parserVersion = parsed.parserVersion;
            script.progress = 15;
            script.lastValidationSummary = `Parsed ${parsed.elements.length} structured chunks for ${processingVersion}`;
            await script.save();

            manifest.totalChunks = parsed.elements.length;
            manifest.titlePage = parsed.titlePage;
            manifest.readerReady = true;
            manifest.ragReady = false;
            await manifest.save();

            const sceneParentMap = await this.createSceneNodes(script, processingVersion, parsed.parserVersion, parsed.scenes);

            script.progress = 35;
            script.lastValidationSummary = `Indexed ${parsed.scenes.length} scene nodes for ${processingVersion}`;
            await script.save();

            await this.indexLeafElements({
                script,
                processingVersion,
                parserVersion: parsed.parserVersion,
                elements: parsed.elements,
                scenes: parsed.scenes,
                sceneParentMap,
                manifest
            });

            script.status = 'validating';
            script.progress = 90;
            script.lastValidationSummary = `Running validation and GE audit for ${processingVersion}`;
            await script.save();

            const validation = await masterScriptValidatorService.validateScriptVersion(scriptId, processingVersion);
            const auditResult = await this.runGeAudit(scriptId, processingVersion);
            const ragReady = validation.passed;
            const gatePassed = ragReady && auditResult.status === 'passed';

            script.processingScriptVersion = gatePassed ? undefined : processingVersion;
            script.gateStatus = gatePassed ? 'passed' : 'failed';
            script.status = gatePassed ? 'indexed' : 'failed';
            script.progress = 100;
            script.processedChunks = manifest.successfulChunks;
            script.parserVersion = parsed.parserVersion;
            script.readerReady = true;
            script.ragReady = ragReady;
            script.lastValidationSummary = `${validation.report.summary} GE audit: ${auditResult.summary}`;
            if (gatePassed) {
                script.activeScriptVersion = processingVersion;
            }
            await script.save();

            manifest.status = manifest.failedChunks > 0 || !ragReady ? 'partial_success' : 'completed';
            manifest.gateStatus = gatePassed ? 'passed' : 'failed';
            manifest.geAuditStatus = auditResult.status;
            manifest.readerReady = true;
            manifest.ragReady = ragReady;
            await manifest.save();

            if (!gatePassed) {
                console.warn(
                    `[AdminService] Version ${processingVersion} did not pass the gate. validation=${validation.passed} geAudit=${auditResult.status}`
                );
            }
        } catch (error: any) {
            script.processingScriptVersion = processingVersion;
            script.gateStatus = 'failed';
            script.status = 'failed';
            script.progress = script.readerReady ? 5 : 0;
            script.ragReady = false;
            script.lastValidationSummary = error?.message || 'Ingestion failed';
            await script.save();

            manifest.status = 'failed';
            manifest.gateStatus = 'failed';
            manifest.geAuditStatus = manifest.geAuditStatus || 'skipped';
            manifest.readerReady = script.readerReady || false;
            manifest.ragReady = false;
            manifest.errorLogs.push({ error: error?.message || 'Unknown error' });
            await manifest.save();

            console.error(`[AdminService] Final Error generating samples for ${script.title}:`, error);
            throw error;
        }
    }

    async getAllMasterScripts() {
        return MasterScript.find().sort({ createdAt: -1 });
    }

    async createMasterScript(data: CreateMasterScriptInput) {
        const { extractedSource: providedSource, ...scriptData } = data;
        const extractedSource = providedSource || this.buildSourceFromScriptInput(scriptData.rawContent, scriptData.sourceFormat);
        const scriptVersion = this.createScriptVersion();
        const script = new MasterScript({
            ...scriptData,
            rawContent: extractedSource.rawContent,
            processingScriptVersion: scriptVersion,
            readerReady: extractedSource.lines.length > 0,
            ragReady: false,
            gateStatus: 'pending',
            progress: extractedSource.lines.length > 0 ? 5 : 0,
            processedChunks: 0,
            lastValidationSummary: `Layout extracted for ${scriptVersion}`
        });

        this.applySourceMetadata(script, extractedSource);
        await script.save();

        if (extractedSource.lines.length > 0) {
            await MasterScriptSourceLine.insertMany(
                extractedSource.lines.map(line => ({
                    masterScriptId: script._id,
                    scriptVersion,
                    lineNo: line.lineNo,
                    pageNo: line.pageNo,
                    pageLineNo: line.pageLineNo,
                    rawText: line.rawText,
                    isBlank: line.isBlank,
                    indentColumns: line.indentColumns,
                    lineHash: line.lineHash,
                    lineId: line.lineId,
                    sourceKind: line.sourceKind,
                    xStart: line.xStart,
                    yTop: line.yTop
                }))
            );
        }

        await IngestionManifest.findOneAndUpdate(
            {
                jobType: 'master_script',
                targetId: script._id,
                scriptVersion
            },
            {
                $set: {
                    status: 'pending',
                    sourceFormat: extractedSource.sourceFormat,
                    pageCount: extractedSource.pageCount,
                    layoutVersion: extractedSource.layoutVersion,
                    readerReady: extractedSource.lines.length > 0,
                    ragReady: false,
                    ingestWarnings: extractedSource.warnings,
                    gateStatus: 'pending',
                    geAuditStatus: undefined,
                    totalChunks: 0,
                    successfulChunks: 0,
                    failedChunks: 0,
                    titlePage: this.buildTitlePageSummary(extractedSource.lines),
                    errorLogs: []
                }
            },
            { upsert: true, new: true }
        );

        return script;
    }

    async getMasterScriptChunks(scriptId: string, scriptVersion?: string) {
        const filter: Record<string, unknown> = { masterScriptId: scriptId };
        filter.scriptVersion = scriptVersion || await this.resolveScriptVersion(scriptId);
        return VoiceSample.find(filter as any)
            .select([
                '_id',
                'content',
                'speaker',
                'chunkType',
                'chunkIndex',
                'sceneSeq',
                'elementSeq',
                'sourceStartLine',
                'sourceEndLine',
                'dualDialogue',
                'sceneNumber',
                'nonPrinting',
                'isHierarchicalNode',
                'chunkId'
            ].join(' '))
            .sort({
                isHierarchicalNode: 1,
                sceneSeq: 1,
                elementSeq: 1,
                chunkIndex: 1,
                createdAt: 1
            })
            .lean();
    }

    async getMasterScriptReconstructedScript(scriptId: string, scriptVersion?: string) {
        const resolvedScriptVersion = await this.resolveScriptVersion(scriptId, scriptVersion);
        const sourceLines = await MasterScriptSourceLine.find({
            masterScriptId: scriptId,
            scriptVersion: resolvedScriptVersion
        })
            .sort({ lineNo: 1 })
            .lean();

        if (sourceLines.length === 0) {
            throw new Error(`No source lines found for script version ${resolvedScriptVersion}`);
        }

        const parserMeta = await VoiceSample.findOne({
            masterScriptId: scriptId,
            scriptVersion: resolvedScriptVersion
        })
            .select('parserVersion')
            .lean();

        const manifest = await IngestionManifest.findOne({
            targetId: scriptId as any,
            scriptVersion: resolvedScriptVersion
        }).lean();

        return {
            scriptVersion: resolvedScriptVersion,
            parserVersion: parserMeta?.parserVersion,
            sourceFormat: manifest?.sourceFormat,
            pageCount: manifest?.pageCount || Math.max(1, ...sourceLines.map((line: any) => line.pageNo || 1)),
            layoutVersion: manifest?.layoutVersion,
            readerReady: manifest?.readerReady ?? true,
            ragReady: manifest?.ragReady ?? false,
            warnings: manifest?.ingestWarnings || [],
            lineCount: sourceLines.length,
            content: sourceLines.map((line: any) => line.rawText || '').join('\n'),
            lines: sourceLines.map((line: any) => ({
                lineNo: line.lineNo,
                pageNo: line.pageNo || 1,
                pageLineNo: line.pageLineNo || line.lineNo,
                rawText: line.rawText || '',
                isBlank: Boolean(line.isBlank),
                indentColumns: line.indentColumns || 0,
                lineHash: line.lineHash,
                lineId: line.lineId,
                sourceKind: line.sourceKind || 'body',
                xStart: line.xStart,
                yTop: line.yTop
            })),
            titlePage: manifest?.titlePage || {}
        };
    }

    async getMasterScriptValidationReport(scriptId: string, scriptVersion?: string) {
        const filter: Record<string, unknown> = { masterScriptId: scriptId };
        if (scriptVersion) filter.scriptVersion = scriptVersion;

        const query = MasterScriptValidationReport.findOne(filter as any);
        if (!scriptVersion) query.sort({ createdAt: -1 });
        return query.lean();
    }

    async runGeAudit(scriptId: string, scriptVersion?: string): Promise<GeAuditResult> {
        const script = await MasterScript.findById(scriptId).select('_id activeScriptVersion processingScriptVersion');
        if (!script) throw new Error('Master script not found');

        const resolvedScriptVersion =
            scriptVersion || script.activeScriptVersion || script.processingScriptVersion;
        if (!resolvedScriptVersion) {
            throw new Error('No script version available for GE audit');
        }

        const result = await geAuditService.runMasterScriptAudit(scriptId, resolvedScriptVersion);

        await MasterScriptValidationReport.findOneAndUpdate(
            { masterScriptId: script._id, scriptVersion: resolvedScriptVersion },
            {
                $set: { geAudit: result },
                $setOnInsert: {
                    status: result.status === 'passed' ? 'passed' : 'failed',
                    missingLines: [],
                    extraLines: [],
                    layoutMismatches: [],
                    classificationMismatches: [],
                    orderMismatches: [],
                    reconstructionMismatch: false,
                    hierarchyMismatches: [],
                    summary: 'Validation report placeholder created from GE audit'
                }
            },
            { upsert: true, new: true }
        );

        return result;
    }

    async deleteMasterScript(scriptId: string): Promise<void> {
        const script = await MasterScript.findById(scriptId);
        if (!script) throw new Error('Master script not found');

        console.log(`[AdminService] Deleting Master Script: ${script.title}`);

        try {
            await vectorService.deleteSamplesByMasterScriptId(scriptId);
        } catch (err) {
            console.error(`[AdminService] Error deleting vectors for script ${scriptId}:`, err);
        }

        await Promise.all([
            VoiceSample.deleteMany({ masterScriptId: scriptId }),
            MasterScriptSourceLine.deleteMany({ masterScriptId: scriptId }),
            MasterScriptValidationReport.deleteMany({ masterScriptId: scriptId }),
            IngestionManifest.deleteMany({ targetId: scriptId, jobType: 'master_script' })
        ]);

        await MasterScript.findByIdAndDelete(scriptId);

        console.log(`[AdminService] Successfully deleted script: ${script.title}`);
    }

    private async prepareManifest(scriptId: mongoose.Types.ObjectId, scriptVersion: string) {
        let manifest = await IngestionManifest.findOne({
            jobType: 'master_script',
            targetId: scriptId,
            scriptVersion
        });

        if (!manifest) {
            manifest = new IngestionManifest({
                jobType: 'master_script',
                targetId: scriptId,
                scriptVersion
            });
        }

        manifest.status = 'processing';
        manifest.gateStatus = 'pending';
        manifest.geAuditStatus = undefined;
        manifest.totalChunks = 0;
        manifest.successfulChunks = 0;
        manifest.failedChunks = 0;
        manifest.readerReady = manifest.readerReady || false;
        manifest.ragReady = false;
        manifest.errorLogs = [];
        await manifest.save();

        return manifest;
    }

    private async resolveScriptVersion(scriptId: string, scriptVersion?: string): Promise<string> {
        if (scriptVersion) return scriptVersion;

        const script = await MasterScript.findById(scriptId).select('activeScriptVersion processingScriptVersion');
        if (!script) {
            throw new Error('Master script not found');
        }

        const resolvedScriptVersion = script.processingScriptVersion || script.activeScriptVersion;
        if (!resolvedScriptVersion) {
            throw new Error('No script version available');
        }

        return resolvedScriptVersion;
    }

    private async resetVersionArtifacts(
        scriptId: mongoose.Types.ObjectId,
        scriptVersion: string,
        options: { preserveSourceLines?: boolean } = {}
    ): Promise<void> {
        try {
            await vectorService.deleteSamplesByMasterScriptVersion(scriptId.toString(), scriptVersion);
        } catch (error) {
            console.warn(
                `[AdminService] Failed to clear vector data for ${scriptId.toString()} @ ${scriptVersion}:`,
                error
            );
        }

        await Promise.all([
            VoiceSample.deleteMany({ masterScriptId: scriptId, scriptVersion }),
            ...(options.preserveSourceLines ? [] : [MasterScriptSourceLine.deleteMany({ masterScriptId: scriptId, scriptVersion })]),
            MasterScriptValidationReport.deleteMany({ masterScriptId: scriptId, scriptVersion })
        ]);
    }

    private buildSourceFromScriptInput(
        rawContent?: string,
        sourceFormat: MasterScriptSourceFormat = 'raw_text'
    ): ExtractedMasterScriptSource {
        if (!rawContent || rawContent.trim().length === 0) {
            throw new Error('Script content is required');
        }

        return extractStructuredTextFromRawContent(rawContent, sourceFormat);
    }

    private applySourceMetadata(
        target: {
            sourceFormat?: MasterScriptSourceFormat;
            pageCount?: number;
            layoutVersion?: string;
            ingestWarnings?: string[];
        },
        extractedSource: ExtractedMasterScriptSource
    ): void {
        target.sourceFormat = extractedSource.sourceFormat;
        target.pageCount = extractedSource.pageCount;
        target.layoutVersion = extractedSource.layoutVersion;
        target.ingestWarnings = extractedSource.warnings;
    }

    private buildTitlePageSummary(lines: MasterScriptSourceLayoutLine[]): Record<string, string | string[]> {
        const titleLines = lines
            .filter(line => line.sourceKind === 'title_page' && !line.isBlank)
            .map(line => line.rawText.trim())
            .filter(Boolean);

        if (titleLines.length === 0) {
            return {};
        }

        const titlePage: Record<string, string | string[]> = {
            'Title Page': titleLines
        };

        const keyValueLines = titleLines
            .map(line => line.match(/^([A-Za-z ]+):\s*(.+)$/))
            .filter((match): match is RegExpMatchArray => Boolean(match));

        for (const match of keyValueLines) {
            const key = match[1].trim();
            const value = match[2].trim();
            titlePage[key] = value;
        }

        if (!titlePage.Title && titleLines[0]) {
            titlePage.Title = titleLines[0];
        }

        return titlePage;
    }

    private async readSourceLines(
        masterScriptId: string | mongoose.Types.ObjectId,
        scriptVersion: string
    ): Promise<MasterScriptSourceLayoutLine[]> {
        const sourceLines = await MasterScriptSourceLine.find({
            masterScriptId,
            scriptVersion
        })
            .sort({ lineNo: 1 })
            .lean();

        return sourceLines.map((line: any) => ({
            lineNo: line.lineNo,
            pageNo: line.pageNo || 1,
            pageLineNo: line.pageLineNo || line.lineNo,
            rawText: line.rawText || '',
            isBlank: Boolean(line.isBlank),
            indentColumns: line.indentColumns || 0,
            lineHash: line.lineHash,
            lineId: line.lineId,
            sourceKind: line.sourceKind || 'body',
            xStart: line.xStart,
            yTop: line.yTop
        }));
    }

    private async ensureSourceLayoutForVersion(
        script: IMasterScript,
        scriptVersion: string,
        manifest: any
    ): Promise<ExtractedMasterScriptSource> {
        const existingLines = await this.readSourceLines(script._id, scriptVersion);
        if (existingLines.length > 0) {
            return {
                sourceFormat: (manifest.sourceFormat || script.sourceFormat || 'raw_text') as MasterScriptSourceFormat,
                layoutVersion: manifest.layoutVersion || script.layoutVersion || 'ms-layout-v1',
                rawContent: existingLines.map(line => line.rawText).join('\n'),
                pageCount: manifest.pageCount || script.pageCount || Math.max(1, ...existingLines.map(line => line.pageNo)),
                warnings: manifest.ingestWarnings || script.ingestWarnings || [],
                lines: existingLines
            };
        }

        const extractedSource = this.buildSourceFromScriptInput(
            script.rawContent,
            (script.sourceFormat || 'raw_text') as MasterScriptSourceFormat
        );

        if (extractedSource.lines.length > 0) {
            await MasterScriptSourceLine.insertMany(
                extractedSource.lines.map(line => ({
                    masterScriptId: script._id,
                    scriptVersion,
                    lineNo: line.lineNo,
                    pageNo: line.pageNo,
                    pageLineNo: line.pageLineNo,
                    rawText: line.rawText,
                    isBlank: line.isBlank,
                    indentColumns: line.indentColumns,
                    lineHash: line.lineHash,
                    lineId: line.lineId,
                    sourceKind: line.sourceKind,
                    xStart: line.xStart,
                    yTop: line.yTop
                }))
            );
        }

        script.rawContent = extractedSource.rawContent;
        this.applySourceMetadata(script, extractedSource);
        manifest.sourceFormat = extractedSource.sourceFormat;
        manifest.pageCount = extractedSource.pageCount;
        manifest.layoutVersion = extractedSource.layoutVersion;
        manifest.ingestWarnings = extractedSource.warnings;
        manifest.readerReady = extractedSource.lines.length > 0;
        manifest.titlePage = this.buildTitlePageSummary(extractedSource.lines);

        return extractedSource;
    }

    private async createSceneNodes(
        script: IMasterScript,
        scriptVersion: string,
        parserVersion: string,
        scenes: ParsedScene[]
    ): Promise<Map<number, mongoose.Types.ObjectId>> {
        const sceneParentMap = new Map<number, mongoose.Types.ObjectId>();

        for (const scene of scenes) {
            const sceneContent = this.buildSceneNodeText(scene);
            const sceneEmbedding = await llamaindexService.getEmbedding(sceneContent);
            const chunkId = `scene_${script._id.toString()}_${scriptVersion}_${scene.sceneSeq}`;
            const sourceLineIds = Array.from(new Set(scene.elements.flatMap(element => element.sourceLineIds)));

            const sceneNode = new VoiceSample({
                masterScriptId: script._id,
                content: sceneContent,
                contentHash: this.createStableHash(chunkId, scene.heading),
                chunkId,
                chunkType: 'scene',
                chunkIndex: scene.sceneSeq,
                sceneSeq: scene.sceneSeq,
                elementSeq: 0,
                elementType: 'scene',
                sourceStartLine: scene.sourceStartLine,
                sourceEndLine: scene.sourceEndLine,
                sourceLineIds,
                embedding: sceneEmbedding,
                isHierarchicalNode: true,
                scriptVersion,
                parserVersion,
                language: script.language,
                tags: [...script.tags, 'scene-node'],
                source: `${script.director}: ${script.title} (Scene ${scene.sceneSeq})`
            });

            await sceneNode.save();
            await vectorService.upsertSample({
                id: sceneNode._id.toString(),
                content: sceneContent,
                embedding: sceneEmbedding,
                metadata: {
                    masterScriptId: script._id.toString(),
                    chunkId,
                    chunkType: 'scene',
                    chunkIndex: scene.sceneSeq,
                    sceneSeq: scene.sceneSeq,
                    elementSeq: 0,
                    elementType: 'scene',
                    sourceStartLine: scene.sourceStartLine,
                    sourceEndLine: scene.sourceEndLine,
                    sourceLineIds,
                    scriptVersion,
                    parserVersion,
                    language: script.language,
                    isHierarchicalNode: true,
                    tags: [...script.tags, 'scene-node'],
                    source: `${script.director}: ${script.title} (Scene ${scene.sceneSeq})`
                }
            });

            sceneParentMap.set(scene.sceneSeq, sceneNode._id as mongoose.Types.ObjectId);
        }

        return sceneParentMap;
    }

    private async indexLeafElements(params: {
        script: IMasterScript;
        processingVersion: string;
        parserVersion: string;
        elements: ParsedElement[];
        scenes: ParsedScene[];
        sceneParentMap: Map<number, mongoose.Types.ObjectId>;
        manifest: any;
    }): Promise<void> {
        const { script, processingVersion, parserVersion, elements, scenes, sceneParentMap, manifest } = params;
        const sceneHeadingBySeq = new Map(scenes.map(scene => [scene.sceneSeq, scene.heading]));
        const batchSize = 25;

        for (let i = 0; i < elements.length; i += batchSize) {
            const batch = elements.slice(i, i + batchSize);

            await Promise.all(batch.map(async element => {
                try {
                    const storedContent = this.normalizeElementContent(element);
                    const chunkId = `chunk_${script._id.toString()}_${processingVersion}_${element.chunkIndex}`;
                    const parentNodeId = sceneParentMap.get(element.sceneSeq);
                    const source = `${script.director}: ${script.title}`;
                    const embeddingText = this.buildElementEmbeddingText(
                        element,
                        sceneHeadingBySeq.get(element.sceneSeq) || '[UNKNOWN SCENE]'
                    );
                    const embedding = await llamaindexService.getEmbedding(embeddingText);
                    const contentHash = this.createStableHash(
                        processingVersion,
                        String(element.sceneSeq),
                        String(element.elementSeq),
                        ...element.sourceLineIds,
                        storedContent
                    );

                    const sample = new VoiceSample({
                        masterScriptId: script._id,
                        content: storedContent,
                        contentHash,
                        speaker: element.speaker,
                        language: script.language,
                        chunkType: element.chunkType,
                        chunkIndex: element.chunkIndex,
                        sceneSeq: element.sceneSeq,
                        elementSeq: element.elementSeq,
                        elementType: element.elementType,
                        sourceStartLine: element.sourceStartLine,
                        sourceEndLine: element.sourceEndLine,
                        sourceLineIds: element.sourceLineIds,
                        dualDialogue: element.dualDialogue,
                        sceneNumber: element.sceneNumber,
                        nonPrinting: element.nonPrinting,
                        embedding,
                        tags: script.tags,
                        source,
                        chunkId,
                        scriptVersion: processingVersion,
                        parserVersion,
                        parentNodeId,
                        isHierarchicalNode: false
                    });
                    await sample.save();

                    await vectorService.upsertSample({
                        id: sample._id.toString(),
                        content: storedContent,
                        embedding,
                        metadata: {
                            masterScriptId: script._id.toString(),
                            contentHash,
                            speaker: element.speaker,
                            language: script.language,
                            chunkType: element.chunkType,
                            chunkIndex: element.chunkIndex,
                            tags: script.tags,
                            source,
                            scriptVersion: processingVersion,
                            chunkId,
                            parserVersion,
                            parentNodeId: parentNodeId?.toString(),
                            isHierarchicalNode: false,
                            sceneSeq: element.sceneSeq,
                            elementSeq: element.elementSeq,
                            elementType: element.elementType,
                            sourceStartLine: element.sourceStartLine,
                            sourceEndLine: element.sourceEndLine,
                            sourceLineIds: element.sourceLineIds,
                            dualDialogue: element.dualDialogue,
                            sceneNumber: element.sceneNumber,
                            nonPrinting: element.nonPrinting
                        }
                    });

                    manifest.successfulChunks += 1;
                } catch (error: any) {
                    manifest.failedChunks += 1;
                    manifest.errorLogs.push({
                        chunkIndex: element.chunkIndex,
                        speaker: element.speaker,
                        error: error?.message || 'Unknown error'
                    });
                    console.error(`[AdminService] Error processing chunk ${element.chunkIndex}:`, error);
                }
            }));

            const processed = Math.min(i + batch.length, elements.length);
            const totalDone = manifest.successfulChunks + manifest.failedChunks;
            script.processedChunks = manifest.successfulChunks;
            script.progress = 35 + Math.floor((processed / elements.length) * 50);
            script.lastValidationSummary = `Indexed ${totalDone}/${elements.length} structured chunks for ${processingVersion}`;
            await script.save();
            await manifest.save();
        }
    }

    private buildSceneNodeText(scene: ParsedScene): string {
        const previewLines = scene.elements
            .map(element => element.content.trim())
            .filter(Boolean)
            .slice(0, 24);

        const preview = previewLines.join('\n').slice(0, this.scenePreviewChars);
        return [`SCENE ${scene.sceneSeq}`, scene.heading, preview].filter(Boolean).join('\n').trim();
    }

    private buildElementEmbeddingText(element: ParsedElement, sceneHeading: string): string {
        const content = this.normalizeElementContent(element);
        return [
            `SCENE: ${sceneHeading}`,
            `ELEMENT_TYPE: ${element.elementType}`,
            `CHUNK_TYPE: ${element.chunkType}`,
            element.speaker ? `SPEAKER: ${element.speaker}` : '',
            `CONTENT: ${content}`
        ]
            .filter(Boolean)
            .join('\n');
    }

    private normalizeElementContent(element: ParsedElement): string {
        if (typeof element.content === 'string' && element.content.length > 0) {
            return element.content;
        }
        return '[BLANK_LINE]';
    }

    private createStableHash(...parts: string[]): string {
        return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
    }
}

export const adminService = new AdminService();
