/**
 * Screenplay-Aware Chunker Service
 * 
 * Intelligently parses screenplay text into structured chunks,
 * preserving speaker attribution and dialogue boundaries.
 */

import crypto from 'crypto';
import { aiServiceManager } from './ai.manager';

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

    // Improved Character detection: UPPERCASE, but NOT starting with EXT. or INT. (Supports Unicode)
    characterCue: /^(?!(?:INT\.|EXT\.|I\/E))(?:(?:[A-Z][A-Z\s\d\-\.']*[A-Z])|(?:.*:)|(?:[\p{L}\p{M}][\p{L}\p{M}\s\d\-\.']{0,50}[^\s\.,!\?]))(?:[\s]*\([^\)]+\))?$/u,

    // Parenthetical: (beat), (quietly), (V.O.), (O.S.), etc.
    parenthetical: /^\([\w\s\.\-',]+\)$/,

    // Transitions: CUT TO:, FADE OUT., DISSOLVE TO:
    transition: /^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i,

    // Page break indicators
    pageBreak: /^(CONTINUED|MORE|\(MORE\)|Page \d+)$/i,

    // Common parentheticals that indicate voice type
    voiceTypes: /\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONTINUING|PRE-LAP|FILTERED|INTO PHONE)\)/i,

    // ERA HEADER DETECTION: # ERA: [NAME]
    eraHeader: /^#\s*ERA:\s*(.+)$/i,

    // Colon split: SPEAKER: DIALOGUE
    colonSplit: /^([^:]{1,30}):\s*(.+)$/
};

export class ChunkerService {

    /**
     * Parse a full screenplay text into structured chunks.
     * NOW USES AI for robust multilingual support.
     * Note: This returns a Promise now.
     */
    async parseScreenplay(text: string): Promise<ParseResult> {
        console.log('[ChunkerService] Starting fast regex-powered script parsing...');

        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        const lines = text.split(/\r?\n/);
        const allChunks: DialogueChunk[] = [];

        let globalChunkIndex = 0;
        let currentEraContext: string | undefined = undefined;
        let currentSpeaker: string | null = null;
        let currentDialogue: string[] = [];
        let currentAction: string[] = [];
        let lastActionContext: string | undefined = undefined;
        let lastDialogueContext: string | undefined = undefined;

        const flushAction = (lineNumber: number, raw: string) => {
            if (currentAction.length > 0) {
                const content = currentAction.join(' ').replace(/\s+/g, ' ').trim();
                allChunks.push({
                    type: 'action',
                    content: content,
                    lineNumber: lineNumber - currentAction.length,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: raw,
                    contextBefore: lastDialogueContext || lastActionContext
                });
                lastActionContext = content;
                currentAction = [];
            }
        };

        const flushDialogue = (lineNumber: number, raw: string) => {
            if (currentSpeaker && currentDialogue.length > 0) {
                // Remove trailing blank lines from dialogue
                while (currentDialogue.length > 0 && currentDialogue[currentDialogue.length - 1].trim() === '') {
                    currentDialogue.pop();
                }

                if (currentDialogue.length > 0) {
                    const content = currentDialogue.join(' ').replace(/\s+/g, ' ').trim();

                    // SMART CONTEXT: For dialogue, prioritize what was said before.
                    // If no dialogue before, use action context.
                    const context = lastDialogueContext
                        ? `${lastDialogueContext}${lastActionContext ? ` (Action: ${lastActionContext})` : ''}`
                        : lastActionContext;

                    allChunks.push({
                        type: 'dialogue',
                        speaker: this.normalizeCharacterName(currentSpeaker),
                        content: content,
                        lineNumber: lineNumber - currentDialogue.length,
                        chunkIndex: globalChunkIndex++,
                        era: currentEraContext,
                        raw: raw,
                        contextBefore: context
                    });

                    lastDialogueContext = `[${currentSpeaker}] ${content}`;
                    lastActionContext = undefined; // Reset action after it's been consumed by a dialogue context
                }
            }
            currentDialogue = [];
            currentSpeaker = null;
        };

        const flushAll = (lineNumber: number, raw: string) => {
            flushAction(lineNumber, raw);
            flushDialogue(lineNumber, raw);
        };

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.trim();
            const indent = rawLine.length - rawLine.trimStart().length;

            if (!line) {
                // Blank line usually ends a dialogue or action block
                flushAll(i + 1, rawLine);
                continue;
            }

            // Check ERA Header
            const eraMatch = line.match(PATTERNS.eraHeader);
            if (eraMatch) {
                currentEraContext = eraMatch[1].trim();
                continue;
            }

            // Check Scene Header
            if (PATTERNS.sceneHeader.test(line)) {
                flushAll(i + 1, rawLine);
                allChunks.push({
                    type: 'slug',
                    content: line,
                    lineNumber: i + 1,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: rawLine
                });
                continue;
            }

            // Check Transition
            if (PATTERNS.transition.test(line)) {
                flushAll(i + 1, rawLine);
                allChunks.push({
                    type: 'transition',
                    content: line,
                    lineNumber: i + 1,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: rawLine
                });
                continue;
            }

            // Check Page Break
            if (PATTERNS.pageBreak.test(line)) {
                continue;
            }

            // === LAYOUT-AWARE CHARACTER DETECTION ===
            // 1. Regex check (fallback/contextual)
            // 2. Indent check: Characters are usually deeply indented (10+ spaces) 
            //    unless it's a standard left-aligned text export.
            let isCharacterCue = false;

            // Heuristic for "Professional Margin" (e.g. Final Draft style)
            const hasCharacterIndent = indent >= 10 && indent <= 45;
            const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);

