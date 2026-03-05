import { AIClientService } from './aiClient.service.js';

export class AIChatService extends AIClientService {
    // AIChatService inherits all core chat, tool execution, and streaming capabilities
    // from AIClientService. This class serves as the primary interface for general
    // chat and system-aware conversational features.

    /**
     * Sends a generic conversational prompt.
     * @param prompt User's prompt string
     * @returns Raw string response from the AI
     */
    public async ask(prompt: string): Promise<string> {
        return this.generateResponse(prompt);
    }
}
