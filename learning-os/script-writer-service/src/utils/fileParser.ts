import crypto from 'crypto';
import * as path from 'path';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
    ExtractedMasterScriptSource,
    MasterScriptSourceFormat,
    MasterScriptSourceKind,
    MasterScriptSourceLayoutLine
} from '../types/masterScriptLayout';

interface PendingSourceLine {
    pageNo: number;
    rawText: string;
    xStart?: number;
    yTop?: number;
}

interface PdfWord {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

const LAYOUT_VERSION = 'ms-layout-v1';
const X_TO_COLUMN_RATIO = 7.4;
const PAGE_MARKER_PATTERN = /^(?:Page\s+)?-?\s*(?:\d+|[IVXLC]+(?:-\d+)?)\.?\s*-?$/i;
const SCENE_HEADING_PATTERN = /^(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
const NUMBERED_SCENE_HEADING_PATTERN = /^(?:(?:#[A-Za-z0-9.-]+#)|(?:\d+[A-Za-z0-9.-]*))\s+(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
const TRANSITION_PATTERN = /^(?:FADE IN:?|FADE OUT\.?|CUT TO:|DISSOLVE TO:|MATCH CUT TO:|SMASH CUT TO:|FADE TO BLACK\.?)$/i;
const CREDIT_PATTERN = /^(?:written by|screenplay by|story by|directed by|adapted by|based on|teleplay by|by|shooting script|first draft|revised draft|contact)\b/i;
const NOTE_PATTERN = /^(\[\[|\/\*|#{1,6}\s+|=\s*|>\s*.+\s*<)/;

function hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function computeIndentColumns(rawText: string, xStart?: number): number {
    if (typeof xStart === 'number' && Number.isFinite(xStart)) {
        return Math.max(0, Math.round(xStart / X_TO_COLUMN_RATIO));
    }
    const match = rawText.match(/^ */);
    return match ? match[0].length : 0;
}

function isPageMarker(rawText: string): boolean {
    return PAGE_MARKER_PATTERN.test(rawText.trim());
}

function isLikelyCharacterCue(rawText: string, nextMeaningfulLine: string): boolean {
    const candidate = rawText.trim();
    if (!candidate || candidate.length > 40) return false;
    if (SCENE_HEADING_PATTERN.test(candidate) || NUMBERED_SCENE_HEADING_PATTERN.test(candidate)) return false;
    if (TRANSITION_PATTERN.test(candidate)) return false;
    if (NOTE_PATTERN.test(candidate)) return false;

    const normalized = candidate.replace(/\^\s*$/, '').trim();
    const isUppercase = normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized);
    const shortEnough = normalized.split(/\s+/).length <= 6;
    const nextExists = nextMeaningfulLine.trim().length > 0;
    const nextIsNotStructure =
        !SCENE_HEADING_PATTERN.test(nextMeaningfulLine) &&
        !NUMBERED_SCENE_HEADING_PATTERN.test(nextMeaningfulLine) &&
        !TRANSITION_PATTERN.test(nextMeaningfulLine);

    return isUppercase && shortEnough && nextExists && nextIsNotStructure;
}

function isLikelyBodyStart(lines: PendingSourceLine[], index: number): boolean {
    const rawText = lines[index]?.rawText || '';
    const trimmed = rawText.trim();

    if (!trimmed || isPageMarker(trimmed)) {
        return false;
    }

    if (CREDIT_PATTERN.test(trimmed)) {
        return false;
    }

    if (
        SCENE_HEADING_PATTERN.test(trimmed) ||
        NUMBERED_SCENE_HEADING_PATTERN.test(trimmed) ||
        TRANSITION_PATTERN.test(trimmed) ||
        NOTE_PATTERN.test(trimmed) ||
        trimmed.startsWith('.') ||
        /^@\s*\S+/.test(trimmed)
    ) {
        return true;
    }

    let nextMeaningfulLine = '';
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor].rawText.trim();
        if (!candidate || isPageMarker(candidate)) {
            continue;
        }
        nextMeaningfulLine = candidate;
        break;
    }

    const looksLikeEarlyTitleLine =
        index <= 10 &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length <= 60 &&
        (
            CREDIT_PATTERN.test(nextMeaningfulLine) ||
            nextMeaningfulLine === nextMeaningfulLine.toUpperCase()
        );

    if (looksLikeEarlyTitleLine) {
        return false;
    }

    if (isLikelyCharacterCue(trimmed, nextMeaningfulLine)) {
        return true;
    }

    if (/^[^:]{1,30}:\s+.+$/.test(trimmed)) {
        return true;
    }

    const indentColumns = computeIndentColumns(rawText, lines[index].xStart);
    const looksLikeProse = /[a-z]/.test(trimmed) && trimmed.split(/\s+/).length >= 5;
    const looksLikeTitle = trimmed === trimmed.toUpperCase() && trimmed.length <= 40;

    if (looksLikeProse && !looksLikeTitle) {
        if (/[.!?:]$/.test(trimmed) || indentColumns >= 8 || trimmed.length >= 45) {
            return true;
        }
    }

    const firstNonBlankIndex = lines.findIndex(line => line.rawText.trim().length > 0 && !isPageMarker(line.rawText));
    if (index === firstNonBlankIndex && !looksLikeTitle && !CREDIT_PATTERN.test(trimmed)) {
        return true;
    }

    return false;
}

function detectBodyStartIndex(lines: PendingSourceLine[]): number {
    const firstNonBlankIndex = lines.findIndex(line => line.rawText.trim().length > 0 && !isPageMarker(line.rawText));
    if (firstNonBlankIndex === -1) {
        return 0;
    }

    for (let index = firstNonBlankIndex; index < lines.length; index += 1) {
        if (isLikelyBodyStart(lines, index)) {
            return index;
        }
    }

    return firstNonBlankIndex;
}

function detectSourceKind(lines: PendingSourceLine[], index: number, bodyStartIndex: number): MasterScriptSourceKind {
    if (isPageMarker(lines[index].rawText)) {
        return 'page_marker';
    }
    return index < bodyStartIndex ? 'title_page' : 'body';
}

function buildSourceFromPendingLines(
    sourceFormat: MasterScriptSourceFormat,
    pendingLines: PendingSourceLine[],
    pageCount: number,
    warnings: string[]
): ExtractedMasterScriptSource {
    const bodyStartIndex = detectBodyStartIndex(pendingLines);
    const pageLineCounters = new Map<number, number>();

    const lines: MasterScriptSourceLayoutLine[] = pendingLines.map((line, index) => {
        const nextPageLine = (pageLineCounters.get(line.pageNo) || 0) + 1;
        pageLineCounters.set(line.pageNo, nextPageLine);

        const sourceKind = detectSourceKind(pendingLines, index, bodyStartIndex);
        const isBlank = line.rawText.length === 0;
        const indentColumns = computeIndentColumns(line.rawText, line.xStart);
        const lineHash = hash(line.rawText).slice(0, 24);
        const lineId = hash(
            `${line.pageNo}|${nextPageLine}|${sourceKind}|${indentColumns}|${line.rawText}|${line.xStart ?? ''}|${line.yTop ?? ''}`
        ).slice(0, 24);

        return {
            lineNo: index + 1,
            pageNo: line.pageNo,
            pageLineNo: nextPageLine,
            rawText: line.rawText,
            isBlank,
            indentColumns,
            lineHash,
            lineId,
            sourceKind,
            xStart: line.xStart,
            yTop: line.yTop
        };
    });

    return {
        sourceFormat,
        layoutVersion: LAYOUT_VERSION,
        rawContent: lines.map(line => line.rawText).join('\n'),
        pageCount: Math.max(pageCount, ...lines.map(line => line.pageNo), 1),
        warnings,
        lines
    };
}

function parseTextPages(rawContent: string): PendingSourceLine[] {
    const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pages = normalized.split('\f');
    const lines: PendingSourceLine[] = [];

    pages.forEach((page, pageIndex) => {
        const pageLines = page.split('\n');
        pageLines.forEach(rawText => {
            lines.push({
                pageNo: pageIndex + 1,
                rawText
            });
        });
    });

    return lines;
}

function estimateMedian(values: number[]): number {
    const filtered = values.filter(value => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
    if (filtered.length === 0) {
        return 0;
    }
    const mid = Math.floor(filtered.length / 2);
    return filtered.length % 2 === 0
        ? (filtered[mid - 1] + filtered[mid]) / 2
        : filtered[mid];
}

function renderPdfLine(words: PdfWord[]): { rawText: string; xStart?: number; yTop?: number } {
    const sortedWords = [...words].sort((left, right) => left.x - right.x);
    let rendered = '';
    let prevRight = 0;

    sortedWords.forEach((word, index) => {
        const text = word.text.replace(/\u0000/g, '');
        if (text.length === 0) {
            return;
        }

        const targetColumn = Math.max(0, Math.round(word.x / X_TO_COLUMN_RATIO));
        if (index === 0) {
            rendered += ' '.repeat(targetColumn);
        } else if (rendered.length < targetColumn) {
            rendered += ' '.repeat(targetColumn - rendered.length);
        } else if (word.x - prevRight > 4 && !rendered.endsWith(' ')) {
            rendered += ' ';
        }

        rendered += text;
        prevRight = Math.max(prevRight, word.x + word.width);
    });

    return {
        rawText: rendered.replace(/\s+$/g, ''),
        xStart: sortedWords[0]?.x,
        yTop: sortedWords[0]?.y
    };
}

class LayoutPDFReader {
    async loadData(buffer: Buffer): Promise<ExtractedMasterScriptSource> {
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        const pendingLines: PendingSourceLine[] = [];
        const warnings: string[] = [];

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
            const page = await pdf.getPage(pageNo);
            const textContent = await page.getTextContent();
            const items = (textContent.items as any[])
                .map(item => ({
                    text: typeof item.str === 'string' ? item.str : '',
                    x: Number(item.transform?.[4] || 0),
                    y: Number(item.transform?.[5] || 0),
                    width: Number(item.width || 0),
                    height: Number(item.height || 0)
                }))
                .filter(item => item.text.length > 0);

            if (items.length === 0) {
                warnings.push(`PDF page ${pageNo} contains no text items`);
                continue;
            }

            items.sort((left, right) => {
                if (Math.abs(left.y - right.y) < 2.5) {
                    return left.x - right.x;
                }
                return right.y - left.y;
            });

            const lineGroups: PdfWord[][] = [];
            for (const item of items) {
                const currentGroup = lineGroups[lineGroups.length - 1];
                if (!currentGroup) {
                    lineGroups.push([item]);
                    continue;
                }

                const groupY = currentGroup[0]?.y ?? item.y;
                const yTolerance = Math.max(2.5, Math.min(item.height || 0, 5));
                if (Math.abs(item.y - groupY) <= yTolerance) {
                    currentGroup.push(item);
                } else {
                    lineGroups.push([item]);
                }
            }

            const linePositions = lineGroups.map(group => group[0]?.y ?? 0);
            const lineGaps = linePositions
                .slice(1)
                .map((yTop, index) => Math.abs(linePositions[index] - yTop));
            const medianGap = estimateMedian(lineGaps) || 12;

            lineGroups.forEach((group, index) => {
                if (index > 0) {
                    const previousY = lineGroups[index - 1][0]?.y ?? 0;
                    const currentY = group[0]?.y ?? 0;
                    const gap = Math.abs(previousY - currentY);
                    const blankLineCount = gap > medianGap * 1.6
                        ? Math.max(0, Math.round(gap / medianGap) - 1)
                        : 0;

                    for (let count = 0; count < blankLineCount; count += 1) {
                        pendingLines.push({
                            pageNo,
                            rawText: ''
                        });
                    }
                }

                const rendered = renderPdfLine(group);
                pendingLines.push({
                    pageNo,
                    rawText: rendered.rawText,
                    xStart: rendered.xStart,
                    yTop: rendered.yTop
                });
            });
        }

        return buildSourceFromPendingLines('pdf', pendingLines, pdf.numPages, warnings);
    }
}

export function extractStructuredTextFromRawContent(
    rawContent: string,
    sourceFormat: MasterScriptSourceFormat = 'raw_text'
): ExtractedMasterScriptSource {
    const pendingLines = parseTextPages(rawContent);
    const pageCount = Math.max(1, rawContent.split('\f').length);
    return buildSourceFromPendingLines(sourceFormat, pendingLines, pageCount, []);
}

export const extractStructuredTextFromFile = async (
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string
): Promise<ExtractedMasterScriptSource> => {
    const ext = path.extname(originalName).toLowerCase();

    try {
        if (
            mimetype === 'text/plain' ||
            mimetype === 'text/markdown' ||
            ext === '.txt' ||
            ext === '.md' ||
            ext === '.fountain' ||
            ext === '.script'
        ) {
            const rawContent = fileBuffer.toString('utf-8');
            const sourceFormat: MasterScriptSourceFormat =
                ext === '.md' ? 'md' :
                    ext === '.fountain' ? 'fountain' :
                        ext === '.script' ? 'script' :
                            ext === '.txt' ? 'txt' :
                                'raw_text';

            return extractStructuredTextFromRawContent(rawContent, sourceFormat);
        }

        if (mimetype === 'application/pdf' || ext === '.pdf') {
            const reader = new LayoutPDFReader();
            return reader.loadData(fileBuffer);
        }

        if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === '.docx'
        ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return extractStructuredTextFromRawContent(result.value, 'docx');
        }

        throw new Error(`Unsupported file type: ${mimetype || ext}. Please upload PDF, DOCX, TXT, MD, Fountain, or Script files.`);
    } catch (error: any) {
        console.error(`[FileParser] Error extracting text from ${originalName}: ${error.message}`);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
};

export const extractTextFromFile = async (
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string
): Promise<string> => {
    const extracted = await extractStructuredTextFromFile(fileBuffer, mimetype, originalName);
    return extracted.rawContent;
};

export { LAYOUT_VERSION as MASTER_SCRIPT_LAYOUT_VERSION };
