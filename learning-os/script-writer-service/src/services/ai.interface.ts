export interface IAIService {
    /**
     * Non-streaming chat completion.
     */
    chat(message: string, history?: any[], jsonMode?: boolean): Promise<string>;

    /**
     * Streaming chat completion.
     */
    chatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown>;

    /**
     * Generate vector embedding for text.
     */
    generateEmbedding(text: string): Promise<number[]>;
}
