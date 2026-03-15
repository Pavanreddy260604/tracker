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
    'PLOT_STATE_UPDATE',
    'NARRATIVE_CRAFT'
] as const;

const REWRITE_VERB_PATTERN = /\b(rewrite|redraft|edit|revise|fix|improve|tighten|change|replace|translate|transliterate|shorten|expand|cut|add|remove|rework|polish|convert|patch|make)\b/i;
const REWRITE_OBJECT_PATTERN = /\b(this|these|it|that|those|scene|script|selection|selected|line|lines|dialogue|action|passage|section)\b/i;
const STARTS_WITH_REWRITE_VERB_PATTERN = /^\s*(rewrite|redraft|edit|revise|fix|improve|tighten|change|replace|translate|transliterate|shorten|expand|cut|add|remove|rework|polish|convert|patch|make)\b/i;
const ANALYSIS_PATTERN = /\b(why|what|how|analyze|analysis|explain|weak|working|subtext|pacing|tone|structure|continuity|choice|choices|meaning|clarify|thought)\b/i;
const QUESTION_START_PATTERN = /^(why|what|how|can|could|should|would|is|are|do|does|did)\b/i;
const STABLE_PREFERENCE_PATTERN = /\b(from now on|always|default to|keep\b|prefer\b|use\b.*\bby default)\b/i;
const TRANSLITERATION_TRUE_PATTERN = /\b(transliterate|transliteration|phonetic|romanized|romanise|english letters|latin script)\b/i;
const TRANSLITERATION_FALSE_PATTERN = /\b(native script|original script|native alphabet)\b/i;
const LANGUAGE_OVERRIDE_PATTERN = /\b(?:translate|convert|write|respond|reply|answer)(?:\s+(?:this|it|the script|the scene|the dialogue|the text|my script|my scene))?(?:\s+\S+){0,6}?\s+\b(?:in|to)\s+([\p{L}][\p{L}\s\-]{1,40})/iu;
const LATIN_LANGUAGE_HINTS = new Set(['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish', 'polish', 'czech', 'slovak', 'romanian', 'hungarian', 'indonesian', 'malay', 'swahili', 'turkish', 'vietnamese']);

export type PreferenceSaveCandidate = {
    directive: string;
    updates: Partial<AssistantPreferences>;
};

export type IntentDecision = {
    intent: AssistantIntent;
    confidence: number;
};

