import {
    AlertTriangle,
    Brain,
    Check,
    ChevronRight as LucideChevronRight,
    Info,
    Layout,
    Loader2,
    Sparkles,
    TrendingDown,
    TrendingUp,
    X
} from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';
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

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return (
        <div className="absolute inset-0 z-[100] flex flex-col bg-console-bg/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
            <div className="flex-none h-16 border-b border-border-subtle bg-console-header/90 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isProposal ? 'bg-accent-soft text-accent-primary' : isSuperior ? 'bg-status-ok-soft text-status-ok' : 'bg-status-warning-soft text-status-warning'}`}>
                            {isProposal ? <Sparkles size={18} /> : <Brain size={18} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                                {isProposal ? 'Assistant Proposal' : 'Quality Guard Revision'}
                                {!isProposal && !isSuperior && (
                                    <span className="bg-status-warning-soft text-status-warning text-[10px] px-2 py-0.5 rounded border border-status-warning/20 flex items-center gap-1 font-bold">
                                        <AlertTriangle size={10} />
                                        Below quality gate
                                    </span>
                                )}
                            </h2>
                            <p className="text-[9px] text-text-tertiary uppercase font-black tracking-tighter">
                                {isProposal ? 'Analyzing AI-Proposed Refinements' : 'Reviewing Executive Correction Layer'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {!isProposal && currentScore > 0 && !pendingFix.isStreaming && (
                        <div className="flex items-center gap-3 bg-console-surface-2/40 px-4 py-1.5 rounded-xl border border-border-subtle/50">
                            <div className="text-center">
                                <div className="text-[7px] font-black text-text-tertiary uppercase tracking-widest">Bench</div>
                                <div className="text-sm font-black text-text-secondary">{currentScore}</div>
                            </div>
                            <div className="text-text-disabled/40"><LucideChevronRight size={12} /></div>
                            <div className="text-center">
                                <div className="text-[7px] font-black text-accent-primary uppercase tracking-widest">Revised</div>
                                <div className="text-sm font-black text-text-primary flex items-center gap-1">
                                    {newScore}
                                    {newScore > currentScore ? (
                                        <TrendingUp size={12} className="text-emerald-500" />
                                    ) : (
                                        <TrendingDown size={12} className="text-amber-500" />
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
                                className="px-5 py-2 hover:bg-status-error/10 hover:border-status-error/30 text-text-tertiary hover:text-status-error text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 border border-border-subtle/50 backdrop-blur-md"
                            >
                                <X size={14} />
                                Discard
                            </button>
                            <button
                                onClick={onAccept}
                                className="px-7 py-2 bg-accent-primary hover:bg-accent-primary-dark text-console-bg text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-accent-primary/20"
                            >
                                <Check size={14} />
                                Apply Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-row">
                {(!isProposal || auditLines.length > 0) && (
                    <div className="w-80 border-r border-border-subtle/40 bg-console-surface-2/20 p-6 space-y-8 overflow-y-auto custom-scrollbar">
                        <div className="space-y-5">
                            <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} className="text-accent-primary" />
                                {isProposal ? 'Revision Strategy' : 'Auditor Analysis'}
                            </h3>
                            <div className="space-y-4">
                                {auditLines.map((line, index) => (
                                    <div key={`${line}-${index}`} className="p-4 bg-console-surface/50 rounded-2xl border border-border-subtle/50 text-[11px] text-text-secondary leading-relaxed font-serif italic border-l-3 border-l-accent-primary shadow-sm">
                                        {line}
                                    </div>
                                ))}
                                {isProposal && auditLines.length === 0 && (
                                    <div className="p-4 text-center text-[10px] text-text-tertiary uppercase font-black italic opacity-50">
                                        Wait for notes...
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isProposal && (
                            <div className="space-y-4 pt-4 border-t border-border-subtle/20">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Growth Metrics</h3>
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-text-secondary uppercase tracking-tighter">Dialogue Sharpness</span>
                                            <span className="text-status-ok">+18%</span>
                                        </div>
                                        <div className="w-full h-1 bg-console-surface-3/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-status-ok w-[85%] rounded-full shadow-[0_0_8px_rgba(var(--status-ok-rgb),0.3)]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-text-secondary uppercase tracking-tighter">Dramatic Subtext</span>
                                            <span className="text-accent-primary">+12%</span>
                                        </div>
                                        <div className="w-full h-1 bg-console-surface-3/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-accent-primary w-[78%] rounded-full shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.3)]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 flex flex-col relative bg-console-bg">
                    <div className="flex-1 relative">
                        <DiffEditor
                            original={originalContent}
                            modified={pendingFix.content}
                            language="markdown"
                            theme={isDark ? 'vs-dark' : 'vs'}
                            options={{
                                readOnly: true,
                                renderSideBySide: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                lineNumbers: 'on',
                                wordWrap: 'on',
                                diffWordWrap: 'on',
                                automaticLayout: true,
                                scrollbar: {
                                    verticalScrollbarSize: 8,
                                    horizontalScrollbarSize: 8
                                },
                                renderOverviewRuler: false,
                                originalEditable: false,
                                diffCodeLens: true
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-none h-10 bg-console-header border-t border-border-subtle/50 px-6 flex items-center text-[10px] font-bold text-text-tertiary gap-6">
                <span className="flex items-center gap-1.5 opacity-60"><Info size={12} /> SECURE PREVIEW</span>
                <div className="h-4 w-px bg-border-subtle/30" />
                <span className="flex items-center gap-1.5 text-accent-primary"><Layout size={12} /> SYNCED COMPARISON</span>
                <div className="flex-1" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Proprietary AI Narrative Guard v2.0</span>
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
