import { ChromaClient, Collection } from "chromadb";

export interface KnowledgeDocument {
    _id: string; // Original MongoDB document ID
    type: 'BackendTopic' | 'ProjectStudy' | 'DSAProblem' | 'InterviewSession';
    userId: string;
    title: string;
    content: string; // The full stringified text payload
    embedding: number[];
}

export interface ScoredKnowledge {
    id: string;
    score: number;
    type: string;
    title: string;
    content: string;
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
            preview: doc.content.slice(0, 150)
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
     * Find semantically similar documents, securely filtered by userId.
     */
    async findSimilar(userId: string, queryEmbedding: number[], limit: number = 5, itemType?: string): Promise<ScoredKnowledge[]> {
        await this.init();
        if (!this.collection) return [];

        const conditions: any[] = [{ userId }];
        if (itemType) {
            conditions.push({ type: itemType });
        }

        let where: any = undefined;
        if (conditions.length === 1) {
            where = conditions[0];
        } else if (conditions.length > 1) {
            where = { "$and": conditions };
        }

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
            const similarity = Math.max(0, 1 - (distance * distance) / 2);

            // Minimum 30% relevance threshold
            if (similarity < 0.3) continue;

            scoredDocs.push({
                id: ids[i],
                score: similarity,
                type: metadatas?.[i]?.type ?? 'unknown',
                title: metadatas?.[i]?.title ?? 'Untitled',
                content: documents?.[i] ?? ''
            });
        }

        return scoredDocs.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}

export const vectorService = new VectorService();
