import {
    Activity,
    AlertTriangle,
    Check,
    ChevronRight as LucideChevronRight,
    Info,
    Layout,
    Loader2,
    Sparkles,
    TrendingDown,
    TrendingUp,
    X,
    Zap
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
        <div className="absolute inset-0 z-[100] flex flex-col bg-console-bg/98 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-700">
            <div className="flex-none h-20 border-b border-border-subtle/40 bg-console-header flex items-center justify-between px-10 relative z-[60] shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isProposal ? 'bg-accent-soft text-accent-primary' : isSuperior ? 'bg-status-ok-soft text-status-ok' : 'bg-status-warning-soft text-status-warning'} shadow-inner flex items-center justify-center`}>
                            {isProposal ? <Sparkles size={24} strokeWidth={2.5} /> : <Activity size={24} strokeWidth={2.5} />}
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-text-primary flex items-center gap-3">
                                {isProposal ? 'Revision Proposal' : 'Narrative Guard Revision'}
                                {!isProposal && !isSuperior && (
                                    <span className="bg-status-warning-soft text-status-warning text-[9px] px-3 py-1 rounded-full border border-status-warning/20 flex items-center gap-1.5 font-black uppercase">
                                        <AlertTriangle size={12} />
                                        Sub-Optimal
                                    </span>
                                )}
                            </h2>
                            <p className="text-[10px] text-text-tertiary uppercase font-black tracking-[0.1em] opacity-70">
                                {isProposal ? 'AI-Driven Enhancement Analysis' : 'Executive Correction Layer Enforced'}
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
                        <div className="flex items-center gap-3 px-6 py-2.5 bg-accent-soft/50 border border-accent-primary/20 rounded-xl animate-pulse">
                            <Loader2 size={16} className="text-accent-primary animate-spin" />
                            <span className="text-[11px] font-black text-accent-primary uppercase tracking-widest">Generating Revision...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-5 animate-in fade-in slide-in-from-right-8 duration-700">
                            <button
                                onClick={onDiscard}
                                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-console-surface transition-all active:scale-95 border border-border-subtle/30"
                            >
                                Discard
                            </button>
                            <button
                                onClick={onAccept}
                                className={`flex items-center gap-3 px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${isProposal ? 'bg-accent-primary text-white hover:bg-accent-primary-dark shadow-accent-primary/20' : 'bg-status-ok text-white hover:bg-status-ok/90 shadow-status-ok/20'}`}
                            >
                                {isProposal ? (
                                    <>
                                        <span>Apply Proposal</span>
                                        <Check size={16} strokeWidth={3} />
                                    </>
                                ) : (
                                    <>
                                        <span>Accept Fix</span>
                                        <Zap size={16} strokeWidth={3} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-row">
                {(!isProposal || auditLines.length > 0) && (
                    <div className="w-85 border-r border-border-subtle/30 bg-console-surface-2/10 p-8 space-y-10 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.25em] flex items-center gap-2.5 opacity-80">
                                <Sparkles size={14} className="text-accent-primary" />
                                {isProposal ? 'Revision Strategy' : 'Auditor Analysis'}
                            </h3>
                            <div className="space-y-4">
                                {auditLines.map((line, index) => (
                                    <div key={`${line}-${index}`} className="p-5 bg-console-surface/40 rounded-2xl border border-border-subtle/30 text-[11.5px] text-text-secondary leading-relaxed font-serif italic border-l-4 border-l-accent-primary shadow-sm hover:bg-console-surface/60 transition-colors">
                                        {line}
                                    </div>
                                ))}
                                {isProposal && auditLines.length === 0 && (
                                    <div className="p-6 text-center text-[10px] text-text-tertiary uppercase font-black italic tracking-widest opacity-40">
                                        Wait for analysis...
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isProposal && (
                            <div className="space-y-6 pt-8 border-t border-border-subtle/10">
                                <h3 className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.25em] opacity-80">Narrative Delta</h3>
                                <div className="space-y-5">
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between text-[10px] font-black tracking-widest">
                                            <span className="text-text-tertiary uppercase">Dialogue Sharpness</span>
                                            <span className="text-status-ok">+18%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-console-surface-3/30 rounded-full overflow-hidden">
                                            <div className="h-full bg-status-ok w-[85%] rounded-full shadow-[0_0_12px_rgba(var(--status-ok-rgb),0.4)]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between text-[10px] font-black tracking-widest">
                                            <span className="text-text-tertiary uppercase">Dramatic Subtext</span>
                                            <span className="text-accent-primary">+12%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-console-surface-3/30 rounded-full overflow-hidden">
                                            <div className="h-full bg-accent-primary w-[78%] rounded-full shadow-[0_0_12px_rgba(var(--accent-primary-rgb),0.4)]" />
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
