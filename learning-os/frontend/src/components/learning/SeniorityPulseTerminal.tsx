import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Terminal, 
    FileCode, 
    BrainCircuit, 
    Activity, 
    ChevronRight,
    Search,
    AlertTriangle,
    CheckCircle2,
    Lock,
    Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PulseRisk {
    category: string;
    detail: string;
    level: 'low' | 'medium' | 'high';
}

interface AnchorFile {
    path: string;
    importance: string;
}

interface PulseData {
    seniorityScore: number;
    seniorityLevel: string;
    risks: PulseRisk[];
    anchorFiles: AnchorFile[];
    suggestions: string[];
}

interface SeniorityPulseTerminalProps {
    data: PulseData | null;
    isAnalyzing: boolean;
    onRunAudit: () => void;
}

export const SeniorityPulseTerminal: React.FC<SeniorityPulseTerminalProps> = ({ data, isAnalyzing, onRunAudit }) => {
    const [terminalLines, setTerminalLines] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'audit' | 'files' | 'suggestions'>('audit');

    useEffect(() => {
        if (isAnalyzing) {
            setTerminalLines(['>> Initializing Seniority Pulse...', '>> Accessing System 2 Logic Core...']);
            const interval = setInterval(() => {
                const logs = [
                    '>> Scanning flow understanding blocks...',
                    '>> Cross-referencing industry elite patterns...',
                    '>> Detecting architectural blind spots...',
                    '>> Calculating seniority signature...',
                    '>> Analyzing transaction idempotency...',
                    '>> Checking for ACID compliance gaps...',
                    '>> Auditing security handshake logic...'
                ];
                setTerminalLines(prev => [...prev, logs[Math.floor(Math.random() * logs.length)]].slice(-6));
            }, 800);
            return () => clearInterval(interval);
        } else if (data) {
            setTerminalLines(['>> Audit Complete.', '>> Signature: ' + data.seniorityLevel.toUpperCase(), '>> Security Score: ' + data.seniorityScore + '%']);
        }
    }, [isAnalyzing, data]);

    return (
        <div className="bg-console-darker border border-border-subtle rounded-2xl overflow-hidden shadow-premium h-[550px] flex flex-col relative group">
            {/* Header / Top Bar */}
            <div className="bg-console-elevated border-b border-border-subtle p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent-primary/10 rounded-lg">
                        <Terminal size={18} className="text-accent-primary" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-primary">Engineering Pulse Terminal</h3>
                        <p className="text-[9px] font-bold text-text-disabled uppercase mt-0.5 tracking-[0.15em]">System 2 Logic Auditor v4.0</p>
                    </div>
                </div>
                {!data && !isAnalyzing ? (
                   <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onRunAudit}
                        className="px-4 py-2 bg-accent-primary/20 hover:bg-accent-primary/30 border border-accent-primary/30 rounded-xl text-accent-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-premium"
                   >
                       <Zap size={14} className="animate-pulse" />
                       Run Pulse Audit
                   </motion.button>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            isAnalyzing ? "bg-accent-primary animate-pulse" : "bg-status-ok"
                        )} />
                        <span className="text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                            {isAnalyzing ? 'Analyzing...' : 'Ready'}
                        </span>
                    </div>
                )}
            </div>

            {/* Terminal Log Area */}
            <div className="bg-black/40 p-3 h-28 font-mono text-[10px] space-y-1 overflow-hidden border-b border-white/5 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-console-darker/20 pointer-events-none" />
                <AnimatePresence mode="popLayout">
                    {terminalLines.map((line, i) => (
                        <motion.div
                            key={line + i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-accent-primary/70 flex items-center gap-2"
                        >
                            <ChevronRight size={10} className="text-accent-primary" />
                            {line}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!data && !isAnalyzing ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 group-hover:opacity-50 transition-opacity">
                        <BrainCircuit size={48} className="text-text-disabled" />
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-text-secondary">Awaiting Logic Ingestion</p>
                            <p className="text-[11px] text-text-disabled max-w-[250px]">Describe your module's flow to enable architectural risk scanning</p>
                        </div>
                    </div>
                ) : isAnalyzing ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-t-2 border-b-2 border-accent-primary/40 p-2"
                            >
                                <motion.div 
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-full h-full rounded-full border-l-2 border-r-2 border-accent-primary"
                                />
                            </motion.div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Activity size={24} className="text-accent-primary animate-pulse" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-accent-primary uppercase tracking-[0.2em]">Auditing Architecture...</p>
                    </div>
                ) : data ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Seniority Signature */}
                        <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest">Seniority Signature</p>
                                <h4 className={cn(
                                    "text-xl font-black italic tracking-tighter",
                                    data.seniorityLevel === 'Staff' ? "text-accent-primary" :
                                    data.seniorityLevel === 'Senior' ? "text-status-ok" :
                                    data.seniorityLevel === 'Mid' ? "text-status-warning" : "text-text-secondary"
                                )}>
                                    {data.seniorityLevel}
                                </h4>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest">Logic Consistency</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-white">{data.seniorityScore}%</span>
                                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-accent-primary transition-all duration-1000"
                                            style={{ width: `${data.seniorityScore}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-white/5 gap-6">
                            {(['audit', 'files', 'suggestions'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative",
                                        activeTab === tab ? "text-accent-primary" : "text-text-disabled hover:text-text-secondary"
                                    )}
                                >
                                    {tab}
                                    {activeTab === tab && (
                                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="space-y-4 min-h-[200px]">
                            {activeTab === 'audit' && (
                                <div className="space-y-3">
                                    {data.risks.map((risk, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex gap-4 p-3 bg-white/5 rounded-xl border border-white/5"
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg h-fit mt-1",
                                                risk.level === 'high' ? "bg-status-error/10 text-status-error" :
                                                risk.level === 'medium' ? "bg-status-warning/10 text-status-warning" : "bg-status-ok/10 text-status-ok"
                                            )}>
                                                {risk.category === 'Security' ? <Lock size={14} /> :
                                                 risk.category === 'Scalability' ? <Zap size={14} /> : <AlertTriangle size={14} />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider">{risk.category}</span>
                                                    <span className={cn(
                                                        "text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                                                        risk.level === 'high' ? "bg-status-error/20 text-status-error" : "bg-white/10 text-text-disabled"
                                                    )}>{risk.level} risk</span>
                                                </div>
                                                <p className="text-[11px] text-text-secondary leading-relaxed">{risk.detail}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'files' && (
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold text-text-disabled uppercase mb-4 flex items-center gap-2">
                                        <Search size={12} /> Predicted Architectural Anchor Points
                                    </p>
                                    {data.anchorFiles.map((file, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="group/file flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-accent-primary/30 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/5 rounded-lg group-hover/file:bg-accent-primary/10 transition-colors">
                                                    <FileCode size={14} className="text-text-disabled group-hover/file:text-accent-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-text-primary">{file.path}</p>
                                                    <p className="text-[9px] text-text-disabled">{file.importance}</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-text-disabled opacity-0 group-hover/file:opacity-100 transition-opacity" />
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'suggestions' && (
                                <div className="space-y-3">
                                    {data.suggestions.map((sug, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex gap-3 items-start p-3"
                                        >
                                            <CheckCircle2 size={14} className="text-status-ok mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-text-secondary leading-relaxed">{sug}</p>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : null}
            </div>

            {/* Bottom Status Bar */}
            <div className="bg-console-elevated border-t border-white/5 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-status-ok" />
                        <span className="text-[8px] font-black uppercase text-text-disabled tracking-widest">RAG ENGINE: READY</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                        <span className="text-[8px] font-black uppercase text-text-disabled tracking-widest">LOGIC ANALYZER: ACTIVE</span>
                    </div>
                </div>
                <span className="text-[8px] font-black text-text-disabled tracking-widest">ENCRYPTION: AES-256</span>
            </div>
        </div>
    );
};
