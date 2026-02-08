
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import { IAIService } from './ai.interface';

dotenv.config();

export class GeminiService implements IAIService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private embeddingModel: any;

    constructor() {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.warn('[GeminiService] No GOOGLE_API_KEY found. Gemini service will fail if used.');
        }
        this.genAI = new GoogleGenerativeAI(apiKey || '');

        // Use gemini-1.5-pro as primary stable model
        this.model = this.genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    }

    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        try {
            // Convert history format if needed (Gemini expects { role: 'user' | 'model', parts: [{ text: string }] })
            const chatHistory = history.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const chat = this.model.startChat({
                history: chatHistory,
                generationConfig: {
                    responseMimeType: jsonMode ? 'application/json' : 'text/plain'
                }
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('[GeminiService] Chat failed:', error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
        try {
            let history = messages.slice(0, -1).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            // Handle system prompt by prepending or using systemInstruction if supported (v1.5 supports it)
            // Ideally we use systemInstruction in getGenerativeModel, but we are reusing the instance.
            // For now, let's prepend it to history as user/model turn if typically supported, 
            // OR re-instantiate model with system instruction for this call.

            let modelToUse = this.model;
            if (systemPrompt) {
                modelToUse = this.genAI.getGenerativeModel({
                    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                    systemInstruction: systemPrompt
                });
            }

            const chat = modelToUse.startChat({
                history: history
            });

            const lastMessage = messages[messages.length - 1];
            const result = await chat.sendMessageStream(lastMessage.content);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                yield chunkText;
            }

        } catch (error: any) {
            console.error('[GeminiService] Stream failed:', error);
            throw new Error(`Gemini Stream Error: ${error.message}`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const result = await this.embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error: any) {
            console.error('[GeminiService] Embedding failed:', error);
            throw new Error(`Gemini Embedding Error: ${error.message}`);
        }
    }
}

export const geminiService = new GeminiService();
