
import axios from 'axios';
import * as dotenv from 'dotenv';
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
    private embeddingModels: string[];
    private readonly maxEmbeddingChars = this.parsePositiveInt(process.env.EMBEDDING_MAX_CHARS, 4000);

    constructor(model?: string, userId?: string) {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        // User Preference: Deepseek is the Supreme Model for stability and reasoning
        this.primaryModel = model || process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';
        this.userId = userId;

        // Defined fallback chain prioritizing models present on user's machine
        this.fallbackModels = [
            'gemma3:4b',                                                                // 1. Gemma 3 (Balanced)
            'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest',                        // 2. Llama 3.2 1B (Fast)
            'tinyllama:latest',                                                         // 3. TinyLlama (Fastest)
            'deepseek-v3.1:671b-cloud',                                                 // 4. Deepseek (High Quality)
        ];

        const configuredEmbedModel = this.normalizeModelTag(process.env.OLLAMA_EMBED_MODEL || 'bge-m3:latest');
        const configuredEmbedFallbacks = (process.env.OLLAMA_EMBED_FALLBACK_MODELS || '')
            .split(',')
            .map(model => this.normalizeModelTag(model.trim()))
            .filter(Boolean);
        this.embeddingModels = Array.from(new Set([configuredEmbedModel, ...configuredEmbedFallbacks]));
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
        systemPrompt?: string,
        options?: import('./ai.interface').ChatOptions
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
                        temperature: options?.temperature ?? 0.0, 
                        seed: options?.seed,
                        num_ctx: 16384, // Increased context
                        num_thread: 8, 
                        f16_kv: true, // Faster
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
        let lastError: any;
        const maxRetries = 5;
        const sanitized = this.sanitizeEmbeddingText(text);

        for (const model of this.embeddingModels) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const textForAttempt = this.buildNaNSafeTextVariant(sanitized, attempt);
                try {
                    // Prefer /api/embed (new endpoint). Fall back to /api/embeddings for older Ollama servers.
                    const embedding = await this.generateEmbeddingViaEmbedEndpoint(model, textForAttempt);
                    return this.validateAndNormalizeEmbedding(embedding);
                } catch (error: any) {
                    lastError = error;
                    const message = this.extractEmbeddingErrorMessage(error);
                    console.warn(`[Ollama] Embedding failed for model ${model} (attempt ${attempt}/${maxRetries}): ${message}`);

                    if (message.toLowerCase().includes('unsupported value: nan')) {
                        if (attempt < maxRetries) {
                            console.warn(`[Ollama] Retrying ${model} with NaN-safe text variant (attempt ${attempt + 1}/${maxRetries}).`);
                        }
                        await this.wait(200 * attempt);
                        continue;
                    }

                    // Non-NaN errors should not spin excessive retries.
                    if (attempt >= 3) {
                        break;
                    }
                }
            }
        }

        throw new Error(
            `Failed to generate embedding from all models (${this.embeddingModels.join(', ')}). Last error: ${this.extractEmbeddingErrorMessage(lastError)}`
        );
    }

    /**
     * Non-streaming completion helper (used by critic service).
     */
    async generateCompletion(prompt: string, options?: { temperature?: number; format?: 'json' | 'text' }) {
        return this.chat(prompt, {
            format: options?.format,
            temperature: options?.temperature
        });
    }

    // Unified Chat Interface (matches matches IAIService)
    async chat(message: string, options?: import('./ai.interface').ChatOptions): Promise<string> {
        // 1. Build list of models to try
        // Priority: Requested Model -> Primary Configured -> Fallbacks
        const requestedModel = options?.model;
        const candidates = new Set<string>();

        if (requestedModel) candidates.add(requestedModel);
        candidates.add(this.primaryModel);
        this.fallbackModels.forEach(m => candidates.add(m));

        const modelsToTry = Array.from(candidates);
        let lastError: Error | null = null;

        // 2. Iterate and Try
        for (const model of modelsToTry) {
            try {
                // Formatting payload
                const payload = {
                    model: model,
                    messages: [
                        { role: 'user', content: message }
                    ],
                    stream: false,
                    format: options?.format === 'json' ? 'json' : undefined,
                    options: {
                        temperature: options?.temperature ?? 0.0,
                        seed: options?.seed,
                        num_predict: options?.max_tokens || 8192,
                        num_ctx: 16384, // Larger context for 100+ scene treatments
                        num_thread: 8,
                        f16_kv: true
                    }
                };

                console.log(`[OllamaService] Attempting chat with model: ${model}`);
                const response = await axios.post(`${this.baseUrl}/api/chat`, payload);

                // Success!
                return response.data.message.content;

            } catch (error: any) {
                lastError = error;
                console.warn(`[OllamaService] Model ${model} failed: ${error.message}`);

                // If 404 (Model not found), just continue to next.
                // If 500 or Connection Refused, maybe delay? 
                // For now, fast fail-over is better.
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    continue;
                }
            }
        }

        // 3. All failed
        console.error('[Ollama] All models failed.');
        throw new AIServiceError(
            'AI Service is currently unavailable. All models failed to respond.',
            { recoverable: true, cause: lastError as Error, context: 'chat' }
        );
    }

    private validateAndNormalizeEmbedding(vector: number[]): number[] {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Embedding vector is missing or empty.');
        }

        const finite = vector.map(value => (Number.isFinite(value) ? value : 0));
        const magnitude = Math.sqrt(finite.reduce((acc, val) => acc + val * val, 0));
        if (!(magnitude > 0)) {
            throw new Error('Embedding vector magnitude is zero after sanitization.');
        }

        return finite.map(value => value / magnitude);
    }

    private extractEmbeddingErrorMessage(error: any): string {
        if (axios.isAxiosError(error)) {
            const apiMessage = error.response?.data?.error;
            if (typeof apiMessage === 'string' && apiMessage.trim()) {
                return apiMessage;
            }
            if (apiMessage && typeof apiMessage === 'object') {
                try {
                    return JSON.stringify(apiMessage);
                } catch {
                    // continue
                }
            }
            if (typeof error.message === 'string' && error.message.trim()) {
                return error.message;
            }
        }
        if (typeof error?.message === 'string' && error.message.trim()) {
            return error.message;
        }
        return 'Unknown embedding error';
    }

    private async generateEmbeddingViaEmbedEndpoint(model: string, text: string): Promise<number[]> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/embed`, {
                model,
                input: text
            });

            const embeddings = response.data?.embeddings;
            if (Array.isArray(embeddings) && embeddings.length > 0 && Array.isArray(embeddings[0])) {
                return embeddings[0] as number[];
            }

            throw new Error('Invalid /api/embed response shape');
        } catch (error: any) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            const message = this.extractEmbeddingErrorMessage(error).toLowerCase();
            const shouldFallbackToLegacy = status === 404 || message.includes('not found') || message.includes('unknown route');
            if (!shouldFallbackToLegacy) {
                throw error;
            }
        }

        const legacyResponse = await axios.post(`${this.baseUrl}/api/embeddings`, {
            model,
            prompt: text
        });
        return legacyResponse.data.embedding;
    }

    private normalizeModelTag(model: string): string {
        const m = (model || '').trim();
        if (!m) return m;
        if (m.includes(':')) return m;
        return `${m}:latest`;
    }

    private sanitizeEmbeddingText(text: string): string {
        const input = typeof text === 'string' ? text : '';
        const cleaned = input
            .normalize('NFKC')
            .replace(/\u0000/g, ' ')
            .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
            .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, ' ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        if (!cleaned) {
            return '[EMPTY_TEXT]';
        }

        return cleaned.length > this.maxEmbeddingChars
            ? cleaned.slice(0, this.maxEmbeddingChars)
            : cleaned;
    }

    private buildNaNSafeTextVariant(text: string, attempt: number): string {
        if (attempt <= 1) {
            return text;
        }

        const markers = [' [pad]', ' [pad:v2]', ' [pad:v3]', '\n[pad:v4]'];
        const marker = markers[(attempt - 2) % markers.length];
        const maxBaseLength = Math.max(this.maxEmbeddingChars - marker.length, 0);
        const base = text.length > maxBaseLength ? text.slice(0, maxBaseLength) : text;
        return `${base}${marker}`;
    }

    private parsePositiveInt(raw: string | undefined, fallback: number): number {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.floor(parsed);
    }
}

export const ollamaService = new OllamaService();
