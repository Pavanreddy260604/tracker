/**
 * Screenplay-Aware Chunker Service
 * 
 * Intelligently parses screenplay text into structured chunks,
 * preserving speaker attribution and dialogue boundaries.
 */

export type ChunkType = 'dialogue' | 'action' | 'transition' | 'slug' | 'parenthetical';

export interface DialogueChunk {
    type: ChunkType;
    content: string;
    speaker?: string;              // Extracted character name
    parenthetical?: string;        // (V.O.), (O.S.), (CONT'D), etc.
    lineNumber: number;
    chunkIndex: number;
    contextBefore?: string;        // Previous chunk for continuity
    raw: string;                   // Original unprocessed text
    era?: string;                  // DETECTED ERA CONTEXT
    tactic?: string;               // DETECTED CHARACTER TACTIC (PH 19)
    emotion?: string;              // DETECTED EMOTIONAL CHARGE (PH 19)
}

export interface ParseResult {
    chunks: DialogueChunk[];
    characters: string[];          // All detected character names
    sceneCount: number;
    stats: {
        dialogueCount: number;
        actionCount: number;
        avgDialogueLength: number;
    };
}

// Screenplay element patterns
const PATTERNS = {
    // Scene headers: INT./EXT. LOCATION - TIME
    sceneHeader: /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+$/i,

    // Character cue: 
    // 1. English ALL CAPS name (Standard)
    // 2. Name ending with colon (Script style)
    // 3. Unicode/Non-Latin Name (No punctuation at end, short length) - For local languages like Telugu/Hindi
    characterCue: /^(?:(?:[A-Z][A-Z\s\d\-\.']*[A-Z])|(?:.*:)|(?:[\p{L}\p{M}][\p{L}\p{M}\s\d\-\.']{0,50}[^\s\.,!\?]))(?:[\s]*\([^\)]+\))?$/u,

    // Parenthetical: (beat), (quietly), (V.O.), (O.S.), etc.
    parenthetical: /^\([\w\s\.\-',]+\)$/,

    // Transitions: CUT TO:, FADE OUT., DISSOLVE TO:
    transition: /^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i,

    // Page break indicators
    pageBreak: /^(CONTINUED|MORE|\(MORE\)|Page \d+)$/i,

    // Common parentheticals that indicate voice type
    voiceTypes: /\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONTINUING|PRE-LAP|FILTERED|INTO PHONE)\)/i,

    // ERA HEADER DETECTION: # ERA: [NAME]
    eraHeader: /^#\s*ERA:\s*(.+)$/i
};

import { aiServiceManager } from './ai.manager';

export class ChunkerService {

