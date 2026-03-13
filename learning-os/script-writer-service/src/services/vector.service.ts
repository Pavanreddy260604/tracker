import { ChromaVectorStore } from "@llamaindex/chroma";
import {
    VectorStoreIndex,
    MetadataFilters,
    MetadataFilter,
    FilterOperator,
    storageContextFromDefaults,
    VectorStoreQueryMode,
    TextNode
} from "llamaindex";
import { VoiceSample, IVoiceSample } from "../models/VoiceSample";
import { llamaindexService } from "./llamaindex.service";
import { VectorNodeDTO } from "../types/vector.types";

/**
 * Scored sample with similarity metric.
 */
export interface ScoredSample {
    _id: string;
    bibleId: string;
    characterId?: string;
    content: string;
    contentHash?: string;
    speaker?: string;
    era?: string;
    language?: string;
    tactic?: string;
    emotion?: string;
    masterScriptId?: string;
    chunkType?: 'dialogue' | 'action' | 'narration' | 'slug' | 'cue' | 'transition' | 'centered' | 'note' | 'section' | 'synopsis' | 'context' | 'scene' | 'parenthetical' | 'other';
    chunkIndex?: number;
    embedding?: number[];
    tags?: string[];
    source?: string;
    parentNodeId?: string; // PH 29: Parent node for recursive retrieval
    isHierarchicalNode?: boolean; // PH 29
    scriptVersion?: string;
    parserVersion?: string;
    chunkId?: string;
    sceneSeq?: number;
    elementSeq?: number;
    elementType?: string;
    sourceStartLine?: number;
    sourceEndLine?: number;
    sourceLineIds?: string[];
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
    ingestState?: string;
    parentContent?: string; // PH 29: Content of the parent node
    similarityScore: number;
}

export interface FindSimilarOptions {
    minSimilarity?: number;
    maxLength?: number;
    dedupe?: boolean;
    era?: string;
    language?: string;
    scopeType?: 'bibleId' | 'masterScriptId'; // PH 29: Specify which ID to filter by
    allowedScopeIds?: string[];
    interests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
    includeParentContext?: boolean; // PH 29: Fetch parent beat/scene context
    includeHierarchicalNodes?: boolean;
    scriptVersion?: string;
    ingestState?: 'staging' | 'active' | 'archived';
}

/**
 * VectorService (Mastery Edition)
 * ------------------------------
 * Uses LlamaIndex's native Chroma integration for production-grade retrieval.
 */
export class VectorService {
    private vectorStore: ChromaVectorStore | null = null;
    private static readonly COLLECTION_NAME = "voice_samples";

    constructor() { }

    /**
     * Ensures the LlamaIndex components are initialized with global settings.
     */
    private async ensureStore() {
        if (this.vectorStore) return;

        // Force llamaindexService initialization
        const _service = llamaindexService;

        this.vectorStore = new ChromaVectorStore({
            collectionName: VectorService.COLLECTION_NAME,
        });

        console.log(`[VectorService] ChromaVectorStore initialized for: ${VectorService.COLLECTION_NAME}`);
    }

