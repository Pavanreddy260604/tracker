import { Zap, Bot, Cloud } from 'lucide-react';

export type NormalizedChartConfig = {
    type: 'bar' | 'line' | 'area' | 'pie';
    title: string;
    data: Array<Record<string, unknown>>;
    xAxisKey: string;
    dataKey: string;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const getFirstStringKey = (row: Record<string, unknown>) =>
    Object.keys(row).find((key) => typeof row[key] === 'string');

const getFirstNumericKey = (row: Record<string, unknown>) =>
    Object.keys(row).find((key) => typeof row[key] === 'number');

export const normalizeChartConfig = (input: unknown): NormalizedChartConfig | null => {
    if (!isObjectRecord(input)) return null;

    let candidate: Record<string, unknown> = input;
    if (isObjectRecord(candidate.pieChart)) {
        candidate = {
            type: 'pie',
            title: candidate.pieChart.title,
            data: Array.isArray(candidate.pieChart.slices) ? candidate.pieChart.slices : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.barChart)) {
        candidate = {
            type: 'bar',
            title: candidate.barChart.title,
            data: Array.isArray(candidate.barChart.data) ? candidate.barChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.lineChart)) {
        candidate = {
            type: 'line',
            title: candidate.lineChart.title,
            data: Array.isArray(candidate.lineChart.data) ? candidate.lineChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.areaChart)) {
        candidate = {
            type: 'area',
            title: candidate.areaChart.title,
            data: Array.isArray(candidate.areaChart.data) ? candidate.areaChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    }

    const type = typeof candidate.type === 'string' ? candidate.type.toLowerCase() : '';
    if (!['bar', 'line', 'area', 'pie'].includes(type)) return null;

    const rawData = Array.isArray(candidate.data) ? candidate.data.filter(isObjectRecord) : [];
    if (rawData.length === 0) return null;

    const sample = rawData[0];
    const fallbackXAxisKey = type === 'pie' ? 'label' : (getFirstStringKey(sample) || 'label');
    const fallbackDataKey = getFirstNumericKey(sample) || 'value';
    const xAxisKey = typeof candidate.xAxisKey === 'string' ? candidate.xAxisKey : fallbackXAxisKey;
    const dataKey = typeof candidate.dataKey === 'string' ? candidate.dataKey : fallbackDataKey;

    const normalizedData = rawData.map((row, index) => {
        const labelValue = row[xAxisKey] ?? row.label ?? row.name ?? `Item ${index + 1}`;
        const rawMetric = row[dataKey] ?? row.value ?? row.count ?? row.amount;
        const numericMetric = typeof rawMetric === 'number' ? rawMetric : Number(rawMetric);

        if (!Number.isFinite(numericMetric)) {
            return null;
        }

        return {
            ...row,
            [xAxisKey]: typeof labelValue === 'string' ? labelValue : String(labelValue),
            [dataKey]: numericMetric
        };
    }).filter((row): row is Record<string, unknown> => Boolean(row));

    if (normalizedData.length === 0) return null;

    return {
        type: type as NormalizedChartConfig['type'],
        title: typeof candidate.title === 'string' && candidate.title.trim()
            ? candidate.title.trim()
            : 'Data Visualization',
        data: normalizedData,
        xAxisKey,
        dataKey
    };
};

export const normalizeTables = (text: string) => {
    const lines = text.split('\n');
    const normalized: string[] = [];

    for (const line of lines) {
        const hasTableMarker = /\|\s*:?-{3,}/.test(line);
        const hasRowBreaks = /\|\s+\|/.test(line);
        if (hasTableMarker && hasRowBreaks) {
            const firstPipe = line.indexOf('|');
            if (firstPipe > 0) {
                const prefix = line.slice(0, firstPipe).trim();
                if (prefix) normalized.push(prefix);
            }
            let tablePart = firstPipe >= 0 ? line.slice(firstPipe) : line;
            tablePart = tablePart.replace(/\|\s+\|/g, '|\n|');
            normalized.push(tablePart);
        } else {
            normalized.push(line);
        }
    }

    return normalized.join('\n');
};

export const getCodeId = (code: string, lang?: string) => {
    const seed = `${lang || 'text'}:${code.length}:${code.slice(0, 24)}`;
    return seed.replace(/\s+/g, '-');
};

export const getProviderIcon = (provider?: string, size = 14) => {
    switch (provider) {
        case 'Groq': return <Zap size={size} className="text-status-warning" />;
        case 'Local': return <Bot size={size} className="text-accent-primary" />;
        default: return <Cloud size={size} className="text-accent-primary" />;
    }
};

export const extractSources = (content: string) => {
    const sources = new Set<string>();
    // Match (Source: <filename>) or (Knowledge Base: <title>)
    const matches = content.matchAll(/\((Source|Knowledge Base): ([^)]+)\)/g);
    for (const match of matches) {
        sources.add(match[2].trim());
    }
    return Array.from(sources);
};

export const cleanContent = (content: string) => {
    return content
        .replace(/__PROGRESS__:.*\n?/g, '')
        .replace(/\[REPO_CARD:[\s\S]*?\]/g, '')
        .trim();
};

export const extractProgress = (content: string) => {
    const lines = content.split('\n');
    const progress: string[] = [];
    for (const line of lines) {
        if (line.startsWith('__PROGRESS__:')) {
            progress.push(line.replace('__PROGRESS__:', '').trim());
        }
    }
    return progress;
};

export const robustParseJSON = (text: string) => {
    let cleaned = text.trim().replace(/\s*\|$/, '');
    try {
        // 2. Extract common JSON structures if surrounded by text
        const braceStart = cleaned.indexOf('{');
        const braceEnd = cleaned.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
            cleaned = cleaned.slice(braceStart, braceEnd + 1);
        }

        // 3. Remove trailing commas before closing braces/brackets
        const finalJson = cleaned.replace(/,\s*([}\]])/g, '$1');

        return JSON.parse(finalJson);
    } catch (e) {
        // Fallback for very simple cases if parsing still fails
        try {
            // Try to wrap keys in quotes if they are missing (common in some LLMs)
            const looseJson = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            return JSON.parse(looseJson);
        } catch {
            throw e;
        }
    }
};
export const extractRepoCardData = (content: string) => {
    const match = content.match(/\[REPO_CARD:([\s\S]*?)\]/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
};
