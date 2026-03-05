import axios from 'axios';

export class EmbeddingService {
    private baseUrl: string;
    private embeddingModel: string;

    constructor() {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.embeddingModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
    }

    /**
     * Generate an embedding vector for a given text string using Ollama.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!text || text.trim() === '') {
            throw new Error('Cannot generate embedding for empty text.');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
                model: this.embeddingModel,
                prompt: text,
            }, { timeout: 30000 });

            const embedding = response.data?.embedding;

            if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                throw new Error(`Received empty embedding from Ollama. Make sure '${this.embeddingModel}' is pulled.`);
            }

            return embedding;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
                console.error('[EmbeddingService] Ollama not reachable. Is it running?');
                throw new Error('Embedding service unavailable. Ollama is not running.');
            }
            console.error('[EmbeddingService] Failed to generate embedding:', error.message);
            throw error;
        }
    }
}

export const embeddingService = new EmbeddingService();
