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

type GateStatus = 'pending' | 'passed' | 'failed';

interface StartMasterScriptProcessingResult {
    scriptVersion: string;
    gateStatus: GateStatus;
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

        const scriptVersion = this.createScriptVersion();
        script.processingScriptVersion = scriptVersion;
        script.gateStatus = 'pending';
        script.status = 'processing';
        script.progress = 0;
        script.processedChunks = 0;
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

        const processingVersion = scriptVersion || script.processingScriptVersion || this.createScriptVersion();
        const manifest = await this.prepareManifest(script._id, processingVersion);

        try {
            await this.resetVersionArtifacts(script._id, processingVersion);

            script.status = 'processing';
            script.progress = 5;
            script.processedChunks = 0;
            script.processingScriptVersion = processingVersion;
            script.gateStatus = 'pending';
            script.lastValidationSummary = `Parsing ${processingVersion}`;
            await script.save();

            const parsed = masterScriptParserService.parse(script.rawContent, processingVersion);
            if (parsed.elements.length === 0) {
                throw new Error('Structured parser produced no chunks');
            }

            script.parserVersion = parsed.parserVersion;
            script.progress = 15;
            script.lastValidationSummary = `Parsed ${parsed.elements.length} structured chunks for ${processingVersion}`;
            await script.save();

            await MasterScriptSourceLine.insertMany(
                parsed.sourceLines.map(line => ({
                    masterScriptId: script._id,
                    scriptVersion: processingVersion,
                    lineNo: line.lineNo,
                    rawText: line.rawText,
                    lineHash: line.lineHash,
                    lineId: line.lineId
                }))
            );

            manifest.totalChunks = parsed.elements.length;
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
            const gatePassed = validation.passed && auditResult.status === 'passed';

            script.processingScriptVersion = undefined;
            script.gateStatus = gatePassed ? 'passed' : 'failed';
            script.status = gatePassed ? 'indexed' : 'failed';
            script.progress = 100;
            script.processedChunks = manifest.successfulChunks;
            script.parserVersion = parsed.parserVersion;
            script.lastValidationSummary = `${validation.report.summary} GE audit: ${auditResult.summary}`;
            if (gatePassed) {
                script.activeScriptVersion = processingVersion;
            }
            await script.save();

            manifest.status = manifest.failedChunks > 0 || !validation.passed ? 'partial_success' : 'completed';
            manifest.gateStatus = gatePassed ? 'passed' : 'failed';
            manifest.geAuditStatus = auditResult.status;
            await manifest.save();

            if (!gatePassed) {
                console.warn(
                    `[AdminService] Version ${processingVersion} did not pass the gate. validation=${validation.passed} geAudit=${auditResult.status}`
                );
            }
        } catch (error: any) {
            script.processingScriptVersion = undefined;
            script.gateStatus = 'failed';
            script.status = 'failed';
            script.progress = 0;
            script.lastValidationSummary = error?.message || 'Ingestion failed';
            await script.save();

            manifest.status = 'failed';
            manifest.gateStatus = 'failed';
            manifest.geAuditStatus = manifest.geAuditStatus || 'skipped';
            manifest.errorLogs.push({ error: error?.message || 'Unknown error' });
            await manifest.save();

            console.error(`[AdminService] Final Error generating samples for ${script.title}:`, error);
            throw error;
        }
    }

    async getAllMasterScripts() {
        return MasterScript.find().sort({ createdAt: -1 });
    }

    async createMasterScript(data: Partial<IMasterScript>) {
        const script = new MasterScript(data);
        await script.save();
        return script;
    }

    async getMasterScriptChunks(scriptId: string, scriptVersion?: string) {
        const filter: Record<string, unknown> = { masterScriptId: scriptId };
        if (scriptVersion) filter.scriptVersion = scriptVersion;
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

        return {
            scriptVersion: resolvedScriptVersion,
            parserVersion: parserMeta?.parserVersion,
            lineCount: sourceLines.length,
            content: sourceLines.map(line => line.rawText || '').join('\n')
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

        const resolvedScriptVersion = script.activeScriptVersion || script.processingScriptVersion;
        if (!resolvedScriptVersion) {
            throw new Error('No script version available');
        }

        return resolvedScriptVersion;
    }

    private async resetVersionArtifacts(scriptId: mongoose.Types.ObjectId, scriptVersion: string): Promise<void> {
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
            MasterScriptSourceLine.deleteMany({ masterScriptId: scriptId, scriptVersion }),
            MasterScriptValidationReport.deleteMany({ masterScriptId: scriptId, scriptVersion })
        ]);
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
