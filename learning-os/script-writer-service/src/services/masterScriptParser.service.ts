import { extractStructuredTextFromRawContent } from '../utils/fileParser';
import type {
    ExtractedMasterScriptSource,
    MasterScriptSourceKind
} from '../types/masterScriptLayout';

export type MasterElementType =
    | 'scene'
    | 'slug'
    | 'designation'
    | 'setting'
    | 'action'
    | 'cue'
    | 'dialogue'
    | 'parenthetical'
    | 'transition'
    | 'centered'
    | 'note'
    | 'section'
    | 'synopsis'
    | 'lyrics'
    | 'other';

export interface ParsedSourceLine {
    lineNo: number;
    pageNo: number;
    pageLineNo: number;
    rawText: string;
    lineHash: string;
    lineId: string;
    isBlank: boolean;
    indentColumns: number;
    sourceKind: MasterScriptSourceKind;
    xStart?: number;
    yTop?: number;
}

export interface ParsedElement {
    chunkIndex: number;
    sceneSeq: number;
    elementSeq: number;
    elementType: Exclude<MasterElementType, 'scene'>;
    chunkType: 'slug' | 'designation' | 'setting' | 'action' | 'cue' | 'dialogue' | 'parenthetical' | 'transition' | 'centered' | 'note' | 'section' | 'synopsis' | 'other';
    speaker?: string;
    content: string;
    sourceStartLine: number;
    sourceEndLine: number;
    sourceLineIds: string[];
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
}

export interface ParsedScene {
    sceneSeq: number;
    heading: string;
    sceneNumber?: string;
    sourceStartLine: number;
    sourceEndLine: number;
    elementCount: number;
    elements: ParsedElement[];
}

export interface MasterScriptParseResult {
    parserVersion: string;
    sourceLines: ParsedSourceLine[];
    scenes: ParsedScene[];
    elements: ParsedElement[];
    characters: string[];
    titlePage: Record<string, string | string[]>;
}

interface DialogueContext {
    speaker: string;
    dualDialogue: boolean;
    cueIndentColumns: number;
}

interface SceneHeadingMatch {
    heading: string;
    sceneNumber?: string;
}

interface DesignationMatch {
    kind: 'act' | 'scene';
    content: string;
    sceneNumber?: string;
}

interface SettingMatch {
    label: string;
    content: string;
}

interface CharacterCueMatch {
    speaker: string;
    content: string;
    dualDialogue: boolean;
}

