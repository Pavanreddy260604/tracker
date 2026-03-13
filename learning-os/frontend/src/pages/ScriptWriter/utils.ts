import type { AssistantPreferences } from '../../services/project.api';
import type { AssistantIntent, AssistantScope } from './types';

export const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

type ScreenplayLineKind = 'blank' | 'cue' | 'parenthetical' | 'dialogue' | 'slug' | 'transition' | 'action';
const STRUCTURED_SECTION_LABELS = [
    'STORY_CONTEXT_SUMMARY',
    'SCENE_PLAN',
    'SCENE_SCRIPT',
    'CHARACTER_MEMORY_UPDATE',
    'PLOT_STATE_UPDATE'
] as const;

const REWRITE_VERB_PATTERN = /\b(rewrite|redraft|edit|revise|fix|improve|tighten|change|replace|translate|transliterate|shorten|expand|cut|add|remove|rework|polish|convert|patch)\b/i;
const REWRITE_OBJECT_PATTERN = /\b(this|these|scene|script|selection|selected|line|lines|dialogue|action|passage|section)\b/i;
const ANALYSIS_PATTERN = /\b(why|what|how|analyze|analysis|explain|weak|working|subtext|pacing|tone|structure|continuity|choice|choices|meaning|clarify|thought)\b/i;
const QUESTION_START_PATTERN = /^(why|what|how|can|could|should|would|is|are|do|does|did)\b/i;
const STABLE_PREFERENCE_PATTERN = /\b(from now on|always|default to|keep\b|prefer\b|use\b.*\bby default)\b/i;

export type PreferenceSaveCandidate = {
    directive: string;
    updates: Partial<AssistantPreferences>;
};

function isIntentionalForcedBlankLine(line: string): boolean {
    return line === '  ';
}

function isEffectivelyBlankLine(line: string): boolean {
    return line.trim().length === 0;
}

function isCueLine(trimmed: string): boolean {
    const normalized = trimmed.replace(/^@\s*/, '').replace(/\^\s*$/, '').trim();
    return (
        normalized.length > 0 &&
        normalized.length <= 40 &&
        normalized === normalized.toUpperCase() &&
        /[A-Z]/.test(normalized) &&
        !/[.!?]$/.test(normalized)
    );
}

function classifyScreenplayLine(line: string, previousKind: ScreenplayLineKind | null): ScreenplayLineKind {
    const trimmed = line.trim();

    if (!trimmed) return 'blank';
    if (/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(trimmed)) {
        return 'slug';
    }
    if (/^\([^)]*\)$/.test(trimmed)) {
        return 'parenthetical';
    }
    if (/^(FADE IN:?|FADE OUT\.?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(trimmed.toUpperCase()) || trimmed.toUpperCase().endsWith(' TO:')) {
        return 'transition';
    }
    if (isCueLine(trimmed)) {
        return 'cue';
    }
    if (previousKind === 'cue' || previousKind === 'parenthetical' || previousKind === 'dialogue') {
        return 'dialogue';
    }
    return 'action';
}

function trimOuterBlankLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;

    while (start < end && isEffectivelyBlankLine(lines[start])) {
        start += 1;
    }
    while (end > start && isEffectivelyBlankLine(lines[end - 1])) {
        end -= 1;
    }

    return lines.slice(start, end);
}

export function normalizeScreenplayWhitespace(content: string): string {
    if (!content.trim()) {
        return '';
    }

    const rawLines = trimOuterBlankLines(content.replace(/\r\n?/g, '\n').split('\n'));
    const normalizedLines: string[] = [];
    let lastMeaningfulKind: ScreenplayLineKind | null = null;

    for (let index = 0; index < rawLines.length; index += 1) {
        const line = rawLines[index];

        if (isIntentionalForcedBlankLine(line)) {
            normalizedLines.push(line);
            continue;
        }

        if (isEffectivelyBlankLine(line)) {
            const nextLine = rawLines.slice(index + 1).find((candidate) => !isEffectivelyBlankLine(candidate)) ?? null;
            const nextKind = nextLine ? classifyScreenplayLine(nextLine, lastMeaningfulKind) : null;

            if (
                (lastMeaningfulKind === 'cue' && (nextKind === 'parenthetical' || nextKind === 'dialogue')) ||
                (lastMeaningfulKind === 'parenthetical' && nextKind === 'dialogue')
            ) {
                continue;
            }

            if (normalizedLines.length > 0 && isEffectivelyBlankLine(normalizedLines[normalizedLines.length - 1])) {
                continue;
            }

            normalizedLines.push('');
            continue;
        }

        lastMeaningfulKind = classifyScreenplayLine(line, lastMeaningfulKind);
        normalizedLines.push(line);
    }

    return normalizedLines.join('\n');
}

export function cleanAssistantChatResponse(content: string): string {
    return content
        .replace(/\r\n?/g, '\n')
        .replace(/^RESPONSE:\s*/i, '')
        .trim();
}

