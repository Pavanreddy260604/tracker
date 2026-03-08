import crypto from 'crypto';

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
    | 'other';

export interface ParsedSourceLine {
    lineNo: number;
    rawText: string;
    lineHash: string;
    lineId: string;
    isBlank: boolean;
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
}

interface DialogueContext {
    speaker: string;
    dualDialogue: boolean;
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
    stageSettingLabel: /^(?<label>SETTING|AT RISE|TIME|PLACE)\s*:\s*(?<content>.+)$/i
};

const PARSER_VERSION = 'ms-parser-v3';

export class MasterScriptParserService {
    parse(rawContent: string, scriptVersion: string): MasterScriptParseResult {
        if (!rawContent || typeof rawContent !== 'string') {
            throw new Error('Invalid script content for parsing');
        }

        const lines = rawContent.split(/\r?\n/);
        const sourceLines: ParsedSourceLine[] = [];
        const scenes: ParsedScene[] = [];
        const elements: ParsedElement[] = [];
        const characters = new Set<string>();

        let globalChunkIndex = 0;
        let sceneSeqCounter = 0;
        let currentScene = this.createScene(0, '[PRELUDE]', 1);
        let dialogueContext: DialogueContext | null = null;
        let inNoteBlock = false;
        let inBoneyard = false;

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();
            const lineNo = i + 1;
            const lineId = this.hash(`${scriptVersion}|${lineNo}|${rawLine}`).slice(0, 24);
            const lineHash = this.hash(rawLine).slice(0, 24);
            const isBlank = trimmed.length === 0;

            sourceLines.push({
                lineNo,
                rawText: rawLine,
                lineHash,
                lineId,
                isBlank
            });

            if (inBoneyard) {
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                dialogueContext = null;
                if (PATTERNS.boneyardEnd.test(trimmed)) {
                    inBoneyard = false;
                }
                continue;
            }

            if (inNoteBlock) {
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                dialogueContext = null;
                if (PATTERNS.noteEnd.test(trimmed)) {
                    inNoteBlock = false;
                }
                continue;
            }

            if (PATTERNS.pageBreak.test(trimmed)) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'other',
                        chunkType: 'other',
                        content: rawLine,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            const sceneHeading = this.extractSceneHeading(trimmed);
            if (sceneHeading) {
                if (!(currentScene.sceneSeq === 0 && currentScene.elementCount === 0 && lineNo === 1)) {
                    this.finalizeAndStoreScene(currentScene, scenes, lineNo - 1);
                }

                sceneSeqCounter += 1;
                currentScene = this.createScene(sceneSeqCounter, sceneHeading.heading, lineNo, sceneHeading.sceneNumber);
                dialogueContext = null;

                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            const designation = this.extractDesignation(trimmed);
            if (designation?.kind === 'scene') {
                if (!(currentScene.sceneSeq === 0 && currentScene.elementCount === 0 && lineNo === 1)) {
                    this.finalizeAndStoreScene(currentScene, scenes, lineNo - 1);
                }

                sceneSeqCounter += 1;
                currentScene = this.createScene(
                    sceneSeqCounter,
                    designation.content,
                    lineNo,
                    designation.sceneNumber
                );
                dialogueContext = null;

                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            if (designation?.kind === 'act') {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'designation',
                        chunkType: 'designation',
                        content: designation.content,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId],
                        nonPrinting: false
                    }
                );
                continue;
            }

            const settingLine = this.extractSettingLine(trimmed);
            if (settingLine) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'setting',
                        chunkType: 'setting',
                        content: `${settingLine.label}: ${settingLine.content}`,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            const nextLine = lines[i + 1]?.trim() || '';

