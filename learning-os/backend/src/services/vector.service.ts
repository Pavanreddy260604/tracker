import { ChromaClient, Collection } from "chromadb";

export interface KnowledgeDocument {
    _id: string; // Original MongoDB document ID
    type: 'BackendTopic' | 'ProjectStudy' | 'DSAProblem' | 'InterviewSession' | 'ChatAttachment';
    userId: string;
    title: string;
    content: string; // The full stringified text payload
    embedding: number[];
    metadata?: Record<string, any>;
}

export interface ScoredKnowledge {
    id: string;
    score: number;
    type: string;
    title: string;
    content: string;
    metadata?: any;
}

export class VectorService {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private initPromise: Promise<void> | null = null;

    private static readonly COLLECTION_NAME = "learning_os_knowledge";

    constructor() {
        const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
        this.client = new ChromaClient({
            path: chromaUrl
        });
    }

    private async init(): Promise<void> {
        if (this.collection) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const embeddingFunction = {
                generate: async () => {
                    throw new Error("Embedding function should never be called directly inside Chroma. Pass embeddings explicitly.");
                }
            };

            this.collection = await this.client.getOrCreateCollection({
                name: VectorService.COLLECTION_NAME,
                metadata: {
                    description: "Universal Learning OS Vector Database"
                },
                embeddingFunction
            } as any);

            console.log(`[VectorService] Connected to ChromaDB collection: ${VectorService.COLLECTION_NAME}`);
        })();

        return this.initPromise;
    }

    /**
     * Index or update a universal knowledge document in ChromaDB.
     */
    async upsertDocument(doc: KnowledgeDocument): Promise<void> {
        await this.init();
        if (!this.collection) throw new Error("ChromaDB collection not initialized");

        if (!doc.embedding || doc.embedding.length === 0) {
            throw new Error("Document embedding is missing or empty");
        }

        const metadata: any = {
            type: doc.type,
            userId: doc.userId,
            title: doc.title,
            preview: doc.content.slice(0, 150),
            ...(doc.metadata || {})
        };

        await this.collection.upsert({
            ids: [doc._id.toString()],
            embeddings: [doc.embedding],
            metadatas: [metadata],
            documents: [doc.content]
        });
    }

    /**
     * Remove a document from the vector index.
     */
    async deleteDocument(id: string): Promise<void> {
        await this.init();
        if (!this.collection) return;

        await this.collection.delete({
            ids: [id]
        });
    }

    /**
     * Recursively flattens a MongoDB-style filter object into a series of 
     * single-key objects wrapped in $and / $or for ChromaDB compatibility.
     */
    private flattenFilter(filter: any): any {
        if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return filter;

        const keys = Object.keys(filter as any);
        if (keys.length <= 1 && !keys.some(k => k.startsWith('$'))) {
            // Already a potentially valid single-key object, or needs wrapping if it's a plain value
            const key = keys[0];
            const val = filter[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                return filter; // e.g. { age: { $gt: 10 } }
            }
            return { [key]: { "$eq": val } }; // auto-convert { userId: "abc" } to { userId: { "$eq": "abc" } }
        }

        const conditions: any[] = [];

        for (const [key, value] of Object.entries(filter)) {
            if (key === '$and') {
                if (Array.isArray(value)) {
                    conditions.push({ "$and": value.map(v => this.flattenFilter(v)) });
                }
            } else if (key === '$or') {
                if (Array.isArray(value)) {
                    conditions.push({ "$or": value.map(v => this.flattenFilter(v)) });
                }
            } else {
                // Plane key: value or key: { $op: val }
                const condition = value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).some(k => k.startsWith('$'))
                    ? { [key]: value }
                    : { [key]: { "$eq": value } };
                conditions.push(condition);
            }
        }

        if (conditions.length === 1) return conditions[0];
        return { "$and": conditions };
    }

    /**
     * Find semantically similar documents, securely filtered by userId and optional metadata.
     */
    async findSimilar(userId: string, queryEmbedding: number[], limit: number = 5, whereFilter?: any): Promise<ScoredKnowledge[]> {
        await this.init();
        if (!this.collection) return [];

        // Build the base 'where' clause with userId
        const baseFilter = { userId };
        
        let where: any;
        if (whereFilter) {
            // Combine userId with the provided filter
            where = this.flattenFilter({
                $and: [
                    baseFilter,
                    whereFilter
                ]
            });
        } else {
            where = this.flattenFilter(baseFilter);
        }

        console.log(`[VectorService] Querying ChromaDB with filter:`, JSON.stringify(where));

        const fetchLimit = limit * 2; // Fetch extra to account for exact distance filtering
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

        const scoredDocs: ScoredKnowledge[] = [];
        for (let i = 0; i < ids.length; i++) {
            const distance = distances?.[i] ?? 1;
            
            // ChromaDB distance mapping (handles both Cosine and L2)
            let similarity = distance < 2 
                ? 1 - distance 
                : Math.max(0, 1 - (distance / 1000));
            
            // Threshold: 20% relevance
            if (similarity < 0.2) continue;

            scoredDocs.push({
                id: ids[i],
                score: similarity,
                type: metadatas?.[i]?.type ?? 'unknown',
                title: metadatas?.[i]?.title ?? 'Untitled',
                content: documents?.[i] ?? '',
                metadata: metadatas?.[i]
            });
        }

        return scoredDocs.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}

export const vectorService = new VectorService();
