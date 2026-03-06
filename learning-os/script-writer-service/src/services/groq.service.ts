
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import { IAIService } from './ai.interface';

dotenv.config();

export class GroqService implements IAIService {
    private client: Groq;
    private model: string;

    constructor() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.warn('[GroqService] No GROQ_API_KEY found. Groq service will fail if used.');
        }
        this.client = new Groq({ apiKey: apiKey || '' });
        this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    }

    async chat(message: string, options?: import('./ai.interface').ChatOptions): Promise<string> {
        try {
            // Use legacy history if needed, but for now we assume stateless or handled via options (if we added history to options)
            // Actually, the interface removed history? No, I need to check if I removed history from interface.
            // Wait, I replaced the signature in interface.
            // Let's assume stateless for this specific method signature based on my previous edit to interface.
            // Interface was: chat(message: string, options?: ChatOptions): Promise<string>;

            const systemPrompt = "You are a helpful AI assistant.";
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ];

            const completion = await this.client.chat.completions.create({
                messages: messages as any,
                model: options?.model || this.model,
                response_format: options?.format === 'json' ? { type: 'json_object' } : undefined,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.max_tokens
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error: any) {
            console.error('[GroqService] Chat failed:', error);
            throw new Error(`Groq Error: ${error.message}`);
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
        try {
            const formattedMessages = messages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            if (systemPrompt) {
                formattedMessages.unshift({ role: 'system', content: systemPrompt } as any);
            }

            const stream = await this.client.chat.completions.create({
                messages: formattedMessages as any,
                model: this.model,
                stream: true,
                temperature: 0.7
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield content;
                }
            }
        } catch (error: any) {
            console.error('[GroqService] Stream failed:', error);
            throw new Error(`Groq Stream Error: ${error.message}`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Groq does not natively support embeddings for chat models.
        // Falling back to Ollama (bge-m3) via AIServiceManager.
        throw new Error('GroqService: Native embeddings not supported. Fallback required.');
    }
}

export const groqService = new GroqService();