            if (!currentSpeaker) {
                // If it looks like a character and has a significant indent, it's a strong signal
                if (hasCharacterIndent && isAllCaps && line.length < 40) {
                    isCharacterCue = true;
                } else {
                    // Fallback to regex for left-aligned scripts
                    isCharacterCue = line.length > 0 && line.length <= 50 && PATTERNS.characterCue.test(line);
                }
            } else {
                // Strict check when IN dialogue
                // If the indent matches the previous speaker's indent, or is a deep indent, check it
                if (hasCharacterIndent && isAllCaps && !/[.,!?]$/.test(line)) {
                    isCharacterCue = true;
                } else {
                    const endsInColon = line.endsWith(':');
                    const endsInPunc = /[.,!?]$/.test(line.replace(/\)$/, ''));
                    isCharacterCue = line.length > 0 && line.length <= 50 && (isAllCaps || endsInColon) && !endsInPunc && !hasCharacterIndent;
                }
            }

            if (isCharacterCue) {
                flushAll(i + 1, rawLine);

                // Handle colon-style dialogue on the same line: "SPEAKER: Dialogue"
                const colonMatch = line.match(PATTERNS.colonSplit);
                if (colonMatch) {
                    currentSpeaker = this.normalizeCharacterName(colonMatch[1].trim());
                    currentDialogue.push(colonMatch[2].trim());
                } else {
                    currentSpeaker = this.normalizeCharacterName(line);
                }
                continue;
            }

            // Inside dialogue or action
            if (currentSpeaker) {
                // If we hit a line with 0 indent inside a dialogue block, it might be a transition to action
                // unless it's a left-aligned script. 
                // Heuristic: If we had indents before, and now we don't, it's action.
                if (indent === 0 && line.length > 0 && !PATTERNS.parenthetical.test(line)) {
                    // Check if previous lines were indented
                    const hadIndents = currentDialogue.length > 0;
                    if (hadIndents && !allChunks.some(c => c.type === 'dialogue' && c.raw.startsWith(currentSpeaker!))) {
                        // This is a complex case, but for now let's assume if it's 0 indent it's action
                    }
                }
                currentDialogue.push(line);
            } else {
                currentAction.push(line);
            }
        }

        // Flush any remaining dialogue or action at the end of the file
        flushAll(lines.length + 1, '');

        const dialogueChunks = allChunks.filter(c => c.type === 'dialogue');
        const characters = Array.from(new Set(allChunks.map(c => c.speaker).filter(Boolean))) as string[];

        console.log(`[ChunkerService] Fast parse complete. Found ${dialogueChunks.length} dialogue chunks from ${lines.length} lines.`);

        return {
            chunks: allChunks,
            characters,
            sceneCount: allChunks.filter(c => c.type === 'slug').length,
            stats: {
                dialogueCount: dialogueChunks.length,
                actionCount: allChunks.filter(c => c.type === 'action').length,
                avgDialogueLength: dialogueChunks.length > 0
                    ? Math.round(dialogueChunks.reduce((sum, c) => sum + c.content.length, 0) / dialogueChunks.length)
                    : 0
            }
        };
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

    /**
     * Generate a short hash for content deduplication.
     */
    generateContentHash(content: string): string {
        const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
        return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    }
}

export const chunkerService = new ChunkerService();
