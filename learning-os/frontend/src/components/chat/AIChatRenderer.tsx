import { memo } from 'react';
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

    return (
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
    );
});
