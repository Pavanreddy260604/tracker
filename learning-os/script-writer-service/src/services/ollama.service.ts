
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class OllamaService {
    private baseUrl: string;
    private primaryModel: string;
    private fallbackModels: string[];

    constructor() {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.primaryModel = process.env.OLLAMA_MODEL || 'mistral';

        // Hardcoded fallbacks in case env var isn't set, optimized for creative writing
        this.fallbackModels = [
            'mistral',
            'llama3',
            'gemma:7b',
            'deepseek-r1'
        ];
    }

    /**
     * Stream a chat completion from Ollama.
     * Yields chunks of text as they arrive.
     */
    async *chatStream(
        messages: { role: string; content: string }[],
        systemPrompt?: string
    ): AsyncGenerator<string, void, unknown> {

        const modelsToTry = Array.from(new Set([this.primaryModel, ...this.fallbackModels]));

        for (const model of modelsToTry) {
            console.log(`[ScriptWriter] Attempting generation with model: ${model}`);

            try {
                const payload: any = {
                    model: model,
                    messages: messages,
                    stream: true,
                    options: {
                        temperature: 0.9, // Higher temp for creative writing
                        top_p: 0.95
                    }
                };

                if (systemPrompt) {
                    payload.messages = [{ role: 'system', content: systemPrompt }, ...messages];
                }

                const response = await axios.post(`${this.baseUrl}/api/chat`, payload, {
                    responseType: 'stream',
                    timeout: 120000 // 2 minutes timeout for long scripts
                });

                for await (const chunk of response.data) {
                    const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                yield json.message.content;
                            }
                            if (json.done) return;
                        } catch (parseError) {
                            // Ignore incomplete chunks
                        }
                    }
                }

                // If we finished successfully, return
                return;

            } catch (error: any) {
                console.warn(`[ScriptWriter] Model ${model} failed: ${error.message}`);
                // Continue to next model
            }
        }

        throw new Error('All AI models failed to generate script.');
    }

    /**
     * Generates a vector embedding for the given text.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Default embedding model for Ollama
        const embeddingModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

        try {
            const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
                model: embeddingModel,
                prompt: text
            });

            return response.data.embedding; // Returns number[]
        } catch (error: any) {
            console.error(`[Ollama] Embedding failed for model ${embeddingModel}:`, error.message);
            // Fallback attempt with primary generation model (some support embeddings)
            // But prefer to fail loud so user installs the embed model
            throw new Error(`Failed to generate embedding. Make sure '${embeddingModel}' is pulled in Ollama. Run: 'ollama pull nomic-embed-text'`);
        }
    }

    /**
     * Non-streaming completion helper (used by critic service).
     */
    async generateCompletion(prompt: string, options?: { temperature?: number; format?: 'json' | 'text' }) {
        const modelsToTry = Array.from(new Set([this.primaryModel, ...this.fallbackModels]));

        for (const model of modelsToTry) {
            try {
                const payload: any = {
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options?.temperature ?? 0.3
                    },
                    ...(options?.format ? { format: options.format } : {})
                };

                const response = await axios.post(`${this.baseUrl}/api/generate`, payload, {
                    timeout: 60000
                });
                return response.data.response as string;
            } catch (error: any) {
                console.warn(`[ScriptWriter] generateCompletion failed on ${model}: ${error.message}`);
            }
        }
        throw new Error('All models failed to generate a completion.');
    }
}

export const ollamaService = new OllamaService();
