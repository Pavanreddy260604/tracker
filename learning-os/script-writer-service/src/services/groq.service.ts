
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
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
        this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'; // Fallback to user requested default
    }

    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        try {
            const messages = history.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            // Add current message
            messages.push({ role: 'user', content: message });

            const completion = await this.client.chat.completions.create({
                messages: messages as any,
                model: this.model,
                response_format: jsonMode ? { type: 'json_object' } : undefined,
                temperature: 0.7,
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
        // Groq might not support embeddings or we reuse another service.
        // For now, throw or return a dummy/error if not supported by the specific model or SDK capability.
        // Actually, let's fallback or just error out. RAG uses this.
        // If Groq doesn't have embeddings, we might need a fallback (e.g. Ollama or Gemini if available).
        // The AIService interface implies full capability.
        // Let's implement a placeholder or use a default embedding model if Groq supports it?
        // Groq generally focuses on inference speed for LLMs.
        // We will throw "Not Implemented" and let the manager handle fallback if we want,
        // OR we can just throw. The current app uses RAG, so this might be an issue if Groq is the ONLY provider.
        // However, the user didn't ask for embeddings on Groq specifically, just "add this toggle".
        // Let's throw for now.
        throw new Error('GroqService: Embeddings not yet implemented/supported.');
    }
}

export const groqService = new GroqService();
