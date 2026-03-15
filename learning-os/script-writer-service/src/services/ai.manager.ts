
import { IAIService } from './ai.interface';
import { ollamaService } from './ollama.service';
import { groqService } from './groq.service';
import { llamaindexService } from './llamaindex.service';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export type AIProvider = 'ollama' | 'groq';

export class AIServiceManager implements IAIService {
    private activeProvider: AIProvider = 'ollama'; // Default to Ollama (Local)
    private providers: Record<AIProvider, IAIService>;
    private configPath: string;
    private lastEmbeddingDimension: number = 0;
    private readonly maxEmbeddingChars = this.parsePositiveInt(process.env.EMBEDDING_MAX_CHARS, 4000);
    private embeddingTail: Promise<void> = Promise.resolve();
    private readonly embeddingBackend: 'llamaindex' = 'llamaindex'; // LlamaIndex is now the global authority
    private readonly allowSyntheticEmbeddingFallback = (process.env.ALLOW_SYNTHETIC_EMBEDDING_FALLBACK || 'false').toLowerCase() === 'true';

    constructor() {
        this.providers = {
            ollama: ollamaService,
            groq: groqService
        };

        // Setup config path
        this.configPath = path.join(process.cwd(), 'ai-config.json');

        // Load persisted provider
        this.loadProvider();

        console.log('[AIServiceManager] Initialized with Mastery Service standby.');
    }

