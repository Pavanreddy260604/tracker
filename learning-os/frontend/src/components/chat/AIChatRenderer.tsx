import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
} from 'recharts';
import { 
    Bot, Zap, Cloud, BarChart2, PieChart as PieIcon, TrendingUp, Activity,
    ShieldCheck, CheckCircle2, Circle, Loader2, Cpu
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AI_MODELS } from '../../contexts/AIContext';
import { 
    normalizeTables, 
    getCodeId, 
    getProviderIcon, 
    extractSources, 
    cleanContent, 
    extractProgress,
    robustParseJSON,
    normalizeChartConfig,
    extractRepoCardData
} from './ChatUtils';

// Utils moved to ChatUtils.tsx

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

const DynamicChart = ({ config }: { config: any }) => {
    const title = config.title || 'Data Visualization';
    const type = config.type || 'bar';
    const data = config.data || [];
    const xAxisKey = config.xAxisKey || 'label';
    const dataKey = config.dataKey || 'value';

    const renderChart = () => {
        switch (type?.toLowerCase()) {
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey={dataKey}
                        >
                            {data.map((_: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                );
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--console-surface-3)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey={dataKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                );
            case 'area':
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--console-surface-3)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey={dataKey} stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                    </AreaChart>
                );
            case 'bar':
            default:
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--console-surface-3)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                );
        }
    };

    const getIcon = () => {
        switch (type?.toLowerCase()) {
            case 'pie': return <PieIcon size={14} />;
            case 'line': return <Activity size={14} />;
            case 'area': return <TrendingUp size={14} />;
            default: return <BarChart2 size={14} />;
        }
    };

    return (
        <div className="my-6 p-4 rounded-2xl bg-console-surface-2 border border-border-subtle shadow-premium animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-2 mb-4 opacity-70">
                <div className="p-1.5 rounded-lg bg-accent-primary/10 text-accent-primary">
                    {getIcon()}
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-text-primary">{title || 'Data Visualization'}</h4>
            </div>
            <div className="h-[240px] w-full min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    {renderChart()}
                </ResponsiveContainer>
            </div>
            {type === 'pie' && (
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {data.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="text-[9px] font-bold uppercase tracking-tight text-text-secondary">{item[xAxisKey]}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RepoCard = ({ data }: { data: any }) => {
    if (!data) return null;
    return (
        <div className="my-6 p-5 rounded-2xl bg-console-surface-3 border border-border-subtle shadow-premium animate-in fade-in zoom-in duration-500 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-text-primary group-hover:opacity-[0.05] transition-opacity">
                <Bot size={120} />
            </div>
            
            <div className="flex items-start justify-between mb-6 relative">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-accent-primary/10 text-accent-primary shadow-inner">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-black uppercase tracking-[0.15em] text-text-primary truncate max-w-[200px]">
                            {data.repo || 'Repository'}
                        </h3>
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest opacity-60">
                            {data.owner || 'GitHub'} • {data.defaultBranch || 'main'}
                        </p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-status-success/10 border border-status-success/20 text-status-success text-[9px] font-black uppercase tracking-widest">
                    Verified Repo
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 relative">
                {[
                    { label: 'Files Scanned', value: data.fileCount || 0, sub: 'Prioritized' },
                    { label: 'Hierarchy', value: data.structureSize || 0, sub: 'Nodes' },
                    { label: 'Health', value: 'A+', sub: 'Technical' }
                ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-xl bg-console-surface-2 border border-border-subtle/50 text-center">
                        <div className="text-[16px] font-black text-text-primary tracking-tight">{stat.value}</div>
                        <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-tighter opacity-60">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-subtle relative">
                <div className="flex gap-1.5">
                    {['TypeScript', 'Node.js', 'React'].map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-accent-primary/5 text-accent-primary/60 text-[8px] font-bold uppercase tracking-widest border border-accent-primary/10">
                            {tag}
                        </span>
                    ))}
                </div>
                <span className="text-[9px] font-black text-accent-primary uppercase tracking-widest cursor-default hover:opacity-80 transition-opacity">
                    Deep Audit Complete
                </span>
            </div>
        </div>
    );
};


// ============================================
// Shared Markdown Component
// ============================================

const ToolProgressStatus = ({ progress }: { progress: string[] }) => {
    if (progress.length === 0) return null;

    // Parse the latest structured progress: __PROGRESS__:TOOL:ACTION
    const lastStep = progress[progress.length - 1];
    const parts = lastStep.split(':');
    const tool = parts[1] || 'SYSTEM';
    const action = parts[2] || parts[1] || 'Processing...';

    const getToolIcon = (t: string) => {
        switch (t.toUpperCase()) {
            case 'SEARCHING': return <Cloud size={20} />;
            case 'ANALYZING': return <TrendingUp size={20} />;
            case 'FETCHING': return <Bot size={20} />;
            case 'SCRAPING': return <BarChart2 size={20} />;
            default: return <ShieldCheck size={20} />;
        }
    };

    const getToolLabel = (t: string) => {
        switch (t.toUpperCase()) {
            case 'SEARCHING': return 'Knowledge Discovery';
            case 'ANALYZING': return 'Data Intelligence';
            case 'FETCHING': return 'Repository Deep-Dive';
            case 'SCRAPING': return 'Web Intelligence';
            default: return 'Architectural Audit';
        }
    };

    return (
        <div className="my-6 p-5 rounded-2xl bg-console-surface-2 border border-accent-primary/20 shadow-premium animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-accent-primary/10 text-accent-primary animate-pulse">
                    {getToolIcon(tool)}
                </div>
                <div>
                    <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-text-primary">{getToolLabel(tool)}</h4>
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider opacity-60">
                        {tool === 'SYSTEM' ? 'Staff Engineer Pipeline Active' : `Active Tool: ${tool}`}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {progress.slice(-5).map((step, idx) => {
                    const isLast = idx === Math.min(progress.length, 5) - 1;
                    const displayMsg = step.split(':').pop() || step;
                    
                    return (
                        <div key={idx} className={cn(
                            "flex items-center gap-3 transition-opacity duration-300",
                            !isLast ? "opacity-60" : "opacity-100"
                        )}>
                            {isLast ? (
                                <Loader2 size={14} className="text-accent-primary animate-spin" />
                            ) : (
                                <CheckCircle2 size={14} className="text-green-500" />
                            )}
                            <span className={cn(
                                "text-[11px] font-bold tracking-tight uppercase",
                                isLast ? "text-accent-primary" : "text-text-secondary"
                            )}>
                                {displayMsg}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cpu size={12} className="text-text-tertiary opacity-40" />
                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest opacity-40">System Analyzing Patterns...</span>
                </div>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full bg-accent-primary opacity-20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const AIChatMarkdown = memo(({
    content,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId,
    modelUsed
}: {
    content: string,
    isLoading?: boolean,
    isLast?: boolean,
    handleCopyCode?: (code: string, id: string) => void,
    copiedBlockId?: string | null,
    modelUsed?: string
}) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const syntaxTheme = isDark ? vscDarkPlus : vs;

    const sources = useMemo(() => extractSources(content), [content]);
    const progress = useMemo(() => extractProgress(content), [content]);
    const repoCardData = useMemo(() => extractRepoCardData(content), [content]);

    return (
        <div className="flex flex-col gap-4">
            {isLast && isLoading && progress.length > 0 && (
                <ToolProgressStatus progress={progress} />
            )}
            {repoCardData && <RepoCard data={repoCardData} />}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (!inline && match) {
                            const isChartLikeJson = match[1] === 'chart' || (
                                match[1] === 'json' &&
                                /"(pieChart|barChart|lineChart|areaChart|type)"\s*:/.test(codeString)
                            );

                            if (isChartLikeJson) {
                                try {
                                    // Delay rendering until NOT loading to ensure we have the full response
                                    if (isLoading) {
                                        return (
                                            <div className="my-6 p-4 rounded-2xl bg-console-surface-2 border border-border-subtle shadow-premium animate-pulse">
                                                <div className="flex items-center gap-2 mb-4 opacity-50">
                                                    <div className="w-6 h-6 rounded bg-accent-primary/20" />
                                                    <div className="h-3 w-32 bg-text-primary/20 rounded-full" />
                                                </div>
                                                <div className="h-[240px] w-full bg-accent-primary/5 rounded-xl flex items-center justify-center">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-primary opacity-60">Preparing visualization...</span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const parsed = robustParseJSON(codeString);
                                    const config = normalizeChartConfig(parsed);
                                    if (!config) {
                                        throw new Error('Unsupported chart schema');
                                    }
                                    return <DynamicChart config={config} />;
                                } catch (e) {
                                    if (match[1] === 'chart') {
                                        return (
                                            <div className="my-4 space-y-2">
                                                <div className="p-3 text-xs text-status-warning bg-status-warning/10 border border-status-warning/20 rounded-lg">
                                                    Chart unavailable. The model returned an unsupported chart schema, so the raw chart payload is shown below.
                                                </div>
                                                <SyntaxHighlighter
                                                    style={syntaxTheme}
                                                    language="json"
                                                    PreTag="div"
                                                    customStyle={{ margin: 0, borderRadius: '0.75em', padding: '16px', fontSize: '13px' }}
                                                    showLineNumbers
                                                    wrapLines
                                                    lineNumberStyle={{
                                                        color: isDark ? '#6b7280' : '#9ca3af',
                                                        opacity: 0.5,
                                                        minWidth: '2.5em'
                                                    }}
                                                >
                                                    {codeString}
                                                </SyntaxHighlighter>
                                            </div>
                                        );
                                    }
                                    // Fall through to regular SyntaxHighlighter for 'json'
                                }
                            }
                            const codeId = getCodeId(codeString, match[1]);
                            return (
                                <div className="chat-code-block my-4">
                                    <div className="chat-code-toolbar flex items-center justify-between px-4 py-2 bg-console-surface-3/50 border-b border-border-subtle rounded-t-xl">
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
                            <code className={cn("px-1.5 py-0.5 rounded bg-accent-primary/10 text-accent-primary font-mono text-[0.9em]", className)} {...props}>
                                {children}
                            </code>
                        );
                    },
                    table({ children }: any) {
                        return (
                            <div className="chat-table-wrap my-4 rounded-xl border border-border-subtle overflow-hidden">
                                <table className="w-full text-sm border-collapse">{children}</table>
                            </div>
                        );
                    },
                    th({ children }: any) {
                        return <th className="px-4 py-2 bg-console-surface text-left font-bold text-text-secondary border-b border-border-subtle">{children}</th>;
                    },
                    td({ children }: any) {
                        return <td className="px-4 py-2 border-b border-border-subtle last:border-0">{children}</td>;
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
                {normalizeTables(cleanContent(content)) + (isLast && isLoading ? ' |' : '')}
            </ReactMarkdown>

            {sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-border-subtle">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary w-full mb-1">Sources Used:</span>
                    {sources.map((source, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-console-surface border border-border-subtle rounded-md">
                            <Zap size={10} className="text-status-warning" />
                            <span className="text-[11px] font-medium text-text-secondary truncate max-w-[150px]">{source}</span>
                        </div>
                    ))}
                </div>
            )}

            {modelUsed && (
                <div className="flex items-center gap-1.5 mt-2 opacity-40 hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">Generated by</span>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border-subtle/50 bg-console-surface text-[9px] font-bold text-accent-primary">
                        {getProviderIcon(AI_MODELS.find(m => m.id === modelUsed || m.id === `groq:${modelUsed}`)?.provider || 'Local', 10)}
                        {AI_MODELS.find(m => m.id === modelUsed || m.id === `groq:${modelUsed}`)?.name || modelUsed}
                    </div>
                </div>
            )}
        </div>
    );
});
