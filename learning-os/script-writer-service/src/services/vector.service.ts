import { ChromaClient, Collection } from "chromadb";
import { VoiceSample, IVoiceSample } from "../models/VoiceSample";

/**
 * Scored sample with similarity metric.
 * Uses a plain object shape rather than extending Mongoose Document.
 */
export interface ScoredSample {
    _id: string;
    bibleId: string;
    characterId?: string;
    content: string;
    contentHash?: string;
    speaker?: string;
    era?: string;
    language?: string; // PH Multilingual
    tactic?: string;
    emotion?: string;
    masterScriptId?: string; // PH 21
    chunkType?: 'dialogue' | 'action' | 'narration';
    chunkIndex?: number;
    embedding?: number[];
    tags?: string[];
    source?: string;
    similarityScore: number;
}

export interface FindSimilarOptions {
    minSimilarity?: number;      // Minimum cosine similarity (0-1), default 0.5
    maxLength?: number;          // Max content length to include
    dedupe?: boolean;            // Deduplicate by content hash, default true
    era?: string;                // Filter by specific era/age context
    language?: string;           // Filter by specific language (PH Multilingual)
    interests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
}

/**
 * VectorService
 * -------------
 * Responsible ONLY for:
 * - Indexing embeddings into ChromaDB
 * - Vector similarity search with relevance scoring
 *
 * Embeddings are generated externally (Ollama).
 * MongoDB remains the source of truth.
 */
export class VectorService {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private initPromise: Promise<void> | null = null;

    private static readonly COLLECTION_NAME = "voice_samples";

    constructor() {
        // ChromaDB v3.x uses 'path' for HTTP server connection
        // Use environment variable with fallback for flexibility
        const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
        this.client = new ChromaClient({
            path: chromaUrl
        });
    }

