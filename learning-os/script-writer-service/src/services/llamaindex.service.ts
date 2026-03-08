
import {
    Settings,
    Document
} from "llamaindex";
import { OllamaEmbedding } from "@llamaindex/ollama";
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * LlamaIndex Mastery Service
 * The global authority for embeddings and ingestion.
 */
export class LlamaIndexService {
    private static instance: LlamaIndexService;
    private embedModels: { name: string; client: OllamaEmbedding }[] = [];
    private readonly ollamaHost: string;
    private readonly failedModelCooldownMs = 60_000;
    private readonly modelCooldownUntil = new Map<string, number>();

    private constructor() {
        this.ollamaHost = this.resolveOllamaHost(
            process.env.OLLAMA_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
        );

        const configuredPrimary = this.normalizeModelTag(process.env.OLLAMA_EMBED_MODEL || "bge-m3:latest");
        const configuredFallbacks = (process.env.OLLAMA_EMBED_FALLBACK_MODELS || "")
            .split(',')
            .map(model => this.normalizeModelTag(model.trim()))
            .filter(Boolean);

        const orderedModels = Array.from(new Set([configuredPrimary, ...configuredFallbacks]));
        this.embedModels = orderedModels.map(name => ({
            name,
            client: new OllamaEmbedding({
                model: name,
                config: { host: this.ollamaHost }
            })
        }));

        // 2. Set primary as global default for LlamaIndex components.
        Settings.embedModel = this.embedModels[0].client;

        console.log(
            `[LlamaIndex] Mastery Service Initialized with embedding models: ${orderedModels.join(', ')} (host=${this.ollamaHost})`
        );
    }

    public static getInstance(): LlamaIndexService {
        if (!LlamaIndexService.instance) {
            LlamaIndexService.instance = new LlamaIndexService();
        }
        return LlamaIndexService.instance;
    }

    /**
     * Generates a high-fidelity, normalized embedding using BGE-M3.
     */
    async getEmbedding(text: string): Promise<number[]> {
        let lastError: any;
        const now = Date.now();
        let attempted = 0;
        let firstBlockedModel: { name: string; client: OllamaEmbedding } | null = null;
        let firstBlockedUntil = Number.POSITIVE_INFINITY;

        for (const model of this.embedModels) {
            const blockedUntil = this.modelCooldownUntil.get(model.name) || 0;
            if (blockedUntil > now) {
                if (blockedUntil < firstBlockedUntil) {
                    firstBlockedUntil = blockedUntil;
                    firstBlockedModel = model;
                }
                continue;
            }

            try {
                attempted++;
                const embedding = await model.client.getTextEmbedding(text);
                const normalized = this.normalize(embedding);
                this.modelCooldownUntil.delete(model.name);
                return normalized;
            } catch (error: any) {
                lastError = error;
                const message = (error?.message || String(error)).toLowerCase();

                // Cooldown is useful only when we have a fallback model to try.
                // With a single model, global cooldown would blacklist all embedding requests.
                if (message.includes('unsupported value: nan') && this.embedModels.length > 1) {
                    this.modelCooldownUntil.set(model.name, Date.now() + this.failedModelCooldownMs);
                }

                console.warn(`[LlamaIndex] Embedding model '${model.name}' failed: ${error?.message || error}`);
            }
        }

        // If every model was in cooldown, force one probe instead of failing immediately.
        // This prevents retry loops from getting stuck on "All configured ... failed."
        if (attempted === 0 && firstBlockedModel) {
            try {
                const embedding = await firstBlockedModel.client.getTextEmbedding(text);
                const normalized = this.normalize(embedding);
                this.modelCooldownUntil.delete(firstBlockedModel.name);
                return normalized;
            } catch (error: any) {
                lastError = error;
                console.warn(
                    `[LlamaIndex] Forced cooldown probe failed for model '${firstBlockedModel.name}': ${error?.message || error}`
                );
            }
        }

        throw lastError || new Error('All configured LlamaIndex embedding models failed.');
    }

    /**
     * L2 Normalization to ensure cosine similarity via dot product/L2 distance.
     */
    private normalize(vector: number[]): number[] {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Embedding vector is missing or empty.');
        }

        const finite = vector.map(value => (Number.isFinite(value) ? value : 0));
        const magnitude = Math.sqrt(finite.reduce((acc, val) => acc + val * val, 0));
        if (!(magnitude > 0)) {
            throw new Error('Embedding vector magnitude is zero after sanitization.');
        }
        return finite.map(val => val / magnitude);
    }

    /**
     * High-Level Ingestion logic for LlamaIndex Documents.
     */
    async createDocument(text: string, metadata: any = {}): Promise<Document> {
        return new Document({ text, metadata });
    }

    private normalizeModelTag(model: string): string {
        const m = (model || '').trim();
        if (!m) return m;
        if (m.includes(':')) return m;
        return `${m}:latest`;
    }

    private resolveOllamaHost(raw: string): string {
        const host = (raw || '').trim();
        if (!host) {
            return 'http://127.0.0.1:11434';
        }
        // Force IPv4 loopback to avoid localhost resolution issues in Node fetch.
        return host.replace('://localhost', '://127.0.0.1');
    }
}

export const llamaindexService = LlamaIndexService.getInstance();