    /**
     * Index or update a vector node in ChromaDB.
     */
    async upsertSample(node: VectorNodeDTO): Promise<void> {
        await this.ensureStore();
        if (!this.vectorStore) throw new Error("Vector store not initialized");

        if (!node.embedding || node.embedding.length === 0) {
            throw new Error("Sample embedding is missing or empty");
        }

        const metadata: any = {
            bibleId: node.metadata.bibleId || "GLOBAL",
            source: node.metadata.source ?? "unknown",
        };

        if (node.metadata.characterId) metadata.characterId = node.metadata.characterId;
        if (node.metadata.speaker) metadata.speaker = node.metadata.speaker;
        if (node.metadata.era) metadata.era = node.metadata.era;
        if (node.metadata.language) metadata.language = node.metadata.language;
        if (node.metadata.tactic) metadata.tactic = node.metadata.tactic;
        if (node.metadata.emotion) metadata.emotion = node.metadata.emotion;
        if (node.metadata.masterScriptId) metadata.masterScriptId = node.metadata.masterScriptId;
        if (node.metadata.chunkType) metadata.chunkType = node.metadata.chunkType;
        if (node.metadata.contentHash) metadata.contentHash = node.metadata.contentHash;
        if (node.metadata.parentNodeId) metadata.parentNodeId = node.metadata.parentNodeId;
        if (node.metadata.isHierarchicalNode !== undefined) metadata.isHierarchicalNode = node.metadata.isHierarchicalNode;
        if (node.metadata.tags && node.metadata.tags.length > 0) metadata.tags = node.metadata.tags.join(',');
        if (node.metadata.scriptVersion) metadata.scriptVersion = node.metadata.scriptVersion;
        if (node.metadata.parserVersion) metadata.parserVersion = node.metadata.parserVersion;
        if (node.metadata.chunkId) metadata.chunkId = node.metadata.chunkId;
        if (node.metadata.sceneSeq !== undefined) metadata.sceneSeq = node.metadata.sceneSeq;
        if (node.metadata.elementSeq !== undefined) metadata.elementSeq = node.metadata.elementSeq;
        if (node.metadata.elementType) metadata.elementType = node.metadata.elementType;
        if (node.metadata.sourceStartLine !== undefined) metadata.sourceStartLine = node.metadata.sourceStartLine;
        if (node.metadata.sourceEndLine !== undefined) metadata.sourceEndLine = node.metadata.sourceEndLine;
        if (node.metadata.dualDialogue !== undefined) metadata.dualDialogue = node.metadata.dualDialogue;
        if (node.metadata.sceneNumber) metadata.sceneNumber = node.metadata.sceneNumber;
        if (node.metadata.nonPrinting !== undefined) metadata.nonPrinting = node.metadata.nonPrinting;
        if (node.metadata.sourceLineIds && node.metadata.sourceLineIds.length > 0) {
            metadata.sourceLineIds = node.metadata.sourceLineIds.join(',');
        }
        if (node.metadata.ingestState) metadata.ingestState = node.metadata.ingestState;

        // PH 30: Mirror content in metadata for LlamaIndex query reconstruction
        metadata.text = node.content;

        // Use native Chroma upsert for deterministic idempotency across retries/parallel runs.
        const collection = await (this.vectorStore as any).getCollection();
        await collection.upsert({
            ids: [node.id],
            embeddings: [Array.from(node.embedding)],
            documents: [node.content],
            metadatas: [JSON.parse(JSON.stringify(metadata))]
        });
    }

