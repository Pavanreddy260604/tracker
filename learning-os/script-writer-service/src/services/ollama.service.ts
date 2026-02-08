
import axios from 'axios';
import dotenv from 'dotenv';
import { IAIService } from './ai.interface';

dotenv.config();

/**
 * Custom error class for AI service failures.
 */
export class AIServiceError extends Error {
    public readonly recoverable: boolean;
    public readonly cause?: Error;
    public readonly context?: string;

    constructor(message: string, options: { recoverable?: boolean; cause?: Error; context?: string } = {}) {
        super(message);
        this.name = 'AIServiceError';
        this.recoverable = options.recoverable ?? true;
        this.cause = options.cause;
        this.context = options.context;
    }
}

export class OllamaService implements IAIService {
    private baseUrl: string;
    private primaryModel: string;
    private fallbackModels: string[];
    private userId?: string;

    constructor(model?: string, userId?: string) {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        // User Preference: Deepseek is the Supreme Model for stability and reasoning
        this.primaryModel = model || process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';
        this.userId = userId;

        // Defined fallback chain prioritizing user preference: Deepseek -> Qwen -> GLM -> GPT -> Gemma
        this.fallbackModels = [
            'deepseek-r1:32b',          // 1. Deepseek (High Reasoning)
            'qwen3-coder:480b-cloud',   // 2. Qwen (Strong Coding/Logic)
            'glm-4.6:cloud',            // 3. GLM
            'gpt-oss:120b-cloud',       // 4. GPT (General Purpose)
            'gemma3:4b',                // 5. Gemma (Lightweight)

            // Smaller / Local Models (Last Resort)
            'tinyllama:latest',
            'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest'
        ];
    }

    private async wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async makeRequest(endpoint: string, payload: any, retries = 3, timeout = 60000): Promise<any> {
        // Create full list of models to try: Primary -> Fallbacks
        const modelsToTry = Array.from(new Set([this.primaryModel, ...this.fallbackModels]));

        for (const model of modelsToTry) {
            console.log(`[ScriptWriter] Attempting with model: ${model}`);

            // Retry loop for the CURRENT model
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const currentPayload = { ...payload, model };
                    return await axios.post(`${this.baseUrl}${endpoint}`, currentPayload, { timeout });
                } catch (error: any) {
                    if (axios.isAxiosError(error) && error.response) {
                        const status = error.response.status;

                        // Rate Limit / Service Unavailable
                        if ((status === 429 || status === 503) && attempt < retries) {
                            const delay = attempt * 2000;
                            console.warn(`[ScriptWriter] ${model} Busy (Status ${status}). Retrying in ${delay}ms...`);
                            await this.wait(delay);
                            continue;
                        }
                    }

                    // Model Not Found (404) -> Break to next model
                    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
                        console.warn(`[ScriptWriter] Model ${model} not found. Switching to next model...`);
                        break;
                    }

                    // Max retries reached
                    if (attempt === retries) {
                        console.warn(`[ScriptWriter] Model ${model} failed after ${retries} attempts.`);
                    }
                }
            }
        }

        throw new Error('All AI models failed to respond.');
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
            console.log(`[ScriptWriterStream] Attempting generation with model: ${model}`);

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

                console.log(`[ScriptWriterStream] Success with model: ${model}`);

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

                return; // Success

            } catch (error: any) {
                console.warn(`[ScriptWriterStream] Model ${model} failed: ${error.message}`);
                // Continue to next model
            }
        }

        throw new Error('All AI models failed to generate script.');
    }

    /**
     * Generates a vector embedding for the given text.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const embeddingModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

        try {
            const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
                model: embeddingModel,
                prompt: text
            });

            return response.data.embedding;
        } catch (error: any) {
            console.error(`[Ollama] Embedding failed for model ${embeddingModel}:`, error.message);
            throw new Error(`Failed to generate embedding. Make sure '${embeddingModel}' is pulled.`);
        }
    }

    /**
     * Non-streaming completion helper (used by critic service).
     */
    async generateCompletion(prompt: string, options?: { temperature?: number; format?: 'json' | 'text' }) {
        return this.chat(prompt, [], options?.format === 'json');
    }

    // Unified Chat Interface (matches matches IAIService)
    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        try {
            const response = await this.makeRequest('/api/chat', {
                messages: [
                    ...history,
                    { role: 'user', content: message }
                ],
                stream: false,
                format: jsonMode ? 'json' : undefined
            });

            return response.data.message.content;
        } catch (error) {
            console.error('[Ollama] Chat error after all model attempts:', error);
            throw new AIServiceError(
                'AI Service is currently unavailable. All models failed to respond.',
                { recoverable: true, cause: error as Error, context: 'chat' }
            );
        }
    }
}

export const ollamaService = new OllamaService();