    /**
     * Parse a full screenplay text into structured chunks.
     * NOW USES AI for robust multilingual support.
     * Note: This returns a Promise now.
     */
    async parseScreenplay(text: string): Promise<ParseResult> {
        console.log('[ChunkerService] Starting AI-powered script parsing...');

        // Validate input
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        // Split long texts to avoid context window limits
        // Simple chunking by lines for now, assuming file < 30k tokens usually.
        // For production, we should chunk by pages or scenes.
        const SLICE_SIZE = 25000;
        const textSlice = text.slice(0, SLICE_SIZE);
        if (text.length > SLICE_SIZE) {
            console.warn(`[ChunkerService] Text too long (${text.length}), truncating to ${SLICE_SIZE} chars for AI analysis.`);
        }

        const prompt = `
        You are an expert Screenplay Parser for a RAG system.
        Your job is to read the following script segment (which may be in English, Telugu, Hindi, etc.) and extract every single dialogue line into a structured JSON format.
        
        CRITICAL RULES:
        1. Identify the ERA context if lines are under a header like "# ERA: [Name]". Apply this era to all subsequent chunks until a new era is found.
        2. Identify the Speaker Name.
        3. Extract the Dialogue content exactly as written.
        4. TACTIC DETECTION (NEW): For every dialogue line, identify the CHARACTER TACTIC being used (e.g., DEFLECT, INTIMIDATE, PLEAD, SEDUCE, EVADE, PITY, INTERROGATE).
        5. EMOTION DETECTION (NEW): Identify the EMOTIONAL CHARGE of the line (e.g., "Tense", "Vulnerable", "Angry", "Sarcastic").
        6. Return a valid JSON object with a "chunks" array.

        Input Text:
        """
        ${textSlice} 
        """

        Output Format:
        {
            "chunks": [
                {
                    "type": "dialogue" | "action" | "slug",
                    "speaker": "Name" (or null for action/slug),
                    "content": "Line of text",
                    "tactic": "THE_TACTIC",
                    "emotion": "THE_EMOTION",
                    "era": "Era Name" (or null if none)
                }
            ]
        }
        
        Respond ONLY with the RAW JSON string. Do not use markdown blocks.
        `;

        try {
            // Use Ollama (llama3) or Groq (llama3-70b) as requested
            // We let the AI Manager handle the specific provider details based on config,
            // but we request a model that is good at JSON instructions.
            const resultString = await aiServiceManager.chat(prompt, {
                format: 'json',
                temperature: 0.1 // Low temp for consistent JSON
            });

            // Clean markdown code blocks if present
            const cleanJson = resultString.replace(/```json/g, '').replace(/```/g, '').trim();
            let parsed;
            try {
                parsed = JSON.parse(cleanJson);
            } catch (e) {
                console.error('AI returned invalid JSON:', cleanJson);
                throw new Error('AI Parsing failed to return valid JSON');
            }

            // Validate AI response structure
            if (!parsed || !Array.isArray(parsed.chunks)) {
                throw new Error('AI response missing required "chunks" array');
            }

            const chunks: DialogueChunk[] = parsed.chunks.map((c: any, index: number) => {
                // Validate each chunk has required fields
                if (!c || typeof c !== 'object') {
                    console.warn(`[ChunkerService] Invalid chunk at index ${index}, skipping`);
                    return null;
                }
                return {
                    type: c.type || 'dialogue',
                    content: String(c.content || ''),
                    speaker: c.speaker ? String(c.speaker) : undefined,
                    lineNumber: index + 1,
                    chunkIndex: index,
                    era: c.era ? String(c.era) : undefined,
                    tactic: c.tactic ? String(c.tactic) : undefined,
                    emotion: c.emotion ? String(c.emotion) : undefined,
                    raw: String(c.content || '')
                };
            }).filter(Boolean) as DialogueChunk[];

            // Generate stats
            const dialogueChunks = chunks.filter(c => c.type === 'dialogue');
            const characters = Array.from(new Set(chunks.map(c => c.speaker).filter(Boolean))) as string[];

            return {
                chunks,
                characters,
                sceneCount: chunks.filter(c => c.type === 'slug').length,
                stats: {
                    dialogueCount: dialogueChunks.length,
                    actionCount: chunks.filter(c => c.type === 'action').length,
                    avgDialogueLength: dialogueChunks.length > 0
                        ? Math.round(dialogueChunks.reduce((sum, c) => sum + c.content.length, 0) / dialogueChunks.length)
                        : 0
                }
            };

        } catch (error) {
            console.error('[ChunkerService] AI Parsing failed:', error);
            // Fallback to empty or throw? Throwing is better so user knows.
            throw error;
        }
    }

    /**
     * Normalize character name by removing common suffixes and trimming.
     */
    private normalizeCharacterName(name: string): string {
        return name
            .replace(/\s*\(V\.O\.\)/i, '')
            .replace(/\s*\(O\.S\.\)/i, '')
            .replace(/\s*\(CONT'D\)/i, '')
            .replace(/\s*\(CONTINUING\)/i, '')
            .trim();
    }

    /**
     * Extract only dialogue chunks for voice sample ingestion.
     * Filters by minimum length and optionally by character.
     */
    extractDialogueForIngestion(
        parseResult: ParseResult,
        options?: {
            minLength?: number;
            maxLength?: number;
            characterFilter?: string[];
        }
    ): DialogueChunk[] {
        const minLen = options?.minLength ?? 10;
        const maxLen = options?.maxLength ?? 2000;
        const charFilter = options?.characterFilter?.map(c => c.toUpperCase());

        return parseResult.chunks.filter(chunk => {
            if (chunk.type !== 'dialogue') return false;
            // Allow short lines if they are meaningful (let AI decide what is dialogue)
            // if (chunk.content.length < minLen) return false; 
            if (chunk.content.length > maxLen) return false;
            if (charFilter && chunk.speaker && !charFilter.includes(chunk.speaker.toUpperCase())) {
                return false;
            }
            return true;
        });
    }
}

export const chunkerService = new ChunkerService();
