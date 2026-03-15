import { Sparkles, Copy, Loader2, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Bible } from '../../services/project.api';
import type { ScriptTemplates } from '../../services/scriptWriter.api';

interface GeneratorPanelProps {
    activeProject: Bible | null;
    scriptTemplates: ScriptTemplates | null;
    scriptIdea: string;
    onScriptIdeaChange: (value: string) => void;
    scriptFormat: string;
    onScriptFormatChange: (value: string) => void;
    scriptStyle: string;
    onScriptStyleChange: (value: string) => void;
    scriptOutput: string;
    onGenerateScript: () => void;
    isScriptGenerating: boolean;
    speedMode: boolean;
    onSpeedModeChange: (value: boolean) => void;
}

export function GeneratorPanel({
    activeProject,
    scriptTemplates,
    scriptIdea,
    onScriptIdeaChange,
    scriptFormat,
    onScriptFormatChange,
    scriptStyle,
    onScriptStyleChange,
    scriptOutput,
    onGenerateScript,
    isScriptGenerating,
    speedMode,
    onSpeedModeChange,
}: GeneratorPanelProps) {
    const [showOutput, setShowOutput] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);
    const outputVisible = showOutput || isScriptGenerating || Boolean(scriptOutput);

    // Auto-scroll output to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [scriptOutput]);

    if (!activeProject) {
        return <div className="p-4 text-zinc-500">Select a project to generate.</div>;
    }

    return (
        <div className="generator-panel space-y-4">
            {/* Input Section */}
            <div className="ide-card bg-zinc-800/50 p-3 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-2 mb-3 text-blue-400 font-medium">
                    {isScriptGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    <span>AI Assistant</span>
                </div>

                <div className="ide-field">
                    <label className="ide-label">Story Idea / Prompt</label>
                    <textarea
                        className="ide-textarea"
                        rows={5}
                        value={scriptIdea}
                        onChange={(e) => onScriptIdeaChange(e.target.value)}
                        placeholder="Describe the scene..."
                    />
                </div>

                <div className="space-y-4 mb-6">
                    <div className="ide-field">
                        <label className="ide-label flex items-center gap-2">
                            <FileText size={12} className="text-zinc-500" /> Project Format
                        </label>
                        <select className="ide-select" value={scriptFormat} onChange={e => onScriptFormatChange(e.target.value)}>
                            {(scriptTemplates?.formats || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="ide-field">
                        <label className="ide-label flex items-center gap-2">
                            <Sparkles size={12} className="text-purple-500" /> Creative Style
                        </label>
                        <select className="ide-select" value={scriptStyle} onChange={e => onScriptStyleChange(e.target.value)}>
                            {(scriptTemplates?.styles || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Speed Mode Toggle */}
                <div className="flex items-center justify-between mb-4 p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
                    <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${speedMode ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                            <Sparkles size={12} className={speedMode ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold text-blue-400 uppercase tracking-tight">Lightning Speed</div>
                            <div className="text-[9px] text-zinc-400">Bypass RAG & Optimize AI</div>
                        </div>
                    </div>
                    <button 
                        onClick={() => onSpeedModeChange(!speedMode)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${speedMode ? 'bg-blue-600' : 'bg-zinc-700'}`}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${speedMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                <button
                    className={`ide-btn ide-btn-full transition-all duration-300 ${isScriptGenerating ? 'bg-zinc-700 text-zinc-400' : 'ide-btn-primary'}`}
                    onClick={() => {
                        setShowOutput(true);
                        onGenerateScript();
                    }}
                    disabled={isScriptGenerating || !scriptIdea.trim()}
                >
                    {isScriptGenerating ? 'Generating...' : 'Generate Script'}
                </button>
            </div>

            {/* Output Section */}
            {outputVisible && (
                <div className="ide-card bg-zinc-900 border border-zinc-700 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Output</span>
                        <div className="flex items-center gap-2">
                            {scriptOutput && (
                                <button className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1" onClick={() => navigator.clipboard.writeText(scriptOutput)}>
                                    <Copy size={10} /> Copy
                                </button>
                            )}
                        </div>
                    </div>
                    <div
                        ref={outputRef}
                        className="text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto text-zinc-300 p-2 bg-zinc-950 rounded border border-zinc-800 scroll-smooth custom-scrollbar"
                    >
                        {scriptOutput}
                        {isScriptGenerating && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle" />
                        )}
                        {!scriptOutput && !isScriptGenerating && (
                            <span className="text-zinc-600 italic">No output yet.</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
