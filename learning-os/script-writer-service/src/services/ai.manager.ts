
import { IAIService } from './ai.interface';
import { ollamaService } from './ollama.service';
import { geminiService } from './gemini.service';
import { groqService } from './groq.service';
import fs from 'fs';
import path from 'path';

export type AIProvider = 'ollama' | 'gemini' | 'groq';

export class AIServiceManager implements IAIService {
    private activeProvider: AIProvider = 'ollama'; // Default to Ollama (Local)
    private providers: Record<AIProvider, IAIService>;
    private configPath: string;

    constructor() {
        this.providers = {
            ollama: ollamaService,
            gemini: geminiService,
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

    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        return this.providers[this.activeProvider].chat(message, history, jsonMode);
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
        const provider = this.providers[this.activeProvider];
        // Ensure provider has the method (Ollama does, Gemini does)
        if (provider.chatStream) {
            yield* provider.chatStream(messages, systemPrompt);
        } else {
            // Fallback for providers without streaming if necessary, or error
            throw new Error(`Provider ${this.activeProvider} does not support streaming`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return this.providers[this.activeProvider].generateEmbedding(text);
    }
}

export const aiServiceManager = new AIServiceManager();
