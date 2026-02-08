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

    // Character cue: ALL CAPS name, optionally with parenthetical, or Name: format
    // Must be on its own line, followed by dialogue.
    // Enhanced to support simple scripts: "Name:" "Name -" "NAME"
    characterCue: /^(([A-Z][A-Z\s\-'\.]+[A-Z])|([A-Z][a-z]+(?::|\s*-))|([A-Za-z]+:))(\s*\([\w\s\.\-']+\))?$/,

    // Parenthetical: (beat), (quietly), (V.O.), (O.S.), etc.
    parenthetical: /^\([\w\s\.\-',]+\)$/,

    // Transitions: CUT TO:, FADE OUT., DISSOLVE TO:
    transition: /^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i,

    // Page break indicators
    pageBreak: /^(CONTINUED|MORE|\(MORE\)|Page \d+)$/i,

    // Common parentheticals that indicate voice type
    voiceTypes: /\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONTINUING|PRE-LAP|FILTERED|INTO PHONE)\)/i
};

export class ChunkerService {

    /**
     * Parse a full screenplay text into structured chunks.
     */
    parseScreenplay(text: string): ParseResult {
        const lines = text.split(/\r?\n/);
        const chunks: DialogueChunk[] = [];
        const characters = new Set<string>();

        let currentSpeaker: string | null = null;
        let currentParenthetical: string | undefined = undefined;
        let currentDialogue: string[] = [];
        let chunkIndex = 0;
        let sceneCount = 0;
        let lastChunkContent = '';

        const flushDialogue = (lineNum: number) => {
            if (currentSpeaker && currentDialogue.length > 0) {
                const content = currentDialogue.join('\n').trim();
                if (content.length > 0) {
                    chunks.push({
                        type: 'dialogue',
                        content,
                        speaker: currentSpeaker,
                        parenthetical: currentParenthetical,
                        lineNumber: lineNum,
                        chunkIndex: chunkIndex++,
                        contextBefore: lastChunkContent.slice(0, 100),
                        raw: `${currentSpeaker}${currentParenthetical ? ' ' + currentParenthetical : ''}\n${content}`
                    });
                    lastChunkContent = content;
                    characters.add(currentSpeaker);
                }
            }
            currentDialogue = [];
            currentParenthetical = undefined;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const lineNum = i + 1;

            // Skip empty lines
            if (trimmed.length === 0) {
                // Empty line might end a dialogue block
                if (currentDialogue.length > 0) {
                    flushDialogue(lineNum);
                    currentSpeaker = null;
                }
                continue;
            }

            // Skip page break indicators
            if (PATTERNS.pageBreak.test(trimmed)) {
                continue;
            }

            // Scene header (slug line)
            if (PATTERNS.sceneHeader.test(trimmed)) {
                flushDialogue(lineNum);
                currentSpeaker = null;
                sceneCount++;

                chunks.push({
                    type: 'slug',
                    content: trimmed,
                    lineNumber: lineNum,
                    chunkIndex: chunkIndex++,
                    contextBefore: lastChunkContent.slice(0, 100),
                    raw: trimmed
                });
                lastChunkContent = trimmed;
                continue;
            }

            // Transition
            if (PATTERNS.transition.test(trimmed)) {
                flushDialogue(lineNum);
                currentSpeaker = null;

                chunks.push({
                    type: 'transition',
                    content: trimmed,
                    lineNumber: lineNum,
                    chunkIndex: chunkIndex++,
                    contextBefore: lastChunkContent.slice(0, 100),
                    raw: trimmed
                });
                lastChunkContent = trimmed;
                continue;
            }

            // Character cue (starts dialogue block)
            const charMatch = trimmed.match(PATTERNS.characterCue);
            if (charMatch) {
                // Flush any previous dialogue
                flushDialogue(lineNum);

                currentSpeaker = this.normalizeCharacterName(charMatch[1]);
                currentParenthetical = charMatch[2]?.trim();
                continue;
            }

            // Parenthetical within dialogue
            if (currentSpeaker && PATTERNS.parenthetical.test(trimmed)) {
                // Append parenthetical to dialogue or update current
                currentDialogue.push(trimmed);
                continue;
            }

            // If we have a current speaker, this is dialogue
            if (currentSpeaker) {
                currentDialogue.push(trimmed);
                continue;
            }

            // Otherwise it's action/description
            // Accumulate action lines until we hit something else
            const actionContent = trimmed;

            // Look ahead to see if more action follows
            let actionBlock = [actionContent];
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j].trim();
                if (nextLine.length === 0) break;
                if (PATTERNS.sceneHeader.test(nextLine)) break;
                if (PATTERNS.characterCue.test(nextLine)) break;
                if (PATTERNS.transition.test(nextLine)) break;
                actionBlock.push(nextLine);
                j++;
            }

            const fullAction = actionBlock.join(' ').trim();
            if (fullAction.length > 0) {
                chunks.push({
                    type: 'action',
                    content: fullAction,
                    lineNumber: lineNum,
                    chunkIndex: chunkIndex++,
                    contextBefore: lastChunkContent.slice(0, 100),
                    raw: actionBlock.join('\n')
                });
                lastChunkContent = fullAction;
            }

            // Skip the lines we consumed
            i = j - 1;
        }

        // Flush any remaining dialogue
        flushDialogue(lines.length);

        // Calculate stats
        const dialogueChunks = chunks.filter(c => c.type === 'dialogue');
        const actionChunks = chunks.filter(c => c.type === 'action');

        return {
            chunks,
            characters: Array.from(characters),
            sceneCount,
            stats: {
                dialogueCount: dialogueChunks.length,
                actionCount: actionChunks.length,
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
        const minLen = options?.minLength ?? 20;
        const maxLen = options?.maxLength ?? 2000;
        const charFilter = options?.characterFilter?.map(c => c.toUpperCase());

        return parseResult.chunks.filter(chunk => {
            if (chunk.type !== 'dialogue') return false;
            if (chunk.content.length < minLen) return false;
            if (chunk.content.length > maxLen) return false;
            if (charFilter && chunk.speaker && !charFilter.includes(chunk.speaker.toUpperCase())) {
                return false;
            }
            return true;
        });
    }
}

export const chunkerService = new ChunkerService();
