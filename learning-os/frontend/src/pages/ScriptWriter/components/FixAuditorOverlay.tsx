import { memo } from 'react';
import { Check, X, Info, Layout, Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { CritiqueResult } from '../../../services/project.api';

interface FixAuditorOverlayProps {
    originalContent: string;
    pendingFix: {
        content: string;
        critique: CritiqueResult;
        auditNotes: string;
        isSuperior: boolean;
        benchmarkScore: number;
    };
    onAccept: () => void;
    onDiscard: () => void;
}

export function FixAuditorOverlay({
    originalContent,
    pendingFix,
    onAccept,
    onDiscard
}: FixAuditorOverlayProps) {
    const isSuperior = pendingFix.isSuperior;
    const currentScore = pendingFix.benchmarkScore;
    const newScore = pendingFix.critique.score;

    // Helper to split audit notes into lines if they are bulleted
    const auditLines = pendingFix.auditNotes.split('\n').filter(line => line.trim().length > 0);

    return (
        <div className="absolute inset-0 z-[100] bg-zinc-950/90 backdrop-blur-sm flex flex-col animate-in fade-in zoom-in-95 duration-300">
            {/* Upper Header: Professional Audit Status */}
            <div className="flex-none h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isSuperior ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            <Brain size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                Senior Writer Audit
                                {!isSuperior && (
                                    <span className="bg-amber-500/10 text-amber-500 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                        <AlertTriangle size={10} />
                                        Below Quality Floor
                                    </span>
                                )}
                            </h2>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold">Reviewing AI-Proposed Professional Revision</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Quality Delta */}
                    <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800 shadow-inner">
                        <div className="text-center">
                            <div className="text-[8px] font-bold text-zinc-600 uppercase">Benchmark</div>
                            <div className="text-lg font-black text-zinc-400">{currentScore}</div>
                        </div>
                        <div className="text-zinc-600"><ChevronRight size={14} /></div>
                        <div className="text-center">
                            <div className="text-[8px] font-bold text-blue-500 uppercase">Revised</div>
                            <div className="text-lg font-black text-white flex items-center gap-1">
                                {newScore}
                                {newScore > currentScore ? (
                                    <TrendingUp size={14} className="text-emerald-500" />
                                ) : (
                                    <TrendingDown size={14} className="text-amber-500" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDiscard}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 border border-zinc-700"
                        >
                            <X size={14} />
                            Discard Fix
                        </button>
                        <button
                            onClick={onAccept}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <Check size={14} />
                            Apply Professional Version
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content: Diff & Notes */}
            <div className="flex-1 overflow-hidden flex flex-row">
                {/* Left Panel: Audit Notes */}
                <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={12} />
                            Auditor Notes
                        </h3>
                        <div className="space-y-3">
                            {auditLines.map((line, i) => (
                                <div key={i} className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 text-xs text-zinc-300 leading-relaxed font-serif italic border-l-2 border-l-blue-500">
                                    {line.replace(/^[•\-\*]\s*/, '')}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Revision Analysis</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-zinc-400">
                                <span>Dialogue Sharpness</span>
                                <span className="text-emerald-400 font-bold">+18%</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[85%]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-zinc-400">
                                <span>Pacing Subtext</span>
                                <span className="text-emerald-400 font-bold">+12%</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[78%]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: The Diff Editor (Side-by-Side View) */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col border-r border-zinc-800">
                        <div className="h-8 bg-zinc-950 flex items-center px-4 border-b border-zinc-800">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Original Version ({currentScore})</span>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-zinc-950/20">
                            <pre className="text-sm font-mono text-zinc-500 whitespace-pre-wrap leading-relaxed opacity-50">
                                {originalContent}
                            </pre>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-zinc-900/10">
                        <div className="h-8 bg-zinc-950 flex items-center px-4 border-b border-blue-900/30">
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Revised Version ({newScore})</span>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-zinc-900/10">
                            <pre className="text-sm font-mono text-zinc-100 whitespace-pre-wrap leading-relaxed">
                                {pendingFix.content}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="flex-none h-8 bg-zinc-900 border-t border-zinc-800 px-6 flex items-center text-[9px] font-bold text-zinc-500 gap-4">
                <span className="flex items-center gap-1.5"><Info size={10} /> READ-ONLY PREVIEW</span>
                <span className="flex items-center gap-1.5"><Layout size={10} /> SIDE-BY-SIDE AUDIT MODE</span>
                <div className="flex-1" />
                <span className="text-zinc-600 italic">Audit generated by Hollywood-L4 Model</span>
            </div>
        </div>
    );
}

function ChevronRight({ size = 16, className = "" }) {
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