type TransliterationDecision = {
    enabled: boolean;
    confidence: number;
    reason: 'explicit' | 'script' | 'fallback' | 'latin_language';
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

            const consecutiveBlanks = normalizedLines.length >= 2 && 
                isEffectivelyBlankLine(normalizedLines[normalizedLines.length - 1]) &&
                isEffectivelyBlankLine(normalizedLines[normalizedLines.length - 2]);

            if (consecutiveBlanks) {
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
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:STEP\\s*\\d+\\s*:\\s*)?(?:${labels.join('|')})(?:\\s*\\(JSON\\))?\\s*:?\\s*(?:\\n|$)`,
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
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]);
    const craft = extractStructuredSection(cleaned, 'NARRATIVE_CRAFT', [
        'PLOT_STATE_UPDATE'
    ]);

    return [summary, plan, craft].filter(Boolean).join('\n\n').trim();
}

export function extractStructuredAssistantSections(content: string): {
    summary?: string;
    plan?: string;
    script: string;
    craft?: string;
} {
    const summary = extractStructuredSection(content, 'STORY_CONTEXT_SUMMARY', [
        'SCENE_PLAN',
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]);
    const plan = extractStructuredSection(content, 'SCENE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]);
    const finalScriptText = extractStructuredSection(content, 'SCENE_SCRIPT', [
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]);
    const craft = extractStructuredSection(content, 'NARRATIVE_CRAFT', [
        'PLOT_STATE_UPDATE'
    ]);

    return {
        summary: summary || undefined,
        plan: plan || undefined,
        script: normalizeScreenplayWhitespace(finalScriptText) || extractBestEffortScreenplay(content),
        craft: craft || undefined
    };
}

export function classifyAssistantIntent(content: string, scope: AssistantScope, hasSelection = false): IntentDecision {
    const trimmed = content.trim();
    if (!trimmed) {
        return { intent: 'chat', confidence: 0 };
    }

    const rewriteVerb = REWRITE_VERB_PATTERN.test(trimmed);
    const languageOverride = detectLanguageOverride(trimmed);
    const startsWithRewriteVerb = STARTS_WITH_REWRITE_VERB_PATTERN.test(trimmed);
    const hasExplicitTarget = REWRITE_OBJECT_PATTERN.test(trimmed) || Boolean(languageOverride) || startsWithRewriteVerb;
    const asksQuestion = trimmed.includes('?') || QUESTION_START_PATTERN.test(trimmed);
    const asksForAnalysis = ANALYSIS_PATTERN.test(trimmed);
    const rewriteRequest = rewriteVerb && (hasExplicitTarget || (hasSelection && !asksQuestion && !asksForAnalysis));
    const isAmbiguous = rewriteRequest && asksForAnalysis;

    if (isAmbiguous) {
        return { intent: 'ambiguous', confidence: 0.35 };
    }

    // If it's a question or analysis request, default to chat unless it's clearly a rewrite ask
    if (!rewriteRequest || asksForAnalysis) {
        return { intent: 'chat', confidence: asksQuestion || asksForAnalysis ? 0.8 : 0.6 };
    }

    if (scope === 'selection' || hasSelection || /\b(selection|selected|these lines|this line|lines|dialogue block)\b/i.test(trimmed)) {
        return { intent: 'selection_edit', confidence: 0.85 };
    }

    return { intent: 'scene_edit', confidence: 0.85 };
}

export function getIntentHint(intent: AssistantIntent): string {
    switch (intent) {
        case 'selection_edit':
            return 'This looks like a local rewrite request. Tell me how you want the selection changed.';
        case 'scene_edit':
            return 'This looks like a scene rewrite request. Tell me the change you want, or say \"rewrite the scene.\"';
        case 'ambiguous':
            return 'This mixes analysis with a rewrite request. Say whether you want analysis or a rewrite.';
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

    const languageMatch = trimmed.match(/\b(?:keep|answer|respond|write|reply)(?:\s+\S+){0,6}\s+in\s+([\p{L}][\p{L}\s\-]{1,40})/iu);
    if (languageMatch) {
        const normalized = normalizeLanguageName(languageMatch[1]);
        if (normalized) {
            updates.replyLanguage = normalized;
        }
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

export function normalizeLanguageName(value: string): string {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    const stripped = cleaned.replace(/\b(script|letters|alphabet)\b/gi, '').trim();
    if (!stripped) return '';
    return stripped
        .split(' ')
        .map((part) => part.length > 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '')
        .join(' ')
        .trim();
}

export function detectLanguageOverride(prompt: string): string | null {
    const match = prompt.match(LANGUAGE_OVERRIDE_PATTERN);
    if (!match) return null;
    const normalized = normalizeLanguageName(match[1]);
    return normalized || null;
}

function resolveScriptKey(language: string): string | null {
    const normalized = language.trim().toLowerCase();
    if (!normalized) return null;
    if (LATIN_LANGUAGE_HINTS.has(normalized)) {
        return 'latin';
    }
    if (normalized.includes('telugu')) return 'telugu';
    if (normalized.includes('tamil')) return 'tamil';
    if (normalized.includes('kannada')) return 'kannada';
    if (normalized.includes('malayalam')) return 'malayalam';
    if (normalized.includes('hindi') || normalized.includes('marathi') || normalized.includes('sanskrit') || normalized.includes('nepali')) return 'devanagari';
    if (normalized.includes('bengali') || normalized.includes('bangla')) return 'bengali';
    if (normalized.includes('gujarati')) return 'gujarati';
    if (normalized.includes('punjabi') || normalized.includes('gurmukhi')) return 'gurmukhi';
    if (normalized.includes('urdu') || normalized.includes('arabic')) return 'arabic';
    if (normalized.includes('russian') || normalized.includes('cyrillic')) return 'cyrillic';
    if (normalized.includes('greek')) return 'greek';
    if (normalized.includes('japanese') || normalized.includes('hiragana') || normalized.includes('katakana')) return 'japanese';
    if (normalized.includes('chinese') || normalized.includes('mandarin') || normalized.includes('han')) return 'han';
    if (normalized.includes('korean') || normalized.includes('hangul')) return 'hangul';
    return null;
}

const SCRIPT_RANGES: Record<string, Array<[number, number]>> = {
    latin: [[0x0041, 0x005A], [0x0061, 0x007A]],
    devanagari: [[0x0900, 0x097F]],
    bengali: [[0x0980, 0x09FF]],
    gujarati: [[0x0A80, 0x0AFF]],
    gurmukhi: [[0x0A00, 0x0A7F]],
    tamil: [[0x0B80, 0x0BFF]],
    telugu: [[0x0C00, 0x0C7F]],
    kannada: [[0x0C80, 0x0CFF]],
    malayalam: [[0x0D00, 0x0D7F]],
    arabic: [[0x0600, 0x06FF]],
    cyrillic: [[0x0400, 0x04FF]],
    greek: [[0x0370, 0x03FF]],
    han: [[0x4E00, 0x9FFF]],
    japanese: [[0x3040, 0x309F], [0x30A0, 0x30FF]],
    hangul: [[0xAC00, 0xD7AF]]
};

function countRangeHits(text: string, ranges: Array<[number, number]>): number {
    let count = 0;
    for (const char of text) {
        const code = char.codePointAt(0) || 0;
        for (const [start, end] of ranges) {
            if (code >= start && code <= end) {
                count += 1;
                break;
            }
        }
    }
    return count;
}

export function detectTransliteration(prompt: string, targetLanguage: string, fallback: boolean): TransliterationDecision {
    const trimmed = prompt.trim();
    const scriptKey = resolveScriptKey(targetLanguage);

    if (scriptKey === 'latin') {
        return { enabled: false, confidence: 1, reason: 'latin_language' };
    }

    if (TRANSLITERATION_TRUE_PATTERN.test(trimmed)) {
        return { enabled: true, confidence: 0.95, reason: 'explicit' };
    }

    if (TRANSLITERATION_FALSE_PATTERN.test(trimmed)) {
        return { enabled: false, confidence: 0.95, reason: 'explicit' };
    }

    if (!scriptKey || !SCRIPT_RANGES[scriptKey]) {
        return { enabled: fallback, confidence: 0.4, reason: 'fallback' };
    }

    const sample = trimmed.normalize('NFKC');
    const nativeCount = countRangeHits(sample, SCRIPT_RANGES[scriptKey]);
    const latinCount = countRangeHits(sample, SCRIPT_RANGES.latin);

    if (nativeCount >= 6 && nativeCount >= latinCount * 0.2) {
        return { enabled: false, confidence: 0.7, reason: 'script' };
    }

    if (nativeCount >= 2 && nativeCount >= latinCount) {
        return { enabled: false, confidence: 0.75, reason: 'script' };
    }

    return { enabled: fallback, confidence: 0.4, reason: 'fallback' };
}

export function shouldOfferTransliteration(language: string): boolean {
    const scriptKey = resolveScriptKey(language);
    return Boolean(scriptKey && scriptKey !== 'latin');
}
