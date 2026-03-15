import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, Zap, Cloud } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Utilities
// ============================================

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
        case 'Groq': return <Zap size={size} className="text-orange-400" />;
        case 'Local': return <Bot size={size} className="text-blue-400" />;
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
    // Optionally remove the citations from the text flow to keep it clean, 
    // but usually it's better to keep them if they are inland. 
    // We'll keep them for now as they are small (Source: file.txt).
    return content;
};


// ============================================
// Shared Markdown Component
// ============================================

export const AIChatMarkdown = memo(({
    content,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId
}: {
    content: string,
    isLoading?: boolean,
    isLast?: boolean,
    handleCopyCode?: (code: string, id: string) => void,
    copiedBlockId?: string | null
}) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const syntaxTheme = isDark ? vscDarkPlus : vs;

    const sources = useMemo(() => extractSources(content), [content]);

    return (
        <div className="flex flex-col gap-4">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (!inline && match) {
                            const codeId = getCodeId(codeString, match[1]);
                            return (
                                <div className="chat-code-block my-4">
                                    <div className="chat-code-toolbar flex items-center justify-between px-4 py-2 bg-console-surface-3/50 border-b border-white/5 rounded-t-xl">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary opacity-60">{match[1]}</span>
                                        {handleCopyCode && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(codeString, codeId)}
                                                className="text-[10px] font-bold text-accent-primary hover:opacity-80 transition-opacity"
                                            >
                                                {copiedBlockId === codeId ? 'Copied!' : 'Copy'}
                                            </button>
                                        )}
                                    </div>
                                    <SyntaxHighlighter
                                        style={syntaxTheme}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{ margin: 0, borderRadius: '0 0 0.75em 0.75em', padding: '16px', fontSize: '13px' }}
                                        showLineNumbers
                                        wrapLines
                                        lineNumberStyle={{
                                            color: isDark ? '#6b7280' : '#9ca3af',
                                            opacity: 0.5,
                                            minWidth: '2.5em'
                                        }}
                                        {...props}
                                    >
                                        {codeString}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }
                        return (
                            <code className={cn("px-1.5 py-0.5 rounded bg-white/10 text-accent-primary font-mono text-[0.9em]", className)} {...props}>
                                {children}
                            </code>
                        );
                    },
                    table({ children }: any) {
                        return (
                            <div className="chat-table-wrap my-4 rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-sm border-collapse">{children}</table>
                            </div>
                        );
                    },
                    th({ children }: any) {
                        return <th className="px-4 py-2 bg-white/5 text-left font-bold text-text-secondary border-b border-white/5">{children}</th>;
                    },
                    td({ children }: any) {
                        return <td className="px-4 py-2 border-b border-white/5 last:border-0">{children}</td>;
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-relaxed text-text-secondary">{children}</p>;
                    },
                    ul({ children }) {
                        return <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-accent-primary">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal pl-5 mb-4 space-y-2 marker:text-accent-primary font-bold">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="pl-1 text-text-secondary">{children}</li>;
                    }
                }}
            >
                {normalizeTables(content) + (isLast && isLoading ? ' |' : '')}
            </ReactMarkdown>

            {sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary w-full mb-1">Sources Used:</span>
                    {sources.map((source, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/5 rounded-md">
                            <Zap size={10} className="text-orange-400" />
                            <span className="text-[11px] font-medium text-text-secondary truncate max-w-[150px]">{source}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
