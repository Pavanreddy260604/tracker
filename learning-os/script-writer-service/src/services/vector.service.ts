import { ChromaClient, Collection } from "chromadb";
import { VoiceSample, IVoiceSample } from "../models/VoiceSample";

/**
 * VectorService
 * -------------
 * Responsible ONLY for:
 * - Indexing embeddings into ChromaDB
 * - Vector similarity search
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
        this.client = new ChromaClient({
            path: "http://localhost:8000"
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
            bibleId: sample.bibleId.toString(),
            source: sample.source ?? "unknown",
            preview: sample.content.slice(0, 120)
        };

        if (sample.characterId) {
            metadata.characterId = sample.characterId.toString();
        }

        await this.collection.upsert({
            ids: [sample._id.toString()],
            embeddings: [sample.embedding],
            metadatas: [metadata],
            documents: [sample.content]
        });
    }

    /**
     * Finds semantically similar samples using vector search.
     */
    async findSimilarSamples(
        bibleId: string,
        queryEmbedding: number[],
        limit: number = 5,
        characterIds?: string[]
    ): Promise<IVoiceSample[]> {
        await this.init();
        if (!this.collection) return [];

        if (!queryEmbedding || queryEmbedding.length === 0) {
            throw new Error("Query embedding is missing or empty");
        }

        // Build simple where clause
        // ChromaDB 'where' object syntax for AND logic needs care.
        // Simple: { "propertyName": "value" }
        // AND: { "$and": [ { "p1": "v1" }, { "p2": "v2" } ] }
        // IN: { "prop": { "$in": ["v1", "v2"] } }

        const conditions: any[] = [];

        if (bibleId !== "ALL") {
            conditions.push({ bibleId: bibleId });
        }

        if (characterIds && characterIds.length > 0) {
            conditions.push({ characterId: { "$in": characterIds } });
        }

        let where: any = undefined;
        if (conditions.length === 1) {
            where = conditions[0];
        } else if (conditions.length > 1) {
            where = { "$and": conditions };
        }

        const results = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: limit,
            where
        });

        const ids = results.ids?.[0];
        if (!ids || ids.length === 0) return [];

        // Fetch authoritative documents from MongoDB
        const samples = await VoiceSample.find({
            _id: { $in: ids }
        });

        // Preserve Chroma relevance order
        const sampleMap = new Map(
            samples.map(s => [s._id.toString(), s])
        );

        return ids
            .map(id => sampleMap.get(id))
            .filter(Boolean) as IVoiceSample[];
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
}

/**
 * Singleton export
 */
export const vectorService = new VectorService();
