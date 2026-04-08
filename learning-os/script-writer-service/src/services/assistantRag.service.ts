import { MasterScript } from '../models/MasterScript';
import { Scene } from '../models/Scene';
import { aiServiceManager } from './ai.manager';
import { type FindSimilarOptions, type ScoredSample, vectorService } from './vector.service';

type AssistantMode = 'ask' | 'edit' | 'agent';
type AssistantTarget = 'scene' | 'selection';
type AssistantReferenceGroup =
    | 'project_continuity'
    | 'project_style'
    | 'master_feed'
    | 'recent_continuity';
type AssistantSourceFamily = 'project' | 'master' | 'recent' | 'continuity';

type AssistantUserInterests = {
    directors: string[];
    genres: string[];
    styles: string[];
};

type AssistantSelectionLike = {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
};

type AssistantHistoryEntry = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
};

type AssistantBibleContext = {
    _id?: { toString(): string } | string;
    title?: string;
    logline?: string;
    genre?: string;
    tone?: string;
    visualStyle?: string;
    language?: string;
    storySoFar?: string;
    globalOutline?: string[];
    rules?: string[];
    userId?: string;
};

type AssistantSceneContext = {
    _id?: { toString(): string } | string;
    sequenceNumber?: number;
    slugline?: string;
    summary?: string;
    goal?: string;
    content?: string;
    previousSceneSummary?: string;
    charactersInvolved?: Array<{ toString(): string } | string>;
    assistantChatHistory?: AssistantHistoryEntry[];
};

type EmbeddedQueryVariant = {
    key: 'intent' | 'content' | 'style' | 'expansion';
    text: string;
    embedding: number[];
};

type RankedCandidate = {
    sample: ScoredSample;
    matchedQueries: Set<string>;
    strictCharacterMatch?: boolean;
    languageMatched?: boolean;
    sourceType?: 'screenplay' | 'literature' | 'dictionary';
};

export type AssistantReference = {
    group: AssistantReferenceGroup;
    sourceFamily: AssistantSourceFamily;
    label: string;
    excerpt: string;
    parentContext?: string;
    elementType?: string;
    chunkType?: string;
    source?: string;
    sampleId?: string;
    masterScriptId?: string;
    sourceType?: string;
    score: number;
};

export type AssistantRetrievalMetadata = {
    mode: AssistantMode;
    target: AssistantTarget;
    queryVariants: Array<{ key: string; preview: string; length: number }>;
    candidateCounts: {
        project: number;
        master: number;
        recent: number;
        continuity: number;
    };
    sourceMix: {
        project: number;
        master: number;
        recent: number;
        continuity: number;
    };
    selectedReferences: Array<{
        group: AssistantReferenceGroup;
        sourceFamily: AssistantSourceFamily;
        label: string;
        score: number;
        sampleId?: string;
        masterScriptId?: string;
        chunkType?: string;
        elementType?: string;
        sourceType?: string;
    }>;
    languageFallbackUsed: boolean;
    eligibleMasterScriptCount: number;
    exactLanguageMasterCount: number;
};

export type AssistantReferencePack = {
    promptSections: string;
    retrievalMetadata: AssistantRetrievalMetadata;
};

type BuildAssistantReferencePackParams = {
    instruction: string;
    mode: AssistantMode;
    target: AssistantTarget;
    language: string;
    currentContent?: string;
    selection?: AssistantSelectionLike | null;
    bible?: AssistantBibleContext | null;
    scene?: AssistantSceneContext | null;
    userInterests?: AssistantUserInterests | null;
};

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'about',
    'have', 'will', 'would', 'should', 'could', 'them', 'they', 'their', 'there',
    'what', 'when', 'where', 'while', 'keep', 'make', 'more', 'less', 'than', 'then',
    'scene', 'script', 'line', 'lines', 'edit', 'agent', 'ask', 'write', 'rewrite'
]);

