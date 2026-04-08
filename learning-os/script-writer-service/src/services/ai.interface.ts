export interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    format?: 'json' | 'text';
    seed?: number;
}

export interface IAIService {
    /**
     * Non-streaming chat completion.
     */
    chat(message: string, options?: ChatOptions): Promise<string>;

    /**
     * Streaming chat completion.
     */
    chatStream(messages: { role: string; content: string }[], systemPrompt?: string, options?: ChatOptions): AsyncGenerator<string, void, unknown>;

    /**
     * Generate vector embedding for text.
     */
    generateEmbedding(text: string): Promise<number[]>;
}