const PATTERNS = {
    transition: /^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i,
    parenthetical: /^\([^)]*\)$/,
    pageBreak: /^(CONTINUED|MORE|\(MORE\)|Page \d+|={3,}|[IVXLC]+-\d+(?:-\d+)?|\d+-\d+-\d+)$/i,
    colonSplit: /^([^:]{1,30}):\s*(.+)$/,
    sceneHeadingPrefix: /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i,
    forcedSceneHeading: /^\.[A-Za-z0-9]/,
    fountainSceneNumberSuffix: /\s+#(?<num>[A-Za-z0-9.-]+)#\s*$/,
    sceneNumberPrefix: /^(?:(?:#(?<hash>[A-Za-z0-9.-]+)#)|(?<num>\d+[A-Za-z0-9.-]*))\s+(?<heading>.+)$/i,
    forcedTransition: /^>\s*\S+/,
    genericTransition: /^[A-Z0-9 '\-\/().]+TO:\s*$/,
    centered: /^>\s*.+\s*<$/,
    forcedAction: /^!\s*(.+)$/,
    explicitCharacter: /^@\s*(.+)$/,
    dualDialogue: /\^\s*$/,
    noteInline: /^\[\[(.*)\]\]$/,
    noteStart: /^\[\[/,
    noteEnd: /\]\]\s*$/,
    boneyardStart: /^\/\*/,
    boneyardEnd: /\*\/\s*$/,
    section: /^#{1,6}\s+.+$/,
    synopsis: /^=\s*.+$/,
    actDesignation: /^(ACT\s+(?:[IVXLC]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)|PROLOGUE|EPILOGUE)\b/i,
    stageSceneDesignation: /^SCENE\s+(?<scene>[A-Za-z0-9IVXLC.-]+)\b/i,
    stageSettingLabel: /^(?<label>SETTING|AT RISE|TIME|PLACE)\s*:\s*(?<content>.+)$/i,
    lyrics: /^~\s*(.+)$/,
    titlePageKey: /^([A-Za-z ]+):\s*(.+)$/
};

const PARSER_VERSION = 'ms-parser-v4';

export class MasterScriptParserService {
    parse(source: string | ExtractedMasterScriptSource, scriptVersion: string): MasterScriptParseResult {
        if (!source || (typeof source !== 'string' && typeof source !== 'object')) {
            throw new Error('Invalid script content for parsing');
        }

        const extractedSource = typeof source === 'string'
            ? extractStructuredTextFromRawContent(source, 'raw_text')
            : source;
        const lines = extractedSource.lines.map(line => line.rawText);
        const sourceLines: ParsedSourceLine[] = extractedSource.lines.map(line => ({
            lineNo: line.lineNo,
            pageNo: line.pageNo,
            pageLineNo: line.pageLineNo,
            rawText: line.rawText,
            lineHash: line.lineHash,
            lineId: line.lineId,
            isBlank: line.isBlank,
            indentColumns: line.indentColumns,
            sourceKind: line.sourceKind,
            xStart: line.xStart,
            yTop: line.yTop
        }));
        const scenes: ParsedScene[] = [];
        const elements: ParsedElement[] = [];
        const characters = new Set<string>();

        let globalChunkIndex = 0;
        let sceneSeqCounter = 0;
        let currentScene = this.createScene(0, '[PRELUDE]', 1);
        let dialogueContext: DialogueContext | null = null;
        let inNoteBlock = false;
        let inBoneyard = false;
        const titlePage = this.buildTitlePageMetadata(sourceLines);
        const firstNonTitlePageIndex = sourceLines.findIndex(line => line.sourceKind !== 'title_page');
        const parsingStartIndex = firstNonTitlePageIndex === -1 ? sourceLines.length : firstNonTitlePageIndex;

        // 1. Include Title Page Lines in Chunks (for reconstruction/validation coverage)
        for (let i = 0; i < parsingStartIndex; i++) {
            const rawLine = lines[i];
            const lineInfo = sourceLines[i];

            this.appendElement(currentScene, elements, {
                chunkIndex: globalChunkIndex++,
                sceneSeq: currentScene.sceneSeq,
                elementSeq: currentScene.elementCount,
                elementType: 'other',
                chunkType: 'other',
                content: rawLine,
                sourceStartLine: lineInfo.lineNo,
                sourceEndLine: lineInfo.lineNo,
                sourceLineIds: [lineInfo.lineId]
            });
        }
        // 2. Element Parsing Loop
        for (let i = parsingStartIndex; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();
            const lineInfo = sourceLines[i];
            const lineNo = lineInfo.lineNo;
            const lineId = lineInfo.lineId;
            const isBlank = lineInfo.isBlank;

            // 1. Boneyard/Notes Persistence
            if (inBoneyard) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'note',
                    chunkType: 'note',
                    content: this.stripCommentSyntax(rawLine, 'boneyard'),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                dialogueContext = null;
                if (PATTERNS.boneyardEnd.test(trimmed)) inBoneyard = false;
                continue;
            }

            if (inNoteBlock) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'note',
                    chunkType: 'note',
                    content: this.stripCommentSyntax(rawLine, 'note'),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                dialogueContext = null;
                if (PATTERNS.noteEnd.test(trimmed)) inNoteBlock = false;
                continue;
            }

            // 2. Blank Lines & Page Breaks
            if (isBlank) {
                // Fountain Spec: "To force a visual blank line within Dialogue, use a line containing two spaces."
                if (rawLine === '  ' && dialogueContext?.speaker) {
                    this.appendElement(currentScene, elements, {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'dialogue',
                        chunkType: 'dialogue',
                        speaker: dialogueContext.speaker,
                        content: '  ',
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId],
                        dualDialogue: dialogueContext.dualDialogue
                    });
                    continue;
                }

                // Do NOT reset dialogue context if previous element was a character cue
                // This allows blank lines between character cue and dialogue
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'other',
                    chunkType: 'other',
                    content: rawLine,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                continue;
            }

            // More aggressive page number detection (handles "28.", "Page 28", "28", and lines with leading/trailing whitespace)
            const isPageNumber =
                lineInfo.sourceKind === 'page_marker' ||
                PATTERNS.pageBreak.test(trimmed) ||
                /^\s*\d+\.?\s*$/.test(rawLine);
            if (isPageNumber) {
                dialogueContext = null;
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'other',
                    chunkType: 'other',
                    content: rawLine,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true // Suppress from clean reader view
                });
                continue;
            }

            // 3. Explicit Fountain Markers (Forced intent)
            // Forced Scene Heading (.)
            const sceneHeading = this.extractSceneHeading(trimmed);
            if (sceneHeading) {
                if (!(currentScene.sceneSeq === 0 && currentScene.elementCount === 0 && lineNo === 1)) {
                    this.finalizeAndStoreScene(currentScene, scenes, lineNo - 1);
                }
                sceneSeqCounter += 1;
                currentScene = this.createScene(sceneSeqCounter, sceneHeading.heading, lineNo, sceneHeading.sceneNumber);
                dialogueContext = null;
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'slug',
                    chunkType: 'slug',
                    content: sceneHeading.heading,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    sceneNumber: sceneHeading.sceneNumber
                });
                continue;
            }

            // Forced Action (!)
            const forcedActionMatch = trimmed.match(PATTERNS.forcedAction);
            if (forcedActionMatch) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'action',
                    chunkType: 'action',
                    content: forcedActionMatch[1],
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            // Lyrics (~)
            const lyricsMatch = trimmed.match(PATTERNS.lyrics);
            if (lyricsMatch) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'lyrics',
                    chunkType: 'action', // fallback
                    content: lyricsMatch[1].trim(),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            // Centered (> <)
            const centeredText = this.extractCenteredText(trimmed);
            if (centeredText) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'centered',
                    chunkType: 'centered',
                    content: centeredText,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            // Forced Transition (>)
            if (PATTERNS.forcedTransition.test(trimmed)) {
                const transText = this.extractTransitionText(trimmed);
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'transition',
                    chunkType: 'transition',
                    content: transText || trimmed,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            // Non-Printing Markers
            if (PATTERNS.section.test(trimmed)) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'section',
                    chunkType: 'section',
                    content: trimmed.replace(/^#{1,6}\s*/, '').trim(),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                continue;
            }

            if (PATTERNS.synopsis.test(trimmed)) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'synopsis',
                    chunkType: 'synopsis',
                    content: trimmed.replace(/^=\s*/, '').trim(),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                continue;
            }

            if (PATTERNS.boneyardStart.test(trimmed)) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'note',
                    chunkType: 'note',
                    content: this.stripCommentSyntax(rawLine, 'boneyard'),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                inBoneyard = !PATTERNS.boneyardEnd.test(trimmed);
                continue;
            }

            if (PATTERNS.noteStart.test(trimmed)) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'note',
                    chunkType: 'note',
                    content: this.stripCommentSyntax(rawLine, 'note'),
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    nonPrinting: true
                });
                inNoteBlock = !PATTERNS.noteEnd.test(trimmed) && !PATTERNS.noteInline.test(trimmed);
                continue;
            }

            // 4. Heuristics & Unconventional
            const designation = this.extractDesignation(trimmed);
            if (designation) {
                if (designation.kind === 'scene') {
                    if (!(currentScene.sceneSeq === 0 && currentScene.elementCount === 0 && lineNo === 1)) {
                        this.finalizeAndStoreScene(currentScene, scenes, lineNo - 1);
                    }
                    sceneSeqCounter += 1;
                    currentScene = this.createScene(sceneSeqCounter, designation.content, lineNo, designation.sceneNumber);
                }
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'designation',
                    chunkType: 'designation',
                    content: designation.content,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    sceneNumber: designation.sceneNumber
                });
                dialogueContext = null;
                continue;
            }

            const settingLine = this.extractSettingLine(trimmed);
            if (settingLine) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'setting',
                    chunkType: 'setting',
                    content: `${settingLine.label}: ${settingLine.content}`,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            // Skip blank lines to find meaningful next line
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length) {
                const candidate = lines[nextLineIndex].trim();
                if (candidate.length > 0) {
                    nextLine = candidate;
                    break;
                }
                nextLineIndex++;
            }
            const cueMatch = this.extractCharacterCue(trimmed, nextLine);
            if (cueMatch) {
                dialogueContext = {
                    speaker: cueMatch.speaker,
                    dualDialogue: cueMatch.dualDialogue,
                    cueIndentColumns: lineInfo.indentColumns
                };
                characters.add(cueMatch.speaker);
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'cue',
                    chunkType: 'cue',
                    speaker: cueMatch.speaker,
                    content: cueMatch.content,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    dualDialogue: cueMatch.dualDialogue
                });
                continue;
            }

            const colonDialogue = this.extractColonDialogue(trimmed);
            if (colonDialogue) {
                dialogueContext = {
                    speaker: colonDialogue.speaker,
                    dualDialogue: colonDialogue.dualDialogue,
                    cueIndentColumns: lineInfo.indentColumns
                };
                characters.add(colonDialogue.speaker);
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'dialogue',
                    chunkType: 'dialogue',
                    speaker: colonDialogue.speaker,
                    content: colonDialogue.content,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    dualDialogue: colonDialogue.dualDialogue
                });
                continue;
            }

            const transText = this.extractTransitionText(trimmed);
            if (transText) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'transition',
                    chunkType: 'transition',
                    content: transText,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                });
                dialogueContext = null;
                continue;
            }

            if (
                dialogueContext?.speaker &&
                PATTERNS.parenthetical.test(trimmed) &&
                this.shouldTreatAsDialogueLine(rawLine, lineInfo.indentColumns, dialogueContext)
            ) {
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'parenthetical',
                    chunkType: 'parenthetical',
                    speaker: dialogueContext.speaker,
                    content: rawLine,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    dualDialogue: dialogueContext.dualDialogue
                });
                continue;
            }

            if (dialogueContext?.speaker && this.shouldTreatAsDialogueLine(rawLine, lineInfo.indentColumns, dialogueContext)) {
                characters.add(dialogueContext.speaker);
                this.appendElement(currentScene, elements, {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'dialogue',
                    chunkType: 'dialogue',
                    speaker: dialogueContext.speaker,
                    content: rawLine,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId],
                    dualDialogue: dialogueContext.dualDialogue
                });
                continue;
            }

            // 5. Fallback (Action)
            dialogueContext = null;
            this.appendElement(currentScene, elements, {
                chunkIndex: globalChunkIndex++,
                sceneSeq: currentScene.sceneSeq,
                elementSeq: currentScene.elementCount,
                elementType: 'action',
                chunkType: 'action',
                content: rawLine,
                sourceStartLine: lineNo,
                sourceEndLine: lineNo,
                sourceLineIds: [lineId]
            });
        }

        this.finalizeAndStoreScene(currentScene, scenes, lines.length);

        return {
            parserVersion: PARSER_VERSION,
            sourceLines,
            scenes: scenes.filter(scene => scene.elementCount > 0),
            elements,
            characters: Array.from(characters),
            titlePage
        };
    }

    private buildTitlePageMetadata(sourceLines: ParsedSourceLine[]): Record<string, string | string[]> {
        const titleLines = sourceLines
            .filter(line => line.sourceKind === 'title_page' && !line.isBlank)
            .map(line => line.rawText.trim())
            .filter(Boolean);

        if (titleLines.length === 0) {
            return {};
        }

        const titlePage: Record<string, string | string[]> = {
            'Title Page': titleLines
        };

        for (const line of titleLines) {
            const match = line.match(PATTERNS.titlePageKey);
            if (!match) {
                continue;
            }

            const key = match[1].trim();
            const value = match[2].trim();
            titlePage[key] = value;
        }

        if (!titlePage.Title && titleLines[0]) {
            titlePage.Title = titleLines[0];
        }

        return titlePage;
    }

    private shouldTreatAsDialogueLine(
        rawLine: string,
        indentColumns: number,
        dialogueContext: DialogueContext
    ): boolean {
        const trimmed = rawLine.trim();
        if (!trimmed) {
            return false;
        }

        const cueIndent = dialogueContext.cueIndentColumns || 0;
        if (cueIndent >= 18) {
            const minDialogueIndent = Math.max(0, cueIndent - 12);
            if (indentColumns < minDialogueIndent && !PATTERNS.parenthetical.test(trimmed)) {
                return false;
            }
        }

        const looksLikeStandaloneCue =
            trimmed === trimmed.toUpperCase() &&
            /[A-Z]/.test(trimmed) &&
            trimmed.split(/\s+/).length <= 6 &&
            !/[.!?]$/.test(trimmed);

        return !looksLikeStandaloneCue;
    }

    private extractSceneHeading(line: string): SceneHeadingMatch | null {
        if (!line) return null;

        let candidate = line.trim();
        let sceneNumber: string | undefined;
        let isForced = false;

        // 1. Strip fountain-style scene number prefixes like "#SCENE 3#" or "#123#"
        if (candidate.startsWith('#')) {
            const match = candidate.match(/^#.*?#\s*(.*)$/);
            if (match && match[1]) {
                // Extract scene number from the prefix
                const prefixMatch = candidate.match(/^#(.*?)#/);
                if (prefixMatch && prefixMatch[1]) {
                    const extractedNumber = prefixMatch[1].trim();
                    // Only use as scene number if it contains numbers (to avoid #SCENE# without number)
                    if (/[0-9]/.test(extractedNumber)) {
                        sceneNumber = extractedNumber;
                    }
                }
                candidate = match[1].trim();
            }
        }

        // 2. Handle Forced Scene Heading prefix (.)
        if (PATTERNS.forcedSceneHeading.test(candidate)) {
            isForced = true;
            candidate = candidate.slice(1).trim();
        }

        // 2. Extract Suffix Scene Number (#num#)
        const suffixMatch = candidate.match(PATTERNS.fountainSceneNumberSuffix);
        if (suffixMatch?.groups?.num) {
            sceneNumber = suffixMatch.groups.num;
            candidate = candidate.replace(PATTERNS.fountainSceneNumberSuffix, '').trim();
        }

        // 3. Extract Prefix Scene Number (e.g. "52 INT. TEMPLE")
        const numberPrefixMatch = candidate.match(PATTERNS.sceneNumberPrefix);
        if (numberPrefixMatch) {
            const possibleHeading = numberPrefixMatch.groups?.heading?.trim() || '';
            // If it follows a number with a valid slug prefix, it's a scene number
            if (this.isSceneHeading(possibleHeading) || PATTERNS.forcedSceneHeading.test(possibleHeading)) {
                sceneNumber = sceneNumber || numberPrefixMatch.groups?.hash || numberPrefixMatch.groups?.num;
                candidate = possibleHeading;
            }
        }

        // 4. Validate if this is even a scene heading
        if (!isForced && !this.isSceneHeading(candidate)) {
            return null;
        }

        // 5. Phase 4: Clean trailing digits (contamination from page nums or scene suffix)
        // e.g., "EXT. SPACE - NIGHT1" -> "EXT. SPACE - NIGHT"
        const trailingDigitMatch = candidate.match(/(.+?)\s*(\d+)$/);
        if (trailingDigitMatch) {
            const possibleNewHeading = trailingDigitMatch[1].trim();
            const trailingNum = trailingDigitMatch[2];

            // If stripping digits still leaves a valid slug, or if it matches the scene number we found
            if (this.isSceneHeading(possibleNewHeading.toUpperCase()) || trailingNum === sceneNumber) {
                candidate = possibleNewHeading;
                sceneNumber = sceneNumber || trailingNum;
            }
        }

        return {
            heading: candidate,
            sceneNumber
        };
    }

    private extractDesignation(line: string): DesignationMatch | null {
        if (!line) return null;

        if (PATTERNS.actDesignation.test(line)) {
            return {
                kind: 'act',
                content: line.trim().toUpperCase()
            };
        }

        const sceneMatch = line.match(PATTERNS.stageSceneDesignation);
        if (sceneMatch?.groups?.scene) {
            return {
                kind: 'scene',
                content: `SCENE ${sceneMatch.groups.scene.toUpperCase()}`,
                sceneNumber: sceneMatch.groups.scene.toUpperCase()
            };
        }

        return null;
    }

    private extractSettingLine(line: string): SettingMatch | null {
        const match = line.match(PATTERNS.stageSettingLabel);
        if (!match?.groups?.label || !match?.groups?.content) {
            return null;
        }

        return {
            label: match.groups.label.toUpperCase(),
            content: match.groups.content.trim()
        };
    }

    private isSceneHeading(line: string): boolean {
        return PATTERNS.sceneHeadingPrefix.test(line.trim());
    }

    private isTransition(line: string): boolean {
        return !!this.extractTransitionText(line);
    }

    private extractTransitionText(line: string): string | null {
        if (!line) return null;

        const trimmed = line.trim();
        if (PATTERNS.centered.test(trimmed)) {
            return null;
        }
        if (PATTERNS.forcedTransition.test(trimmed)) {
            return trimmed.replace(/^>\s*/, '').trim();
        }
        if (PATTERNS.transition.test(trimmed) || PATTERNS.genericTransition.test(trimmed)) {
            return trimmed;
        }
        return null;
    }

    private extractCenteredText(line: string): string | null {
        if (!PATTERNS.centered.test(line)) {
            return null;
        }

        return line.replace(/^>\s*/, '').replace(/\s*<$/, '').trim();
    }

    private createScene(sceneSeq: number, heading: string, startLine: number, sceneNumber?: string): ParsedScene {
        return {
            sceneSeq,
            heading,
            sceneNumber,
            sourceStartLine: startLine,
            sourceEndLine: startLine,
            elementCount: 0,
            elements: []
        };
    }

    private appendElement(scene: ParsedScene, all: ParsedElement[], element: ParsedElement): void {
        scene.elements.push(element);
        scene.elementCount += 1;
        scene.sourceEndLine = Math.max(scene.sourceEndLine, element.sourceEndLine);
        all.push(element);
    }

    private finalizeAndStoreScene(scene: ParsedScene, scenes: ParsedScene[], endLine: number): void {
        scene.sourceEndLine = Math.max(scene.sourceStartLine, endLine);
        scenes.push(scene);
    }

    private normalizeSpeaker(input: string): string {
        return input
            .replace(/^@\s*/g, '')
            .replace(/\^\s*$/g, '')
            .replace(/\s*\(V\.O\.\)/i, '')
            .replace(/\s*\(O\.S\.\)/i, '')
            .replace(/\s*\(CONT'D\)/i, '')
            .replace(/\s*\(CONTINUING\)/i, '')
            .replace(/\s*\(.+\)\s*$/i, '')
            .replace(/:$/, '')
            .trim();
    }

    private extractCharacterCue(line: string, nextLine: string): CharacterCueMatch | null {
        if (!line) return null;

        // First check if this could contain a scene heading by checking common prefixes
        let strippedLine = line.trim();

        // Strip fountain-style scene number prefixes like "#SCENE 3#"
        if (strippedLine.startsWith('#')) {
            const match = strippedLine.match(/^#.*?#\s*(.*)$/);
            if (match && match[1]) {
                strippedLine = match[1].trim();
            }
        }

        // If after stripping, it looks like a scene heading, return null
        if (
            this.isSceneHeading(line) ||
            this.isSceneHeading(strippedLine) ||
            PATTERNS.forcedSceneHeading.test(line) ||
            this.isTransition(line) ||
            !!this.extractDesignation(line) ||
            !!this.extractSettingLine(line) ||
            PATTERNS.parenthetical.test(line) ||
            PATTERNS.section.test(line) ||
            PATTERNS.synopsis.test(line) ||
            PATTERNS.noteStart.test(line) ||
            PATTERNS.boneyardStart.test(line) ||
            PATTERNS.centered.test(line)
        ) {
            return null;
        }

        const explicitMatch = line.match(PATTERNS.explicitCharacter);
        const explicitCandidate = explicitMatch?.[1]?.trim();
        if (explicitCandidate) {
            const dualDialogue = PATTERNS.dualDialogue.test(explicitCandidate);
            const content = explicitCandidate.replace(PATTERNS.dualDialogue, '').trim();
            return {
                speaker: this.normalizeSpeaker(content),
                content,
                dualDialogue
            };
        }

        const dualDialogue = PATTERNS.dualDialogue.test(line);
        const candidate = line.replace(PATTERNS.dualDialogue, '').trim();
        const isUppercase = candidate === candidate.toUpperCase() && /[A-Z]/.test(candidate);
        const isShort = candidate.split(/\s+/).length <= 6;
        const hasNoTerminalPunctuation = !/[.!?]$/.test(candidate);
        const nextLineLooksLikeDialogue = nextLine.length > 0 &&
            !this.isSceneHeading(nextLine) &&
            !this.isTransition(nextLine) &&
            !PATTERNS.section.test(nextLine) &&
            !PATTERNS.synopsis.test(nextLine);

        if (isUppercase && isShort && hasNoTerminalPunctuation && nextLineLooksLikeDialogue) {
            return {
                speaker: this.normalizeSpeaker(candidate),
                content: candidate,
                dualDialogue
            };
        }

        return null;
    }

    private extractColonDialogue(line: string): { speaker: string; content: string; dualDialogue: boolean } | null {
        const colonMatch = line.match(PATTERNS.colonSplit);
        if (!colonMatch) {
            return null;
        }

        const rawSpeaker = colonMatch[1]?.trim() || '';
        const dualDialogue = PATTERNS.dualDialogue.test(rawSpeaker);
        const speaker = this.normalizeSpeaker(rawSpeaker);
        const content = colonMatch[2]?.trim() || '';

        if (!speaker || !content) {
            return null;
        }

        return {
            speaker,
            content,
            dualDialogue
        };
    }

    private stripCommentSyntax(line: string, kind: 'note' | 'boneyard'): string {
        const trimmed = line.trim();
        const stripped = kind === 'note'
            ? trimmed.replace(/^\[\[/, '').replace(/\]\]\s*$/, '').trim()
            : trimmed.replace(/^\/\*/, '').replace(/\*\/\s*$/, '').trim();

        return stripped || trimmed || '[NOTE]';
    }

}

export const masterScriptParserService = new MasterScriptParserService();
export const MASTER_SCRIPT_PARSER_VERSION = PARSER_VERSION;