function buildStructuredSectionHeadingPattern(labels: readonly string[]): RegExp {
    return new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:${labels.join('|')})(?:\\s*\\(JSON\\))?\\s*:?\\s*(?:\\n|$)`,
        'i'
    );
}

function extractStructuredSection(content: string, label: string, nextLabels: readonly string[]): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    const startPattern = buildStructuredSectionHeadingPattern([label]);
    const startMatch = startPattern.exec(normalized);

    if (!startMatch) {
        return '';
    }

    const afterStart = normalized.slice(startMatch.index + startMatch[0].length);
    const endPattern = nextLabels.length > 0 ? buildStructuredSectionHeadingPattern(nextLabels) : null;
    const endMatch = endPattern?.exec(afterStart);
    const section = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;
    return section.trim();
}

export function hasStructuredAssistantSections(content: string): boolean {
    return buildStructuredSectionHeadingPattern(STRUCTURED_SECTION_LABELS).test(content.replace(/\r\n?/g, '\n'));
}

function stripTrailingStructuredUpdates(content: string): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    const trailingMarkerIndex = normalized.search(buildStructuredSectionHeadingPattern([
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]));
    return trailingMarkerIndex === -1 ? normalized : normalized.slice(0, trailingMarkerIndex);
}

function looksLikeScreenplayStart(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (buildStructuredSectionHeadingPattern(STRUCTURED_SECTION_LABELS).test(`\n${trimmed}\n`)) {
        return false;
    }

    if (/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(trimmed)) {
        return true;
    }

    if (/^(FADE IN:?|FADE OUT\.?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(trimmed.toUpperCase()) || trimmed.toUpperCase().endsWith(' TO:')) {
        return true;
    }

    if (trimmed.startsWith('@') || /^>\s*.+\s*<$/.test(trimmed) || trimmed.startsWith('~')) {
        return true;
    }

    return isCueLine(trimmed);
}

export function extractBestEffortScreenplay(content: string): string {
    const cleaned = stripTrailingStructuredUpdates(
        content
            .replace(/\r\n?/g, '\n')
            .replace(/^RESPONSE:\s*/i, '')
            .replace(/^REVISED SCRIPT:\s*/i, '')
            .trim()
    );

    if (!cleaned.trim()) {
        return '';
    }

    const lines = cleaned.split('\n');
    const screenplayStartIndex = lines.findIndex(looksLikeScreenplayStart);

    if (screenplayStartIndex !== -1) {
        return normalizeScreenplayWhitespace(lines.slice(screenplayStartIndex).join('\n'));
    }

    if (hasStructuredAssistantSections(cleaned)) {
        return '';
    }

    return normalizeScreenplayWhitespace(cleaned);
}

export function extractBestEffortAssistantAnswer(content: string): string {
    const cleaned = cleanAssistantChatResponse(content);
    if (!cleaned) {
        return '';
    }

    if (!hasStructuredAssistantSections(cleaned)) {
        return cleaned;
    }

    const summary = extractStructuredSection(cleaned, 'STORY_CONTEXT_SUMMARY', [
        'SCENE_PLAN',
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);
    const plan = extractStructuredSection(cleaned, 'SCENE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);

    return [summary, plan].filter(Boolean).join('\n\n').trim();
}

export function extractStructuredAssistantSections(content: string): {
    summary?: string;
    plan?: string;
    script: string;
} {
    const summary = extractStructuredSection(content, 'STORY_CONTEXT_SUMMARY', [
        'SCENE_PLAN',
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);
    const plan = extractStructuredSection(content, 'SCENE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);
    const finalScriptText = extractStructuredSection(content, 'SCENE_SCRIPT', [
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);

    return {
        summary: summary || undefined,
        plan: plan || undefined,
        script: normalizeScreenplayWhitespace(finalScriptText) || extractBestEffortScreenplay(content)
    };
}

export function classifyAssistantIntent(content: string, scope: AssistantScope, hasSelection = false): AssistantIntent {
    const trimmed = content.trim();
    if (!trimmed) {
        return 'chat';
    }

    const rewriteRequest = REWRITE_VERB_PATTERN.test(trimmed) && REWRITE_OBJECT_PATTERN.test(trimmed);
    const asksQuestion = trimmed.includes('?') || QUESTION_START_PATTERN.test(trimmed);
    const asksForAnalysis = ANALYSIS_PATTERN.test(trimmed);

    if (rewriteRequest && asksQuestion && asksForAnalysis) {
        return 'ambiguous';
    }

    if (!rewriteRequest) {
        return 'chat';
    }

    if (scope === 'selection' || hasSelection || /\b(selection|selected|these lines|this line|lines|dialogue block)\b/i.test(trimmed)) {
        return 'selection_edit';
    }

    return 'scene_edit';
}

export function getIntentHint(intent: AssistantIntent): string {
    switch (intent) {
        case 'selection_edit':
            return 'This looks like a local rewrite request. Run it in Edit mode to generate a patch or targeted replacement.';
        case 'scene_edit':
            return 'This looks like a scene rewrite request. Run it in Edit or Agent mode instead of Ask if you want drafted output.';
        case 'ambiguous':
            return 'This mixes analysis with a rewrite request. Ask mode will discuss it, while Edit or Agent will generate changes.';
        default:
            return '';
    }
}

export function detectPreferenceSaveCandidate(content: string): PreferenceSaveCandidate | null {
    const trimmed = content.trim();
    if (!trimmed || !STABLE_PREFERENCE_PATTERN.test(trimmed)) {
        return null;
    }

    const updates: Partial<AssistantPreferences> = {};
    const modeMatch = trimmed.match(/\bdefault to\s+(ask|edit|agent)\b/i);
    if (modeMatch) {
        updates.defaultMode = modeMatch[1].toLowerCase() as AssistantPreferences['defaultMode'];
    }

    const languageMatch = trimmed.match(/\b(?:keep|answer|respond|write)(?:\s+\w+){0,4}\s+in\s+(english|telugu|hindi|tamil|spanish|french)\b/i);
    if (languageMatch) {
        updates.replyLanguage = languageMatch[1];
    }

    if (/\b(use|write in|prefer)\s+(english script|transliteration|phonetic)\b/i.test(trimmed)) {
        updates.transliteration = true;
    } else if (/\b(use|write in|prefer)\s+(native script|original script)\b/i.test(trimmed)) {
        updates.transliteration = false;
    }

    return {
        directive: trimmed,
        updates
    };
}
