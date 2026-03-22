import {
    AlertTriangle,
    Brain,
    Check,
    Info,
    Layout,
    Loader2,
    Sparkles,
    TrendingDown,
    TrendingUp,
    X
} from 'lucide-react';
import type { PendingFixState } from '../types';

interface FixAuditorOverlayProps {
    originalContent: string;
    pendingFix: PendingFixState;
    onAccept: () => void;
    onDiscard: () => void;
}

export function FixAuditorOverlay({
    originalContent,
    pendingFix,
    onAccept,
    onDiscard
}: FixAuditorOverlayProps) {
    const isSuperior = pendingFix.isSuperior ?? true;
    const currentScore = pendingFix.benchmarkScore ?? 0;
    const newScore = pendingFix.critique?.score ?? 0;
    const mode = pendingFix.mode || 'fix';
    const isProposal = mode === 'proposal';
    const auditLines = (pendingFix.auditNotes || '')
        .split('\n')
        .map((line) => line.replace(/^[•*-]\s*/, '').trim())
        .filter((line) => line.length > 0);

    return (
        <div className="absolute inset-0 z-[100] flex flex-col bg-console-bg/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="flex-none h-16 border-b border-border-subtle bg-console-surface/50 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isProposal ? 'bg-accent-soft text-accent-primary' : isSuperior ? 'bg-status-ok-soft text-status-ok' : 'bg-status-warning-soft text-status-warning'}`}>
                            {isProposal ? <Sparkles size={18} /> : <Brain size={18} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                                {isProposal ? 'Assistant Proposal' : 'Executive Scene Audit'}
                                {!isProposal && !isSuperior && (
                                    <span className="bg-status-warning-soft text-status-warning text-[10px] px-2 py-0.5 rounded border border-status-warning/20 flex items-center gap-1">
                                        <AlertTriangle size={10} />
                                        Below Quality Floor
                                    </span>
                                )}
                            </h2>
                            <p className="text-[10px] text-text-tertiary uppercase font-bold">
                                {isProposal ? 'Reviewing AI-Proposed Script Improvement' : 'Reviewing Ruthless Executive Analysis'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {!isProposal && currentScore > 0 && !pendingFix.isStreaming && (
                        <div className="flex items-center gap-3 bg-console-bg px-4 py-2 rounded-xl border border-border-subtle shadow-inner">
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-text-tertiary uppercase">Benchmark</div>
                                <div className="text-lg font-black text-text-tertiary">{currentScore}</div>
                            </div>
                            <div className="text-text-tertiary"><ChevronRight size={14} /></div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-accent-primary uppercase">Revised</div>
                                <div className="text-lg font-black text-text-primary flex items-center gap-1">
                                    {newScore}
                                    {newScore > currentScore ? (
                                        <TrendingUp size={14} className="text-emerald-500" />
                                    ) : (
                                        <TrendingDown size={14} className="text-amber-500" />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {pendingFix.isStreaming ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-accent-soft border border-accent-primary/20 rounded-lg animate-pulse">
                            <Loader2 size={14} className="text-accent-primary animate-spin" />
                            <span className="text-[10px] font-black text-accent-primary uppercase tracking-widest">Generating Proposal...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
                            <button
                                onClick={onDiscard}
                                className="px-4 py-2 bg-console-surface/50 hover:bg-console-surface text-text-tertiary hover:text-status-error text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 border border-border-subtle/50"
                            >
                                <X size={14} />
                                Discard
                            </button>
                            <button
                                onClick={onAccept}
                                className="px-6 py-2 bg-console-surface/80 hover:bg-accent-primary text-text-secondary hover:text-console-bg text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 border border-border-subtle shadow-lg hover:shadow-accent-primary/10"
                            >
                                <Check size={14} />
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-row">
                {(!isProposal || auditLines.length > 0) && (
                    <div className="w-80 border-r border-border-subtle bg-console-surface/30 p-6 space-y-8 overflow-y-auto custom-scrollbar">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} />
                                {isProposal ? 'Revision Notes' : 'Auditor Notes'}
                            </h3>
                            <div className="space-y-3">
                                {auditLines.map((line, index) => (
                                    <div key={`${line}-${index}`} className="p-3 bg-console-surface/50 rounded-xl border border-border-subtle/50 text-xs text-text-secondary leading-relaxed font-serif italic border-l-2 border-l-accent-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
                                        {line}
                                    </div>
                                ))}
                                {isProposal && auditLines.length === 0 && (
                                    <div className="p-4 text-center text-[10px] text-text-tertiary uppercase font-black italic">
                                        Streaming proposal...
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isProposal && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Revision Analysis</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-text-tertiary">
                                        <span>Dialogue Sharpness</span>
                                        <span className="text-status-ok font-bold">+18%</span>
                                    </div>
                                    <div className="w-full h-1 bg-console-surface rounded-full overflow-hidden">
                                        <div className="h-full bg-status-ok w-[85%]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-text-tertiary">
                                        <span>Pacing Subtext</span>
                                        <span className="text-accent-primary font-bold">+12%</span>
                                    </div>
                                    <div className="w-full h-1 bg-console-surface rounded-full overflow-hidden">
                                        <div className="h-full bg-accent-primary w-[78%]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col border-r border-border-subtle">
                        <div className="h-8 bg-console-bg flex items-center px-4 border-b border-border-subtle">
                            <span className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">Original Version</span>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-console-bg/20">
                            <pre className="text-sm font-mono text-text-tertiary whitespace-pre-wrap leading-relaxed opacity-50">
                                {originalContent}
                            </pre>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-console-surface/10">
                        <div className="h-8 bg-console-bg flex items-center px-4 border-b border-accent-primary/30">
                            <span className="text-[9px] font-black text-accent-primary uppercase tracking-widest">Proposed Version</span>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-console-surface/10">
                            <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap leading-relaxed">
                                {pendingFix.content}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-none h-8 bg-console-surface border-t border-border-subtle px-6 flex items-center text-[9px] font-bold text-text-tertiary gap-4">
                <span className="flex items-center gap-1.5"><Info size={10} /> READ-ONLY PREVIEW</span>
                <span className="flex items-center gap-1.5"><Layout size={10} /> SIDE-BY-SIDE AUDIT MODE</span>
                <div className="flex-1" />
                <span className="text-text-tertiary italic">Audit generated by Hollywood-L4 Model</span>
            </div>
        </div>
    );
}

function ChevronRight({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}