function toId(value?: { toString(): string } | string | null): string | undefined {
    if (!value) return undefined;
    return typeof value === 'string' ? value : value.toString();
}

function truncateText(value: string | undefined | null, maxLength: number): string {
    const text = (value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function lexicalOverlapScore(left: string, right: string): number {
    const leftTokens = new Set(tokenize(left));
    if (!leftTokens.size) return 0;
    const rightTokens = new Set(tokenize(right));
    if (!rightTokens.size) return 0;

    let matches = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) matches += 1;
    }

    return matches / Math.max(1, Math.min(leftTokens.size, 8));
}

function normalizeSectionText(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export class AssistantRagService {
    async buildAssistantReferencePack(params: BuildAssistantReferencePackParams): Promise<AssistantReferencePack> {
        const queryVariants = await this.buildQueryVariants(params);
        const embeddedQueries = await Promise.all(
            queryVariants.map(async (query) => ({
                ...query,
                embedding: await aiServiceManager.generateEmbedding(query.text)
            }))
        );

        const [projectCandidates, masterResult, recentContinuityRefs, projectContinuityRefs] = await Promise.all([
            this.retrieveProjectCandidates(embeddedQueries, params),
            this.retrieveMasterCandidates(embeddedQueries, params),
            this.buildRecentContinuityReferences(params),
            this.buildProjectContinuityReferences(params)
        ]);

        const preferredElementTypes = this.inferPreferredElementTypes(params);
        
        // Initial Project Style Candidates
        const projectStyleRefs = this.rankCandidates(projectCandidates, params, preferredElementTypes, 'project')
            .slice(0, this.getQuotas(params).projectStyle)
            .map((candidate) => this.toReference(candidate.sample, 'project_style', 'project', candidate.score));

        // Master Feed Mixed RAG logic
        const masterQuota = this.getQuotas(params).masterFeed;
        const linguisticQuota = Math.max(1, Math.floor(masterQuota * 0.4));
        const craftQuota = masterQuota - linguisticQuota;

        const rankedMasters = this.rankCandidates(masterResult.candidates, params, preferredElementTypes, 'master');

        const linguisticRefs = rankedMasters
            .filter(c => c.sourceType === 'literature' || c.sourceType === 'dictionary')
            .slice(0, linguisticQuota)
            .map(c => this.toReference(c.sample, 'master_feed', 'master', c.score, c.sourceType));

        const craftRefs = rankedMasters
            .filter(c => c.sourceType === 'screenplay')
            .slice(0, craftQuota + (linguisticQuota - linguisticRefs.length))
            .map(c => this.toReference(c.sample, 'master_feed', 'master', c.score, c.sourceType));

        const masterFeedRefs = [...linguisticRefs, ...craftRefs].sort((a, b) => b.score - a.score);

        const allSelectedReferences = [
            ...projectStyleRefs,
            ...masterFeedRefs
        ];

        // PH Phase 6: LLM Re-ranking (Top 20 candidates only)
        const toReRank = allSelectedReferences.slice(0, 20);
        if (toReRank.length > 3) {
            const reRankedResults = await this.reRankWithAI(toReRank, params);
            const reRankedMap = new Map(reRankedResults.map(r => [r.sampleId, r.score]));
            
            allSelectedReferences.forEach(ref => {
                if (ref.sampleId && reRankedMap.has(ref.sampleId)) {
                    // LLM judgment blend (70% LLM, 30% vector/rank score)
                    ref.score = (reRankedMap.get(ref.sampleId)! * 0.7) + (ref.score * 0.3);
                }
            });
            allSelectedReferences.sort((a, b) => b.score - a.score);
        }

        const selectedProjectContinuity = projectContinuityRefs.slice(0, this.getQuotas(params).projectContinuity);
        const selectedRecentContinuity = recentContinuityRefs.slice(0, this.getQuotas(params).recentContinuity);

        const sections = [
            this.formatSection('PROJECT CONTINUITY REFERENCES', selectedProjectContinuity),
            this.formatSection('PROJECT STYLE REFERENCES', projectStyleRefs),
            this.formatSection('MASTER FEED REFERENCES', masterFeedRefs),
            this.formatSection('RECENT SCENE CONTINUITY', selectedRecentContinuity)
        ].filter(Boolean);

        const finalReferences = [
            ...selectedProjectContinuity,
            ...allSelectedReferences, // Includes re-ranked style/master refs
            ...selectedRecentContinuity
        ];

        const retrievalMetadata: AssistantRetrievalMetadata = {
            mode: params.mode,
            target: params.target,
            queryVariants: embeddedQueries.map((query) => ({
                key: query.key,
                preview: truncateText(query.text, 180),
                length: query.text.length
            })),
            candidateCounts: {
                project: projectCandidates.length,
                master: masterResult.candidates.length,
                recent: recentContinuityRefs.length,
                continuity: projectContinuityRefs.length
            },
            sourceMix: {
                project: projectStyleRefs.length,
                master: masterFeedRefs.length,
                recent: selectedRecentContinuity.length,
                continuity: selectedProjectContinuity.length
            },
            selectedReferences: finalReferences.map((reference) => ({
                group: reference.group,
                sourceFamily: reference.sourceFamily,
                label: reference.label,
                score: Number(reference.score.toFixed(4)),
                sampleId: reference.sampleId,
                masterScriptId: reference.masterScriptId,
                chunkType: reference.chunkType,
                elementType: reference.elementType,
                sourceType: reference.sourceType
            })),
            languageFallbackUsed: masterResult.languageFallbackUsed,
            eligibleMasterScriptCount: masterResult.eligibleMasterScriptCount,
            exactLanguageMasterCount: masterResult.exactLanguageMasterCount
        };

        this.logRetrieval(params, retrievalMetadata);

        return {
            promptSections: sections.join('\n\n'),
            retrievalMetadata
        };
    }

    private async buildQueryVariants(params: BuildAssistantReferencePackParams): Promise<Array<{ key: 'intent' | 'content' | 'style' | 'expansion'; text: string }>> {
        const recentUserTurns = (params.scene?.assistantChatHistory || [])
            .filter((entry) => entry.role === 'user')
            .slice(-3)
            .map((entry) => truncateText(entry.content, 200))
            .filter(Boolean)
            .join('\n');

        const contentBlock = params.selection?.text?.trim()
            ? params.selection.text.slice(0, 1800)
            : (params.currentContent || params.scene?.content || '').slice(0, 2200);

        const styleBlock = [
            params.bible?.title ? `Project: ${params.bible.title}` : '',
            params.bible?.genre ? `Genre: ${params.bible.genre}` : '',
            params.bible?.tone ? `Tone: ${params.bible.tone}` : '',
            params.bible?.visualStyle ? `Visual Style: ${params.bible.visualStyle}` : '',
            params.bible?.language ? `Language: ${params.bible.language}` : '',
            params.bible?.storySoFar ? `Story So Far: ${truncateText(params.bible.storySoFar, 900)}` : '',
            params.bible?.globalOutline?.length
                ? `Global Outline: ${truncateText(params.bible.globalOutline.slice(0, 6).join(' | '), 900)}`
                : '',
            params.scene?.previousSceneSummary ? `Previous Scene: ${truncateText(params.scene.previousSceneSummary, 320)}` : '',
            recentUserTurns ? `Recent User Intent: ${recentUserTurns}` : ''
        ].filter(Boolean).join('\n');

        const variants: Array<{ key: 'intent' | 'content' | 'style' | 'expansion'; text: string }> = [
            {
                key: 'intent' as const,
                text: [
                    params.instruction,
                    params.scene?.slugline || '',
                    params.scene?.summary || '',
                    recentUserTurns
                ].filter(Boolean).join('\n\n')
            },
            {
                key: 'content' as const,
                text: contentBlock
            },
            {
                key: 'style' as const,
                text: styleBlock
            }
        ].filter((variant) => variant.text.trim());

        const seen = new Set<string>();
        const filteredVariants = variants.filter((variant) => {
            const normalized = normalizeSectionText(variant.text);
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });

        // AI-Powered Expansion (Phase 6)
        try {
            const aiExpansion = await this.expandQueryWithAI(params);
            if (aiExpansion) {
                filteredVariants.push({
                    key: 'expansion' as const,
                    text: aiExpansion
                });
            }
        } catch (err) {
            console.warn('[AssistantRAG] Query expansion failed:', err);
        }

        return filteredVariants;
    }

    private async expandQueryWithAI(params: BuildAssistantReferencePackParams): Promise<string | null> {
        const { RAG_QUERY_EXPANSION_PROMPT } = require('../prompts/hollywood');
        const prompt = RAG_QUERY_EXPANSION_PROMPT
            .replace('{{instruction}}', params.instruction)
            .replace('{{sceneContext}}', [params.scene?.slugline, params.scene?.summary, params.scene?.goal].filter(Boolean).join('\n'));

        try {
            const response = await aiServiceManager.chat(prompt, { 
                temperature: 0.3,
                model: process.env.GROQ_UTILITY_MODEL || 'llama-3.1-8b-instant'
            });
            return response.trim();
        } catch (err) {
            return null;
        }
    }

    private async reRankWithAI(candidates: AssistantReference[], params: BuildAssistantReferencePackParams): Promise<Array<{ sampleId: string, score: number }>> {
        const { RAG_RERANK_PROMPT } = require('../prompts/hollywood');
        
        const candidateList = candidates.map((c, i) => 
            `ID: [${c.sampleId || i}]\nCONTENT: ${c.excerpt}\nSOURCE: ${c.label}`
        ).join('\n\n---\n\n');

        const prompt = RAG_RERANK_PROMPT
            .replace('{{instruction}}', params.instruction)
            .replace('{{candidates}}', candidateList);

        try {
            const response = await aiServiceManager.chat(prompt, { 
                temperature: 0,
                format: 'json',
                model: process.env.GROQ_UTILITY_MODEL || 'llama-3.1-8b-instant'
            });

            const parsed = JSON.parse(response);
            if (Array.isArray(parsed.rankings)) {
                return parsed.rankings.map((r: any) => ({
                    sampleId: String(r.id),
                    score: Number(r.relevanceScore) / 100
                }));
            }
        } catch (err) {
            console.warn('[AssistantRAG] Re-ranking failed:', err);
        }
        return [];
    }

    private async retrieveProjectCandidates(
        embeddedQueries: EmbeddedQueryVariant[],
        params: BuildAssistantReferencePackParams
    ): Promise<RankedCandidate[]> {
        const bibleId = toId(params.bible?._id);
        if (!bibleId || embeddedQueries.length === 0) return [];

        const characterIds = (params.scene?.charactersInvolved || [])
            .map((value) => toId(value))
            .filter((value): value is string => !!value);

        const collected = new Map<string, RankedCandidate>();
        const baseOptions: FindSimilarOptions = {
            minSimilarity: 0.05,
            maxLength: 900,
            dedupe: true,
            language: params.language,
            includeParentContext: true,
            includeHierarchicalNodes: false
        };

        const strictPromises = characterIds.length > 0
            ? embeddedQueries.map((query) =>
                vectorService.findSimilarSamples(bibleId, query.embedding, 10, characterIds, baseOptions)
                    .then((samples) => ({ queryKey: query.key, samples, strictCharacterMatch: true }))
            )
            : [];

        const relaxedPromises = embeddedQueries.map((query) =>
            vectorService.findSimilarSamples(bibleId, query.embedding, 12, undefined, baseOptions)
                .then((samples) => ({ queryKey: query.key, samples, strictCharacterMatch: false }))
        );

        const results = await Promise.all([...strictPromises, ...relaxedPromises]);
        for (const result of results) {
            this.mergeCandidates(collected, result.samples, result.queryKey, result.strictCharacterMatch, true);
        }

        if (collected.size < 6 && params.language) {
            const fallbackResults = await Promise.all(
                embeddedQueries.map((query) =>
                    vectorService.findSimilarSamples(bibleId, query.embedding, 10, undefined, {
                        ...baseOptions,
                        language: undefined
                    }).then((samples) => ({ queryKey: query.key, samples }))
                )
            );

            for (const result of fallbackResults) {
                this.mergeCandidates(collected, result.samples, result.queryKey, false, false);
            }
        }

        return Array.from(collected.values());
    }

    private async retrieveMasterCandidates(
        embeddedQueries: EmbeddedQueryVariant[],
        params: BuildAssistantReferencePackParams
    ): Promise<{
        candidates: RankedCandidate[];
        languageFallbackUsed: boolean;
        eligibleMasterScriptCount: number;
        exactLanguageMasterCount: number;
    }> {
        if (embeddedQueries.length === 0) {
            return {
                candidates: [],
                languageFallbackUsed: false,
                eligibleMasterScriptCount: 0,
                exactLanguageMasterCount: 0
            };
        }

        const eligibleScripts = await MasterScript.find({
            status: 'indexed',
            ragReady: true,
            gateStatus: 'passed',
            activeScriptVersion: { $exists: true, $ne: null }
        })
            .select('_id title director tags language sourceType activeScriptVersion')
            .lean();

        // PH Mixed RAG: Two-Stream Retrieval
        const linguisticScripts = eligibleScripts.filter(s =>
            (s.language || 'English').toLowerCase().includes(params.language.toLowerCase()) &&
            (s.sourceType === 'literature' || s.sourceType === 'dictionary')
        );
        const linguisticIds = linguisticScripts.map(s => s._id.toString());

        const craftScriptsLocal = eligibleScripts.filter(s =>
            (s.language || 'English').toLowerCase().includes(params.language.toLowerCase()) &&
            (s.sourceType === 'screenplay' || !s.sourceType)
        );
        const craftIdsLocal = craftScriptsLocal.map(s => s._id.toString());

        const craftScriptsGlobal = eligibleScripts.filter(s =>
            (s.language || 'English') === 'English' &&
            (s.sourceType === 'screenplay' || !s.sourceType)
        );
        const craftIdsGlobal = craftScriptsGlobal.map(s => s._id.toString());

        const [linguisticCandidates, craftCandidatesLocal, craftCandidatesGlobal] = await Promise.all([
            this.queryMasterCandidates(embeddedQueries, linguisticIds, params.language, true, 'literature'),
            this.queryMasterCandidates(embeddedQueries, craftIdsLocal, params.language, true, 'screenplay'),
            this.queryMasterCandidates(embeddedQueries, craftIdsGlobal, undefined, false, 'screenplay')
        ]);

        let craftCandidates = this.mergeCandidateSets(craftCandidatesLocal, craftCandidatesGlobal);
        let languageFallbackUsed = craftCandidatesLocal.length === 0 && craftCandidatesGlobal.length > 0;
        let mergedCandidates = this.mergeCandidateSets(linguisticCandidates, craftCandidates);

        return {
            candidates: mergedCandidates,
            languageFallbackUsed,
            eligibleMasterScriptCount: eligibleScripts.length,
            exactLanguageMasterCount: eligibleScripts.filter(s =>
                (s.language || 'English').toLowerCase().includes(params.language.toLowerCase())
            ).length
        };
    }

    private async queryMasterCandidates(
        embeddedQueries: EmbeddedQueryVariant[],
        masterScriptIds: string[],
        language: string | undefined,
        languageMatched: boolean,
        sourceType?: 'screenplay' | 'literature' | 'dictionary'
    ): Promise<RankedCandidate[]> {
        if (masterScriptIds.length === 0) return [];

        const collected = new Map<string, RankedCandidate>();
        const results = await Promise.all(
            embeddedQueries.map((query) =>
                vectorService.findSimilarSamples('ALL', query.embedding, 16, undefined, {
                    minSimilarity: languageMatched ? 0.32 : 0.25,
                    maxLength: 980,
                    dedupe: true,
                    language: masterScriptIds.length > 0 ? undefined : (languageMatched ? language : 'English'),
                    scopeType: 'masterScriptId',
                    allowedScopeIds: masterScriptIds,
                    includeParentContext: true,
                    includeHierarchicalNodes: false
                }).then((samples) => ({ queryKey: query.key, samples }))
            )
        );

        for (const result of results) {
            this.mergeCandidates(collected, result.samples, result.queryKey, false, languageMatched, sourceType);
        }

        return Array.from(collected.values());
    }

    private mergeCandidates(
        target: Map<string, RankedCandidate>,
        samples: ScoredSample[],
        queryKey: string,
        strictCharacterMatch: boolean,
        languageMatched: boolean,
        sourceType?: 'screenplay' | 'literature' | 'dictionary'
    ) {
        for (const sample of samples) {
            const existing = target.get(sample._id);
            if (existing) {
                if (sample.similarityScore > existing.sample.similarityScore) {
                    existing.sample = sample;
                }
                existing.matchedQueries.add(queryKey);
                existing.strictCharacterMatch = existing.strictCharacterMatch || strictCharacterMatch;
                existing.languageMatched = existing.languageMatched || languageMatched;
                existing.sourceType = existing.sourceType || sourceType;
                continue;
            }

            target.set(sample._id, {
                sample,
                matchedQueries: new Set([queryKey]),
                strictCharacterMatch,
                languageMatched,
                sourceType
            });
        }
    }

    private mergeCandidateSets(primary: RankedCandidate[], secondary: RankedCandidate[]): RankedCandidate[] {
        const merged = new Map<string, RankedCandidate>();
        for (const candidate of [...primary, ...secondary]) {
            const existing = merged.get(candidate.sample._id);
            if (!existing) {
                merged.set(candidate.sample._id, candidate);
                continue;
            }

            if (candidate.sample.similarityScore > existing.sample.similarityScore) {
                existing.sample = candidate.sample;
            }
            candidate.matchedQueries.forEach((queryKey) => existing.matchedQueries.add(queryKey));
            existing.strictCharacterMatch = existing.strictCharacterMatch || candidate.strictCharacterMatch;
            existing.languageMatched = existing.languageMatched || candidate.languageMatched;
            existing.sourceType = existing.sourceType || candidate.sourceType;
        }

        return Array.from(merged.values());
    }

    private rankCandidates(
        candidates: RankedCandidate[],
        params: BuildAssistantReferencePackParams,
        preferredElementTypes: string[],
        sourceFamily: 'project' | 'master'
    ): Array<RankedCandidate & { score: number }> {
        const comparisonText = [
            params.instruction,
            params.selection?.text || '',
            params.currentContent || params.scene?.content || '',
            params.scene?.summary || '',
            params.scene?.slugline || ''
        ].filter(Boolean).join('\n');

        const styleText = [
            params.bible?.genre || '',
            params.bible?.tone || '',
            params.bible?.visualStyle || '',
            (params.bible?.rules || []).join(' '),
            (params.userInterests?.genres || []).join(' '),
            (params.userInterests?.styles || []).join(' ')
        ].join(' ');

        return candidates
            .map((candidate) => {
                const sample = candidate.sample;
                const elementType = (sample.elementType || sample.chunkType || 'other').toLowerCase();
                const lexicalBoost = lexicalOverlapScore(
                    comparisonText,
                    [sample.content, sample.parentContent, sample.source, (sample.tags || []).join(' ')].filter(Boolean).join('\n')
                ) * 0.18;
                const styleBoost = lexicalOverlapScore(
                    styleText,
                    [sample.source, (sample.tags || []).join(' '), sample.parentContent].filter(Boolean).join('\n')
                ) * 0.14;
                const preferredElementBoost = preferredElementTypes.includes(elementType) ? 0.14 : 0;
                const projectPriorityBoost = sourceFamily === 'project' ? 0.18 : 0.04;
                const matchedQueryBoost = Math.min(0.12, Math.max(0, candidate.matchedQueries.size - 1) * 0.05);
                const characterBoost = candidate.strictCharacterMatch ? 0.08 : 0;
                const languageBoost = candidate.languageMatched ? 0.06 : 0;

                const isNonEnglish = (params.language || 'English').toLowerCase() !== 'english';
                const linguisticBoost = (isNonEnglish && (candidate.sourceType === 'literature' || candidate.sourceType === 'dictionary')) ? 0.25 : 0;

                const continuityBoost = sourceFamily === 'project'
                    ? lexicalOverlapScore(
                        [
                            params.bible?.storySoFar || '',
                            params.scene?.previousSceneSummary || ''
                        ].join('\n'),
                        [sample.content, sample.parentContent].filter(Boolean).join('\n')
                    ) * 0.08
                    : 0;

                return {
                    ...candidate,
                    score: sample.similarityScore
                        + lexicalBoost
                        + styleBoost
                        + preferredElementBoost
                        + projectPriorityBoost
                        + matchedQueryBoost
                        + characterBoost
                        + languageBoost
                        + linguisticBoost
                        + continuityBoost
                };
            })
            .sort((left, right) => right.score - left.score);
    }

    private inferPreferredElementTypes(params: BuildAssistantReferencePackParams): string[] {
        const sourceText = [
            params.instruction,
            params.selection?.text || '',
            params.currentContent || ''
        ].join('\n').toLowerCase();

        const preferred = new Set<string>();
        if (/dialogue|subtext|voice|line|speak|say|conversation/.test(sourceText)) {
            preferred.add('dialogue');
            preferred.add('cue');
            preferred.add('parenthetical');
        }
        if (/action|visual|cinematic|blocking|pace|pacing|movement|beat/.test(sourceText)) {
            preferred.add('action');
            preferred.add('scene');
            preferred.add('slug');
        }
        if (!preferred.size) {
            if (params.mode === 'agent') {
                preferred.add('scene');
                preferred.add('action');
                preferred.add('dialogue');
            } else if (params.target === 'selection') {
                preferred.add('dialogue');
                preferred.add('action');
            } else {
                preferred.add('scene');
                preferred.add('dialogue');
            }
        }

        return Array.from(preferred);
    }

    private buildProjectContinuityReferences(params: BuildAssistantReferencePackParams): AssistantReference[] {
        const references: AssistantReference[] = [];

        if (params.bible?.storySoFar?.trim()) {
            references.push({
                group: 'project_continuity',
                sourceFamily: 'continuity',
                label: 'Story so far',
                excerpt: truncateText(params.bible.storySoFar, 500),
                score: 1.1
            });
        }

        const outlineWindow = this.buildOutlineWindow(params.bible?.globalOutline, params.scene?.sequenceNumber);
        if (outlineWindow) {
            references.push({
                group: 'project_continuity',
                sourceFamily: 'continuity',
                label: 'Global outline window',
                excerpt: truncateText(outlineWindow, 420),
                score: 0.96
            });
        }

        if (params.scene?.previousSceneSummary?.trim()) {
            references.push({
                group: 'project_continuity',
                sourceFamily: 'continuity',
                label: 'Previous scene state',
                excerpt: truncateText(params.scene.previousSceneSummary, 260),
                score: 0.92
            });
        }

        return references;
    }

    private buildOutlineWindow(globalOutline?: string[], sequenceNumber?: number): string {
        if (!globalOutline?.length) return '';

        if (!sequenceNumber) {
            return globalOutline.slice(0, 4).join(' | ');
        }

        const beatIndex = Math.max(0, Math.floor((sequenceNumber - 1) / 5));
        const start = Math.max(0, beatIndex - 1);
        const end = Math.min(globalOutline.length, beatIndex + 2);
        return globalOutline.slice(start, end).join(' | ');
    }

    private async buildRecentContinuityReferences(params: BuildAssistantReferencePackParams): Promise<AssistantReference[]> {
        const bibleId = toId(params.bible?._id);
        if (!bibleId) return [];

        const currentSceneId = toId(params.scene?._id);
        const currentSequence = params.scene?.sequenceNumber;
        const filter: Record<string, unknown> = { bibleId };

        if (currentSceneId) {
            filter._id = { $ne: currentSceneId };
        }
        if (currentSequence && currentSequence > 1) {
            filter.sequenceNumber = { $lt: currentSequence };
        }

        const recentScenes = await Scene.find(filter)
            .select('sequenceNumber slugline summary content updatedAt status')
            .sort(currentSequence ? { sequenceNumber: -1 } : { updatedAt: -1 })
            .limit(4)
            .lean();

        return recentScenes.map((scene, index) => ({
            group: 'recent_continuity',
            sourceFamily: 'recent',
            label: `Scene ${scene.sequenceNumber}: ${scene.slugline}`,
            excerpt: truncateText(scene.summary || scene.content, 260),
            score: Number((0.88 - index * 0.06).toFixed(4))
        }));
    }

    private getQuotas(params: BuildAssistantReferencePackParams) {
        if (params.mode === 'ask') {
            return {
                projectContinuity: 2,
                projectStyle: 3,
                masterFeed: 3,
                recentContinuity: 3
            };
        }

        if (params.target === 'selection') {
            return {
                projectContinuity: 1,
                projectStyle: 4,
                masterFeed: 3,
                recentContinuity: 2
            };
        }

        return {
            projectContinuity: 2,
            projectStyle: 3,
            masterFeed: 4,
            recentContinuity: 2
        };
    }

    private toReference(
        sample: ScoredSample,
        group: AssistantReferenceGroup,
        sourceFamily: AssistantSourceFamily,
        score: number,
        sourceType?: string
    ): AssistantReference {
        return {
            group,
            sourceFamily,
            label: truncateText(sample.source || 'Retrieved reference', 120),
            excerpt: truncateText(sample.content, 280),
            parentContext: truncateText(sample.parentContent, 220) || undefined,
            elementType: sample.elementType,
            chunkType: sample.chunkType,
            source: sample.source,
            sampleId: sample._id,
            masterScriptId: sample.masterScriptId,
            sourceType,
            score: Number(score.toFixed(4))
        };
    }

    private formatSection(title: string, references: AssistantReference[]): string {
        if (!references.length) return '';

        const body = references.map((reference, index) => {
            const context = reference.parentContext ? `\n[CONTEXT: ${reference.parentContext}]` : '';
            return `--- REFERENCE ${index + 1} (${reference.label}) ---\n${reference.excerpt}${context}`;
        }).join('\n\n');

        return `### ${title}\n\n${body}`;
    }

    private logRetrieval(params: BuildAssistantReferencePackParams, metadata: AssistantRetrievalMetadata) {
        console.info(`[AssistantRAG] Retrieval completed [${params.mode}/${params.target}]`);
        console.info(`- Variants: ${metadata.queryVariants.map(v => v.key).join(', ')}`);
        console.info(`- Mix: P:${metadata.sourceMix.project} M:${metadata.sourceMix.master} R:${metadata.sourceMix.recent} C:${metadata.sourceMix.continuity}`);
    }
}

export const assistantRagService = new AssistantRagService();