    /**
     * Ensures ChromaDB collection is initialized exactly once.
     */
    private async init(): Promise<void> {
        if (this.collection) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const embeddingFunction = {
                generate: async () => {
                    throw new Error(
                        "Embedding function should never be called. " +
                        "Embeddings must be generated externally."
                    );
                }
            };

            this.collection = await this.client.getOrCreateCollection({
                name: VectorService.COLLECTION_NAME,
                metadata: {
                    description: "Voice samples for Script Writer"
                },
                embeddingFunction
            } as any);

            console.log(
                `[VectorService] Connected to ChromaDB collection: ${VectorService.COLLECTION_NAME}`
            );
        })();

        return this.initPromise;
    }

    /**
     * Index or update a voice sample in ChromaDB.
     */
    async upsertSample(sample: IVoiceSample): Promise<void> {
        await this.init();
        if (!this.collection) {
            throw new Error("ChromaDB collection not initialized");
        }

        if (!sample.embedding || sample.embedding.length === 0) {
            throw new Error("Sample embedding is missing or empty");
        }

        const metadata: any = {
            bibleId: sample.bibleId ? sample.bibleId.toString() : "GLOBAL",
            source: sample.source ?? "unknown",
            preview: sample.content.slice(0, 120)
        };

        if (sample.characterId) {
            metadata.characterId = sample.characterId.toString();
        }

        if (sample.speaker) {
            metadata.speaker = sample.speaker;
        }

        if (sample.era) {
            metadata.era = sample.era;
        }

        if (sample.language) {
            metadata.language = sample.language;
        }

        if (sample.tactic) {
            metadata.tactic = sample.tactic;
        }

        if (sample.emotion) {
            metadata.emotion = sample.emotion;
        }

        if (sample.masterScriptId) {
            metadata.masterScriptId = sample.masterScriptId.toString();
        }

        if (sample.chunkType) {
            metadata.chunkType = sample.chunkType;
        }

        if (sample.contentHash) {
            metadata.contentHash = sample.contentHash;
        }

        try {
            await this.collection.upsert({
                ids: [sample._id.toString()],
                embeddings: [sample.embedding],
                metadatas: [metadata],
                documents: [sample.content]
            });
        } catch (error: any) {
            if (error.message && (error.message.includes("dimension") || error.message.includes("expecting embedding with dimension"))) {
                console.warn(`[VectorService] Dimension mismatch detected. Recreating collection '${VectorService.COLLECTION_NAME}'...`);

                try {
                    // Force deletion of local collection state
                    await (this.client as any).deleteCollection({ name: VectorService.COLLECTION_NAME });
                } catch (delErr) {
                    console.warn("[VectorService] Could not delete collection (might not exist):", delErr);
                }

                this.collection = null;
                this.initPromise = null;
                await this.init();

                // Retry once
                if (this.collection) {
                    await (this.collection as any).upsert({
                        ids: [sample._id.toString()],
                        embeddings: [sample.embedding],
                        metadatas: [metadata],
                        documents: [sample.content]
                    });
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Finds semantically similar samples using vector search.
     * Now includes relevance scoring and optional filtering.
     */
    async findSimilarSamples(
        bibleId: string,
        queryEmbedding: number[],
        limit: number = 5,
        characterIds?: string[],
        options?: FindSimilarOptions
    ): Promise<ScoredSample[]> {
        await this.init();
        if (!this.collection) return [];

        if (!queryEmbedding || queryEmbedding.length === 0) {
            throw new Error("Query embedding is missing or empty");
        }

        const minSimilarity = options?.minSimilarity ?? 0.5;
        const maxLength = options?.maxLength ?? 2000;
        const shouldDedupe = options?.dedupe ?? true;

        // Build filter conditions
        const conditions: any[] = [];

        if (bibleId !== "ALL") {
            conditions.push({ bibleId: bibleId });
        }

        if (characterIds && characterIds.length > 0) {
            conditions.push({ characterId: { "$in": characterIds } });
        }

        if (options?.era) {
            conditions.push({ era: options.era });
        }

        if (options?.language) {
            conditions.push({ language: options.language });
        }

        let where: any = undefined;
        if (conditions.length === 1) {
            where = conditions[0];
        } else if (conditions.length > 1) {
            where = { "$and": conditions };
        }

        // Fetch more results than needed for filtering
        const fetchLimit = Math.max(limit * 3, 15);

        // Cast to any to access full query result including distances
        const results: any = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: fetchLimit,
            where,
            include: ["distances", "metadatas", "documents"]
        } as any);

        const ids = results.ids?.[0];
        const distances = results.distances?.[0];
        const documents = results.documents?.[0];
        const metadatas = results.metadatas?.[0];

        if (!ids || ids.length === 0) return [];

        // Calculate similarity scores and filter
        // ChromaDB returns L2 distance by default, convert to similarity
        // For normalized embeddings: similarity ≈ 1 - (distance² / 2)
        const scoredIds: { id: string; score: number; doc: string; meta: any }[] = [];

        for (let i = 0; i < ids.length; i++) {
            const distance = distances?.[i] ?? 1;
            // Convert L2 distance to cosine similarity approximation
            // For normalized vectors, cosine_sim ≈ 1 - (L2² / 2)
            const similarity = Math.max(0, 1 - (distance * distance) / 2);

            // Apply similarity threshold
            if (similarity < minSimilarity) {
                continue;
            }

            // Apply length filter
            const doc = documents?.[i] ?? '';
            if (doc.length > maxLength) {
                continue;
            }

            const meta = metadatas?.[i] ?? {};
            let score = similarity;

            // PH 22: Boost score if it matches user interests
            if (options?.interests) {
                const source = (meta.source || '').toUpperCase();
                const tags = Array.isArray(meta.tags) ? meta.tags.map((t: string) => t.toUpperCase()) : [];

                // Boost for Director match
                if (options.interests.directors.some(d => source.includes(d.toUpperCase()))) {
                    score += 0.15;
                    console.log(`[VectorService] Interest Boost (+0.15) for director match in: ${source}`);
                }

                // Boost for Tag/Genre/Style match
                const allInterests = [...options.interests.genres, ...options.interests.styles].map(s => s.toUpperCase());
                if (tags.some((t: string) => allInterests.includes(t))) {
                    score += 0.10;
                    console.log(`[VectorService] Interest Boost (+0.10) for tag match in samples.`);
                }
            }

            scoredIds.push({
                id: ids[i],
                score: Math.min(1.0, score), // Cap at 1.0
                doc,
                meta
            });
        }

        // Re-sort by boosted score
        scoredIds.sort((a, b) => b.score - a.score);

        // Deduplicate by content hash if enabled
        if (shouldDedupe) {
            const seenHashes = new Set<string>();
            const dedupedIds = scoredIds.filter(item => {
                const hash = item.meta?.contentHash;
                if (!hash) return true; // Keep items without hash
                if (seenHashes.has(hash)) return false;
                seenHashes.add(hash);
                return true;
            });
            scoredIds.length = 0;
            scoredIds.push(...dedupedIds);
        }

        // Take top N after filtering
        const topIds = scoredIds
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        if (topIds.length === 0) return [];

        // Fetch authoritative documents from MongoDB
        const samples = await VoiceSample.find({
            _id: { $in: topIds.map(t => t.id) }
        });

        // Create map for merging scores
        const scoreMap = new Map(topIds.map(t => [t.id, t.score]));
        const sampleMap = new Map(
            samples.map(s => [s._id.toString(), s])
        );

        // Return scored samples in order
        return topIds
            .map(t => {
                const sample = sampleMap.get(t.id);
                if (!sample) return null;
                const obj = sample.toObject();
                return {
                    _id: obj._id.toString(),
                    bibleId: obj.bibleId.toString(),
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
                    similarityScore: t.score
                } as ScoredSample;
            })
            .filter(Boolean) as ScoredSample[];
    }

    /**
     * Optional: Remove a sample from the vector index.
     */
    async deleteSample(sampleId: string): Promise<void> {
        await this.init();
        if (!this.collection) return;

        await this.collection.delete({
            ids: [sampleId]
        });
    }

    /**
     * Get collection stats for debugging.
     */
    async getStats(): Promise<{ count: number }> {
        await this.init();
        if (!this.collection) return { count: 0 };

        // Use peek to get count since count() may not exist in all ChromaDB versions
        try {
            const peek = await (this.collection as any).count();
            return { count: typeof peek === 'number' ? peek : 0 };
        } catch {
            return { count: 0 };
        }
    }
}

/**
 * Singleton export
 */
export const vectorService = new VectorService();