    /**
     * Finds semantically similar samples using LlamaIndex VectorStoreIndex.
     */
    async findSimilarSamples(
        bibleId: string,
        queryEmbedding: number[],
        limit: number = 5,
        characterIds?: string[],
        options?: FindSimilarOptions
    ): Promise<ScoredSample[]> {
        await this.ensureStore();
        if (!this.vectorStore) return [];

        const normalizedCharacterIds = Array.from(new Set((characterIds || []).filter(Boolean)));
        const characterIdSet = normalizedCharacterIds.length > 0 ? new Set(normalizedCharacterIds) : null;

        // 1. Build Filters
        const filters: MetadataFilter[] = [];
        const filterKey = options?.scopeType || 'bibleId';
        if (bibleId !== "ALL") {
            filters.push({ key: filterKey, value: bibleId, operator: FilterOperator.EQ });
        }
        if (!options?.includeHierarchicalNodes) {
            filters.push({ key: "isHierarchicalNode", value: false as any, operator: FilterOperator.EQ });
        }
        if (options?.era) {
            filters.push({ key: "era", value: options.era, operator: FilterOperator.EQ });
        }
        if (options?.language) {
            filters.push({ key: "language", value: options.language, operator: FilterOperator.EQ });
        }
        if (options?.scriptVersion) {
            filters.push({ key: "scriptVersion", value: options.scriptVersion, operator: FilterOperator.EQ });
        }
        if (options?.ingestState) {
            filters.push({ key: "ingestState", value: options.ingestState, operator: FilterOperator.EQ });
        }

        // 2. Perform Native Query (PH 30 Hardening)
        // We bypass LlamaIndex's .query() because it crashes on legacy records missing the 'text' metadata key.
        const baseTopK = Math.max(20, limit * 3);
        const similarityTopK = characterIdSet ? Math.max(baseTopK * 4, limit * 10, 80) : baseTopK;

        console.log(`[VectorService] Querying Chroma NATIVELY with filters:`, JSON.stringify(filters), `K=${similarityTopK}`);

        const collection = await (this.vectorStore as any).getCollection();

        // Convert LlamaIndex filters to Chroma's 'where' format
        const chromaWhere: any = {};
        const whereClauses: any[] = [];

        if (options?.allowedScopeIds?.length) {
            whereClauses.push({ [filterKey]: { "$in": options.allowedScopeIds } });
        }

        for (const filter of filters) {
            whereClauses.push({ [filter.key]: { "$eq": filter.value } });
        }

        if (whereClauses.length > 0) {
            if (whereClauses.length === 1) {
                Object.assign(chromaWhere, whereClauses[0]);
            } else {
                chromaWhere["$and"] = whereClauses;
            }
        }

        const queryResult = await collection.query({
            queryEmbeddings: [queryEmbedding], // Chroma expects nested arrays for multi-query support
            nResults: similarityTopK,
            where: whereClauses.length > 0 ? chromaWhere : undefined,
            include: ["metadatas", "documents", "distances"]
        });

        // 3. Map Results
        const ids = queryResult.ids[0] || [];
        const metadatas = queryResult.metadatas?.[0] || [];
        const documents = queryResult.documents?.[0] || [];
        const distances = queryResult.distances?.[0] || [];

        if (ids.length === 0) return [];

        const scoredIds: { id: string; score: number; meta: any }[] = [];
        const minSimilarity = options?.minSimilarity ?? 0.5;

        for (let i = 0; i < ids.length; i++) {
            // Chroma L2 distance to Cosine Similarity approximation
            // L2^2 = 2 - 2*cos => cos = 1 - (L2^2 / 2)
            // (Assumes normalized vectors, which LlamaIndex/BGE-M3 provides)
            const l2Distance = distances[i] || 0;
            const similarity = 1 - (l2Distance / 2);

            if (similarity < minSimilarity) continue;

            const id = ids[i];
            const meta = metadatas[i] || {};
            const content = documents[i] || "";

            // Enrich meta with content if missing (for legacy record transparency)
            if (!meta.text && content) meta.text = content;

            const metaCharacterId = typeof meta.characterId === 'string'
                ? meta.characterId
                : meta.characterId?.toString?.();

            // Enforce character-scoped RAG when specific cast is selected.
            if (characterIdSet && (!metaCharacterId || !characterIdSet.has(metaCharacterId))) {
                continue;
            }

            let score = similarity;

            // Interest Boosting
            if (options?.interests) {
                const source = (meta.source || '').toUpperCase();
                if (options.interests.directors.some(d => source.includes(d.toUpperCase()))) {
                    score += 0.15;
                }
            }

            scoredIds.push({ id, score, meta });
        }

        // Sort and select top candidates
        scoredIds.sort((a, b) => b.score - a.score);
        const fetchCount = options?.dedupe || options?.maxLength
            ? Math.max(limit * 3, limit + 10)
            : limit;
        const topIds = scoredIds.slice(0, fetchCount);

        if (topIds.length === 0) return [];

        const mongoQuery: Record<string, unknown> = {
            _id: { $in: topIds.map(t => t.id) }
        };
        if (characterIdSet) {
            mongoQuery.characterId = { $in: Array.from(characterIdSet) };
        }

        // 4. Hydrate from MongoDB
        const samples = await VoiceSample.find(mongoQuery);
        const sampleMap = new Map(samples.map(s => [s._id.toString(), s]));

        const scoredSamples = topIds
            .map(t => {
                const sample = sampleMap.get(t.id);
                if (!sample) return null;
                const obj = sample.toObject();
                return {
                    _id: obj._id.toString(),
                    bibleId: obj.bibleId?.toString(),
                    characterId: obj.characterId?.toString(),
                    content: obj.content,
                    contentHash: obj.contentHash,
                    speaker: obj.speaker,
                    era: obj.era,
                    tactic: obj.tactic,
                    emotion: obj.emotion,
                    masterScriptId: obj.masterScriptId?.toString(),
                    chunkType: obj.chunkType,
                    chunkIndex: obj.chunkIndex,
                    tags: obj.tags,
                    source: obj.source,
                    parentNodeId: obj.parentNodeId?.toString(),
                    isHierarchicalNode: obj.isHierarchicalNode,
                    scriptVersion: obj.scriptVersion,
                    parserVersion: obj.parserVersion,
                    chunkId: obj.chunkId,
                    sceneSeq: (obj as any).sceneSeq,
                    elementSeq: (obj as any).elementSeq,
                    elementType: (obj as any).elementType,
                    sourceStartLine: (obj as any).sourceStartLine,
                    sourceEndLine: (obj as any).sourceEndLine,
                    sourceLineIds: (obj as any).sourceLineIds,
                    dualDialogue: (obj as any).dualDialogue,
                    sceneNumber: (obj as any).sceneNumber,
                    nonPrinting: (obj as any).nonPrinting,
                    ingestState: (obj as any).ingestState,
                    similarityScore: t.score
                } as ScoredSample;
            })
            .filter(Boolean) as ScoredSample[];

        // 5. Recursive Retrieval - Enrich with parent context if requested
        if (options?.includeParentContext) {
            const parentIds = scoredSamples
                .map((s: ScoredSample) => s.parentNodeId)
                .filter((id): id is string => !!id);

            if (parentIds.length > 0) {
                const uniqueParentIds = Array.from(new Set(parentIds));
                const parents = await VoiceSample.find({ _id: { $in: uniqueParentIds } });
                console.log(`[VectorService] Found ${parents.length} parents for ${uniqueParentIds.length} unique IDs`);

                const parentMap = new Map(parents.map(p => [p._id.toString(), p.content]));

                for (const sample of scoredSamples) {
                    if (sample.parentNodeId) {
                        sample.parentContent = parentMap.get(sample.parentNodeId);
                        if (!sample.parentContent) {
                            console.warn(`[VectorService] Parent Content not found for ID: ${sample.parentNodeId}`);
                        }
                    }
                }
            } else {
                console.log(`[VectorService] No parentNodeIds found in results`);
            }
        }

        let finalSamples = scoredSamples;

        if (options?.maxLength) {
            finalSamples = finalSamples.filter(s => s.content.length <= options.maxLength!);
        }

        if (options?.dedupe) {
            const seen = new Set<string>();
            finalSamples = finalSamples.filter(sample => {
                const fallbackKey = `${(sample.speaker || '').toLowerCase()}|${sample.content.trim().toLowerCase()}`;
                const key = sample.contentHash || fallbackKey;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return finalSamples.slice(0, limit);
    }

    async deleteSample(sampleId: string): Promise<void> {
        await this.ensureStore();
        if (this.vectorStore) {
            await this.vectorStore.delete(sampleId);
        }
    }

    /**
     * Remove a set of samples by explicit IDs.
     */
    async deleteSamplesByIds(sampleIds: string[]): Promise<void> {
        await this.ensureStore();
        if (!this.vectorStore || sampleIds.length === 0) return;

        const collection = await (this.vectorStore as any).getCollection();
        await collection.delete({ ids: sampleIds });
        console.log(`[VectorService] Deleted ${sampleIds.length} vectors by IDs`);
    }

    /**
     * Remove all vectors for a specific source within a bible (and optional character scope).
     */
    async deleteSamplesBySource(
        bibleId: string,
        source: string,
        characterId?: string
    ): Promise<void> {
        await this.ensureStore();
        if (!this.vectorStore) return;

        const where: Record<string, unknown> = {
            bibleId: { "$eq": bibleId },
            source: { "$eq": source }
        };
        if (characterId) {
            where.characterId = { "$eq": characterId };
        }

        const collection = await (this.vectorStore as any).getCollection();
        await collection.delete({ where });
        console.log(`[VectorService] Deleted vectors by source="${source}" in bible="${bibleId}"`);
    }

    /**
     * Remove all vectors associated with a specific project/bible.
     */
    async deleteSamplesByBibleId(bibleId: string): Promise<void> {
        await this.ensureStore();
        if (!this.vectorStore) return;

        const collection = await (this.vectorStore as any).getCollection();
        await collection.delete({
            where: { bibleId: { "$eq": bibleId } }
        });
        console.log(`[VectorService] Deleted vectors for bible: ${bibleId}`);
    }

    /**
     * Remove all samples associated with a specific master script.
     */
    async deleteSamplesByMasterScriptId(masterScriptId: string): Promise<void> {
        await this.ensureStore();
        if (this.vectorStore) {
            // CRITICAL: LlamaIndex's .delete() wrapper requires an ID.
            // We bypass it to use Chroma's native metadata-based deletion.
            const collection = await (this.vectorStore as any).getCollection();
            await collection.delete({
                where: { masterScriptId: { "$eq": masterScriptId } }
            });
            console.log(`[VectorService] Deleted vectors for master script: ${masterScriptId}`);
        }
    }

    /**
     * Remove vectors associated with one master script version.
     */
    async deleteSamplesByMasterScriptVersion(masterScriptId: string, scriptVersion: string): Promise<void> {
        await this.ensureStore();
        if (!this.vectorStore) return;

        const collection = await (this.vectorStore as any).getCollection();
        await collection.delete({
            where: {
                "$and": [
                    { masterScriptId: { "$eq": masterScriptId } },
                    { scriptVersion: { "$eq": scriptVersion } }
                ]
            }
        });
        console.log(
            `[VectorService] Deleted vectors for master script ${masterScriptId} version ${scriptVersion}`
        );
    }

    /**
     * PH 28: Semantic Deduplication.
     * Checks if a new embedding is almost identical to an existing one in the scope.
     * Returns true if similarity > threshold (default 0.98).
     */
    async isSemanticallyDuplicate(
        scopeId: string,
        embedding: number[],
        threshold: number = 0.98,
        scopeType: 'bibleId' | 'masterScriptId' = 'bibleId'
    ): Promise<boolean> {
        await this.ensureStore();
        if (!this.vectorStore) return false;

        const results = await this.findSimilarSamples(scopeId, embedding, 1, undefined, {
            minSimilarity: threshold,
            scopeType
        });

        return results.length > 0;
    }

    async getStats(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

export const vectorService = new VectorService();
