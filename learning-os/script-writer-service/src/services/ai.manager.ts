
import { IAIService } from './ai.interface';
import { ollamaService } from './ollama.service';

import { groqService } from './groq.service';
import * as fs from 'fs';
import * as path from 'path';

export type AIProvider = 'ollama' | 'groq';

export class AIServiceManager implements IAIService {
    private activeProvider: AIProvider = 'ollama'; // Default to Ollama (Local)
    private providers: Record<AIProvider, IAIService>;
    private configPath: string;

    constructor() {
        this.providers = {
            ollama: ollamaService,
            groq: groqService
        };

        // Setup config path
        this.configPath = path.join(process.cwd(), 'ai-config.json');

        // Load persisted provider
        this.loadProvider();

        console.log('[AIServiceManager] Initialized with default provider:', this.activeProvider);
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
        try {
            return await this.providers[this.activeProvider].chat(message, options);
        } catch (error: any) {
            console.warn(`[AIServiceManager] Provider '${this.activeProvider}' failed: ${error.message}. Switching to fallback...`);

            // "Sticky" fallback: Change the active provider for the rest of the session
            const failedProvider = this.activeProvider;
            this.activeProvider = failedProvider === 'groq' ? 'ollama' : 'groq';

            try {
                return await this.providers[this.activeProvider].chat(message, options);
            } catch (fallbackError: any) {
                console.error('[AIServiceManager] All providers failed.');
                throw error; // Throw original error from first attempt
            }
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
        try {
            const provider = this.providers[this.activeProvider];
            if (provider.chatStream) {
                yield* provider.chatStream(messages, systemPrompt);
            } else {
                throw new Error(`Provider ${this.activeProvider} does not support streaming`);
            }
        } catch (error: any) {
            console.warn(`[AIServiceManager] Stream failed for '${this.activeProvider}': ${error.message}. Switching to fallback...`);

            // "Sticky" fallback for streaming too
            const failedProvider = this.activeProvider;
            this.activeProvider = failedProvider === 'groq' ? 'ollama' : 'groq';

            const fallback = this.providers[this.activeProvider];
            if (fallback.chatStream) {
                yield* fallback.chatStream(messages, systemPrompt);
            } else {
                throw error;
            }
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Embeddings are now strictly handled by Ollama (bge-m3)
        // Groq does not support embeddings.
        return await this.providers.ollama.generateEmbedding(text);
    }
}

export const aiServiceManager = new AIServiceManager();
