
import { aiServiceManager } from './ai.manager';
import { cleanAssistantChatResponse } from '../utils/screenplayFormatting';

const SMALL_TALK_MAX_LENGTH = 40;
const SMALL_TALK_PATTERN = /^(hi|hello|hey|yo|sup|hola|namaste|thanks|thank you|thx|bye|goodbye|see you|see ya|later|good morning|good afternoon|good evening|good night|how are you|whats up|what's up)(\s+(there|assistant|team|codex|buddy))?$/i;

export type AssistantIntent = 'scene_edit' | 'selection_edit' | 'chat';

export interface IntentContext {
    hasScene: boolean;
    hasSelection: boolean;
    currentMode: string;
}

export class IntentService {
    public isSmallTalk(instruction: string): boolean {
        const trimmed = instruction.trim();
        if (!trimmed) return false;
        if (trimmed.length > SMALL_TALK_MAX_LENGTH) return false;
        const normalized = trimmed
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s']/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized) return false;
        return SMALL_TALK_PATTERN.test(normalized);
    }

    public async generateSmallTalkResponse(message: string): Promise<string> {
        const { SMALL_TALK_PROMPT } = require('../prompts/hollywood');
        const prompt = SMALL_TALK_PROMPT.replace('{{message}}', message.trim());
        const response = await aiServiceManager.chat(prompt, { temperature: 0.7 });
        const cleaned = cleanAssistantChatResponse(response).trim();
        return cleaned || 'Hey! What are you working on right now?';
    }

    public async classifyIntentElite(instruction: string, context: IntentContext): Promise<{ intent: AssistantIntent, confidence: number }> {
        const { ELITE_INTENT_CLASSIFIER_PROMPT } = require('../prompts/hollywood');
        
        const prompt = ELITE_INTENT_CLASSIFIER_PROMPT
            .replace('{{hasScene}}', String(context.hasScene))
            .replace('{{hasSelection}}', String(context.hasSelection))
            .replace('{{currentMode}}', context.currentMode)
            .replace('{{instruction}}', instruction.trim());

        try {
            const response = await aiServiceManager.chat(prompt, { 
                temperature: 0, 
                format: 'json',
                model: process.env.GROQ_UTILITY_MODEL || 'llama-3.1-8b-instant'
            });

            console.info(`[EliteClassifier] Raw response: ${response}`);
            const jsonPayload = this.extractJsonPayload(response);
            if (jsonPayload) {
                const parsed = JSON.parse(jsonPayload);
                const result = {
                    intent: (parsed.intent || 'chat') as AssistantIntent,
                    confidence: Number(parsed.confidence) || 0.5
                };
                console.info(`[EliteClassifier] Result: ${result.intent} (${result.confidence})`);
                return result;
            }
        } catch (error) {
            console.error('[EliteClassifier] Failed:', error);
        }

        return { intent: 'chat', confidence: 0 };
    }

    private extractJsonPayload(raw: string): string | null {
        if (!raw) return null;
        
        // Strategy 1: Look for JSON blocks
        const blockMatch = raw.match(/```json\n?([\s\S]*?)\n?```/i) || raw.match(/```\n?([\s\S]*?)\n?```/i);
        if (blockMatch) return blockMatch[1].trim();

        // Strategy 2: Find outermost braces
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            return raw.slice(firstBrace, lastBrace + 1);
        }

        // Strategy 3: Clean response if it looks like a lone JSON object
        const cleaned = raw.trim();
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

        return null;
    }
}

export const intentService = new IntentService();