    private loadProvider() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                if (config.provider && this.providers[config.provider as AIProvider]) {
                    this.activeProvider = config.provider as AIProvider;
                }
            }
        } catch (error) {
            console.warn('[AIServiceManager] Failed to load config:', error);
        }
    }

    setProvider(provider: AIProvider) {
        if (this.providers[provider]) {
            this.activeProvider = provider;
            console.log('[AIServiceManager] Switched AI Provider to:', provider);

            // Persist choice
            try {
                fs.writeFileSync(this.configPath, JSON.stringify({ provider }, null, 2));
            } catch (error) {
                console.error('[AIServiceManager] Failed to save config:', error);
            }
        } else {
            console.warn(`[AIServiceManager] Unknown provider '${provider}', keeping ${this.activeProvider}`);
        }
    }

    getProvider(): AIProvider {
        return this.activeProvider;
    }

    async chat(message: string, options?: import('./ai.interface').ChatOptions): Promise<string> {
        const primaryProvider = this.activeProvider;
        try {
            return await this.providers[primaryProvider].chat(message, options);
        } catch (error: any) {
            console.warn(`[AIServiceManager] Provider '${primaryProvider}' failed: ${error.message}. Trying fallback for this request...`);

            // Non-sticky fallback: do not mutate global provider on transient failures.
            const fallbackProvider: AIProvider = primaryProvider === 'groq' ? 'ollama' : 'groq';

            try {
                return await this.providers[fallbackProvider].chat(message, options);
            } catch (fallbackError: any) {
                console.error('[AIServiceManager] All providers failed.');
                throw error;
            }
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string, options?: import('./ai.interface').ChatOptions): AsyncGenerator<string, void, unknown> {
        const primaryProvider = this.activeProvider;
        const fallbackProvider: AIProvider = primaryProvider === 'groq' ? 'ollama' : 'groq';

        const primary = this.providers[primaryProvider];
        if (!primary.chatStream) {
            throw new Error(`Provider ${primaryProvider} does not support streaming`);
        }

        let emittedFromPrimary = false;
        let primaryError: any = null;

        try {
            for await (const chunk of primary.chatStream(messages, systemPrompt, options)) {
                emittedFromPrimary = true;
                yield chunk;
            }
            return;
        } catch (error: any) {
            primaryError = error;
            if (emittedFromPrimary) {
                // Do not switch providers after partial output: that would corrupt the stream semantics.
                console.error(`[AIServiceManager] Stream from '${primaryProvider}' failed after partial output: ${error.message}`);
                throw error;
            }
            console.warn(`[AIServiceManager] Stream provider '${primaryProvider}' failed before output: ${error.message}. Trying fallback for this request...`);
        }

        const fallback = this.providers[fallbackProvider];
        if (!fallback.chatStream) {
            throw new Error(`Provider ${fallbackProvider} does not support streaming`);
        }

        try {
            for await (const chunk of fallback.chatStream(messages, systemPrompt, options)) {
                yield chunk;
            }
        } catch (fallbackError: any) {
            console.error(`[AIServiceManager] Stream fallback '${fallbackProvider}' failed: ${fallbackError.message}`);
            throw primaryError || fallbackError;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return this.withEmbeddingLock(() => this.generateEmbeddingInternal(text));
    }

    private sanitizeEmbeddingText(text: string): string {
        const input = typeof text === 'string' ? text : '';
        const cleaned = input
            .normalize('NFKC')
            .replace(/\u0000/g, ' ')
            .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
            // Remove unpaired surrogate code points that can appear from OCR/PDF extraction artifacts.
            .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, ' ')
            .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1 ')
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

    private buildDeterministicFallbackEmbedding(seed: string, dimension: number): number[] {
        const hash = crypto.createHash('sha256').update(seed).digest();
        const vector = new Array<number>(dimension);
        let state = 2166136261;

        for (let i = 0; i < dimension; i++) {
            state ^= hash[i % hash.length];
            state = Math.imul(state, 16777619);
            const unit = (state >>> 0) / 0xffffffff;
            vector[i] = unit * 2 - 1;
        }

        return this.validateAndNormalizeEmbedding(vector);
    }

    private parsePositiveInt(raw: string | undefined, fallback: number): number {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.floor(parsed);
    }

    private async generateEmbeddingInternal(text: string): Promise<number[]> {
        const sanitized = this.sanitizeEmbeddingText(text);
        const maxRetries = this.parsePositiveInt(process.env.EMBEDDING_MAX_RETRIES, 5);
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const embedding = await this.generateEmbeddingFromBackend(sanitized);
                const normalized = this.validateAndNormalizeEmbedding(embedding);
                this.lastEmbeddingDimension = normalized.length;
                return normalized;
            } catch (error: any) {
                lastError = error;
                const message = error?.message || String(error);
                const fingerprint = crypto.createHash('sha256').update(sanitized).digest('hex').slice(0, 12);
                console.warn(
                    `[AIServiceManager] ${this.embeddingBackend} embedding failed (chars=${sanitized.length}, hash=${fingerprint}, attempt ${attempt}/${maxRetries}): ${message}`
                );

                const waitMs = this.isNaNEncodingError(error) ? attempt * 400 : attempt * 200;
                await this.wait(waitMs);
            }
        }

        if (this.allowSyntheticEmbeddingFallback) {
            const dim = this.lastEmbeddingDimension || this.parsePositiveInt(process.env.EMBEDDING_FALLBACK_DIM, 1024);
            console.error(
                `[AIServiceManager] Embedding backend failed; using deterministic fallback vector (${dim} dims). Last error: ${lastError?.message || 'unknown'}`
            );
            return this.buildDeterministicFallbackEmbedding(sanitized, dim);
        }

        throw new Error(`Embedding generation failed after retries: ${lastError?.message || 'unknown error'}`);
    }

    private async generateEmbeddingFromBackend(text: string): Promise<number[]> {
        // Mastery Note: LlamaIndex (BGE-M3) is the required standard for Hollywood RAG.
        return await llamaindexService.getEmbedding(text);
    }

    private async withEmbeddingLock<T>(work: () => Promise<T>): Promise<T> {
        const prior = this.embeddingTail;
        let release!: () => void;
        this.embeddingTail = new Promise<void>(resolve => {
            release = resolve;
        });

        await prior;
        try {
            return await work();
        } finally {
            release();
        }
    }

    private isNaNEncodingError(error: any): boolean {
        const message = (error?.message || String(error)).toLowerCase();
        return message.includes('unsupported value: nan');
    }

    private async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const aiServiceManager = new AIServiceManager();