            if (isBlank) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'other',
                        chunkType: 'other',
                        content: rawLine,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            if (PATTERNS.section.test(trimmed)) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            if (PATTERNS.synopsis.test(trimmed)) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            if (PATTERNS.boneyardStart.test(trimmed)) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                inBoneyard = !PATTERNS.boneyardEnd.test(trimmed);
                continue;
            }

            if (PATTERNS.noteStart.test(trimmed)) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                inNoteBlock = !PATTERNS.noteEnd.test(trimmed) && !PATTERNS.noteInline.test(trimmed);
                continue;
            }

            const centeredText = this.extractCenteredText(trimmed);
            if (centeredText) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'centered',
                        chunkType: 'centered',
                        content: centeredText,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            const transitionText = this.extractTransitionText(trimmed);
            if (transitionText) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'transition',
                        chunkType: 'transition',
                        content: transitionText,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            const forcedAction = trimmed.match(PATTERNS.forcedAction);
            if (forcedAction) {
                dialogueContext = null;
                this.appendElement(
                    currentScene,
                    elements,
                    {
                        chunkIndex: globalChunkIndex++,
                        sceneSeq: currentScene.sceneSeq,
                        elementSeq: currentScene.elementCount,
                        elementType: 'action',
                        chunkType: 'action',
                        content: forcedAction[1]?.trim() || rawLine,
                        sourceStartLine: lineNo,
                        sourceEndLine: lineNo,
                        sourceLineIds: [lineId]
                    }
                );
                continue;
            }

            const cueMatch = this.extractCharacterCue(trimmed, nextLine);
            if (cueMatch) {
                dialogueContext = {
                    speaker: cueMatch.speaker,
                    dualDialogue: cueMatch.dualDialogue
                };
                characters.add(cueMatch.speaker);
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            const colonDialogue = this.extractColonDialogue(trimmed);
            if (colonDialogue) {
                dialogueContext = {
                    speaker: colonDialogue.speaker,
                    dualDialogue: colonDialogue.dualDialogue
                };
                characters.add(colonDialogue.speaker);
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            if (dialogueContext?.speaker && PATTERNS.parenthetical.test(trimmed)) {
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            if (dialogueContext?.speaker) {
                characters.add(dialogueContext.speaker);
                this.appendElement(
                    currentScene,
                    elements,
                    {
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
                    }
                );
                continue;
            }

            dialogueContext = null;
            this.appendElement(
                currentScene,
                elements,
                {
                    chunkIndex: globalChunkIndex++,
                    sceneSeq: currentScene.sceneSeq,
                    elementSeq: currentScene.elementCount,
                    elementType: 'action',
                    chunkType: 'action',
                    content: rawLine,
                    sourceStartLine: lineNo,
                    sourceEndLine: lineNo,
                    sourceLineIds: [lineId]
                }
            );
        }

        this.finalizeAndStoreScene(currentScene, scenes, lines.length);

        return {
            parserVersion: PARSER_VERSION,
            sourceLines,
            scenes: scenes.filter(scene => scene.elementCount > 0),
            elements,
            characters: Array.from(characters)
        };
    }

    private extractSceneHeading(line: string): SceneHeadingMatch | null {
        if (!line) return null;

        let candidate = line.trim();
        let sceneNumber: string | undefined;

        const suffixMatch = candidate.match(PATTERNS.fountainSceneNumberSuffix);
        if (suffixMatch?.groups?.num) {
            sceneNumber = suffixMatch.groups.num;
            candidate = candidate.replace(PATTERNS.fountainSceneNumberSuffix, '').trim();
        }

        const numberPrefixMatch = candidate.match(PATTERNS.sceneNumberPrefix);

        if (numberPrefixMatch) {
            const possibleHeading = numberPrefixMatch.groups?.heading?.trim() || '';
            if (this.isSceneHeading(possibleHeading) || PATTERNS.forcedSceneHeading.test(possibleHeading)) {
                sceneNumber = sceneNumber || numberPrefixMatch.groups?.hash || numberPrefixMatch.groups?.num;
                candidate = possibleHeading;
            }
        }

        if (PATTERNS.forcedSceneHeading.test(candidate)) {
            return {
                heading: candidate.slice(1).trim(),
                sceneNumber
            };
        }

        if (this.isSceneHeading(candidate)) {
            return {
                heading: candidate,
                sceneNumber
            };
        }

        return null;
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
        if (
            this.isSceneHeading(line) ||
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

    private hash(input: string): string {
        return crypto.createHash('sha256').update(input).digest('hex');
    }
}

export const masterScriptParserService = new MasterScriptParserService();
export const MASTER_SCRIPT_PARSER_VERSION = PARSER_VERSION;
