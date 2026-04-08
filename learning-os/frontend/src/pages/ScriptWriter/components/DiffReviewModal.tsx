import { Check, X, ArrowRight, CornerDownRight, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DiffReviewModalProps {
    isOpen: boolean;
    originalContent: string;
    newContent: string;
    onApply: () => void;
    onDiscard: () => void;
}

export function DiffReviewModal({
    isOpen,
    originalContent,
    newContent,
    onApply,
    onDiscard
}: DiffReviewModalProps) {
    if (!isOpen) return null;

    const originalLines = (originalContent || '').split('\n');
    const newLines = (newContent || '').split('\n');

    // Simple line-by-line comparison for highlighting
    // (In a production app we'd use jsdiff or similar, but for a standalone UI polish this works)
    const renderDiffLines = () => {
        const diff: { type: 'added' | 'removed' | 'unchanged', content: string }[] = [];
        let i = 0, j = 0;
        
        while (i < originalLines.length || j < newLines.length) {
            if (i < originalLines.length && j < newLines.length && originalLines[i] === newLines[j]) {
                diff.push({ type: 'unchanged', content: originalLines[i] });
                i++; j++;
            } else if (i < originalLines.length && !newLines.includes(originalLines[i])) {
                diff.push({ type: 'removed', content: originalLines[i] });
                i++;
            } else if (j < newLines.length && !originalLines.includes(newLines[j])) {
                diff.push({ type: 'added', content: newLines[j] });
                j++;
            } else {
                // Fallback for complex mismatches
                if (i < originalLines.length) {
                    diff.push({ type: 'removed', content: originalLines[i] });
                    i++;
                }
                if (j < newLines.length) {
                    diff.push({ type: 'added', content: newLines[j] });
                    j++;
                }
            }
        }
        return diff;
    };

    const diffData = renderDiffLines();

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-10"
            >
                <motion.div 
                    initial={{ scale: 0.95, y: 30 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 30 }}
                    className="flex flex-col w-full max-w-6xl h-[90vh] bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-1">
                                <div className="h-2 w-2 rounded-full bg-red-400" />
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-[12px] font-bold text-white/90 tracking-wide uppercase">Agentic Diff Review</h2>
                                <p className="text-[10px] text-white/30 font-medium">Review and authorize the proposed screenplay mutations</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onDiscard}
                                className="px-4 py-2 rounded-lg text-[11px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wider"
                            >
                                Discard
                            </button>
                            <button
                                onClick={onApply}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-[11px] font-black text-black bg-white hover:bg-emerald-400 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all uppercase tracking-widest"
                            >
                                <Check size={14} />
                                Commit Changes
                            </button>
                        </div>
                    </div>

                    {/* Diff Viewer Body */}
                    <div className="flex-1 overflow-hidden flex divide-x divide-white/5">
                        {/* Original Panel */}
                        <div className="flex-1 flex flex-col bg-[#080808] opacity-50">
                            <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] text-[9px] text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
                                <Minus size={10} className="text-red-400" /> Previous State
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 font-mono text-[12px]">
                                {originalLines.map((line, idx) => (
                                    <div key={idx} className="flex hover:bg-white/[0.02] px-4 py-0.5 group">
                                        <span className="w-10 text-right pr-4 text-white/10 select-none">{idx + 1}</span>
                                        <span className="flex-1 whitespace-pre-wrap text-white/60">{line || ' '}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proposed Panel with Highlighting */}
                        <div className="flex-[1.2] flex flex-col bg-[#0a0a0a]">
                            <div className="px-4 py-2 border-b border-emerald-500/10 bg-emerald-500/[0.05] text-[9px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                <Plus size={10} /> Proposed Revision
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 font-mono text-[12px]">
                                {diffData.map((item, idx) => (
                                    <div key={idx} className={`flex px-4 py-0.5 group ${
                                        item.type === 'added' ? 'bg-emerald-500/10' : 
                                        item.type === 'removed' ? 'bg-red-500/10' : ''
                                    }`}>
                                        <span className={`w-8 text-right pr-3 select-none ${
                                            item.type === 'added' ? 'text-emerald-400/40' : 
                                            item.type === 'removed' ? 'text-red-400/40' : 'text-white/10'
                                        }`}>
                                            {item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' '}
                                        </span>
                                        <span className={`flex-1 whitespace-pre-wrap ${
                                            item.type === 'added' ? 'text-emerald-400' : 
                                            item.type === 'removed' ? 'text-red-400 line-through opacity-50' : 'text-white/80'
                                        }`}>
                                            {item.content || ' '}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
