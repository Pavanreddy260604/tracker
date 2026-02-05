import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';
import { useCharacterStore } from '../../stores/characterStore';
import {
    Wand2, FileText, ChevronRight,
    Sparkles,
    Download, Layout
} from 'lucide-react';
import { projectApi } from '../../services/project.api';
import { cn } from '../../lib/utils';

// Helper for Right Panel (AI)
interface ResizablePanelProps {
    children: React.ReactNode;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    side: 'left' | 'right';
    collapsed?: boolean;
    onToggle?: () => void;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
    children, defaultWidth, minWidth, maxWidth, side, collapsed
}) => {
    const [width, setWidth] = useState(defaultWidth);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            // Calculate delta from drag start, not from panel position
            const delta = side === 'left'
                ? e.clientX - startXRef.current
                : startXRef.current - e.clientX;
            let newWidth = startWidthRef.current + delta;
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            setWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizing(false);
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, side, minWidth, maxWidth]);

    if (collapsed) return null;

    return (
        <div ref={panelRef} className="relative bg-[var(--sw-surface)] border-l border-[var(--sw-border)] flex flex-col" style={{ width: `${width}px`, flexShrink: 0 }}>
            {children}
            <div className="ide-resize-handle absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--sw-accent)] z-10 -left-0.5" onMouseDown={handleMouseDown} />
        </div>
    );
};

export const SceneEditor: React.FC = () => {
    const { activeSceneId, scenes, updateSceneLocal, saveScene, critiqueScene, activeProject } = useProjectStore();
    const { user } = useAuthStore();
    const { loadCharacters } = useCharacterStore();

    const scene = scenes.find(s => s._id === activeSceneId);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isCritiquing, setIsCritiquing] = useState(false);
    const [genStyle, setGenStyle] = useState('classic');
    const [sceneLength, setSceneLength] = useState<'short' | 'medium' | 'long' | 'extended'>('medium');
    const [rightPanelVisible, setRightPanelVisible] = useState(true);
    const [wordCount, setWordCount] = useState(0);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [rightActiveTab, setRightActiveTab] = useState<'writer' | 'critic'>('writer');

    const abortControllerRef = useRef<AbortController | null>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (activeProject) loadCharacters(activeProject._id);
    }, [activeProject, loadCharacters]);

    // Word Count
    useEffect(() => {
        if (scene?.content) {
            setWordCount(scene.content.trim().split(/\s+/).filter(w => w.length > 0).length);
        } else {
            setWordCount(0);
        }
    }, [scene?.content]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        const textarea = editorRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(textarea.scrollHeight, window.innerHeight * 0.8)}px`;
        }
    }, [scene?.content]);

    // Auto-save
    const debouncedSave = useCallback((content: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setAutoSaveStatus('unsaved');
        saveTimeoutRef.current = setTimeout(async () => {
            if (scene) {
                setAutoSaveStatus('saving');
                await saveScene(scene._id, { content });
                setAutoSaveStatus('saved');
            }
        }, 2000);
    }, [scene, saveScene]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!scene) return;
        const newContent = e.target.value;
        updateSceneLocal(scene._id, { content: newContent });
        debouncedSave(newContent);
    };

    const handleGenerate = async () => {
        if (!user || !scene) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        setIsGenerating(true);
        setRightActiveTab('writer');
        if (!rightPanelVisible) setRightPanelVisible(true);

        try {
            updateSceneLocal(scene._id, { status: 'drafted' });
            const stream = await projectApi.generateScene(scene._id, user._id, { style: genStyle, format: 'film', characterIds: [], sceneLength });
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (abortControllerRef.current?.signal.aborted) { reader.cancel(); break; }
                accumulatedContent += decoder.decode(value, { stream: true });
                updateSceneLocal(scene._id, { content: accumulatedContent });
            }
            await saveScene(scene._id, { content: accumulatedContent, status: 'drafted' });
        } catch (error) { if ((error as Error).name !== 'AbortError') console.error(error); }
        finally { setIsGenerating(false); abortControllerRef.current = null; }
    };

    const handleCritique = async () => {
        if (!scene) return;
        setIsCritiquing(true);
        setRightActiveTab('critic');
        if (!rightPanelVisible) setRightPanelVisible(true);
        try { await critiqueScene(scene._id); } finally { setIsCritiquing(false); }
    };

    const handleExportFountain = () => {
        if (!scene) return;
        const blob = new Blob([scene.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scene.slugline.replace(/[^a-zA-Z0-9]/g, '_')}.fountain`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-[#89d185]';
        if (score >= 80) return 'text-[#60a5fa]';
        if (score >= 70) return 'text-[#cca700]';
        return 'text-[#f14c4c]';
    };

    return (
        <div className="flex flex-1 w-full h-full min-w-0 bg-[#0d1117] text-[var(--sw-text)] font-sans antialiased overflow-hidden">
            {/* EDITOR GROUP */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative">

                {/* 1. HEADER (Only if scene exists, else placeholder header?) */}
                {!scene ? (
                    <div className="flex-1 flex items-center justify-center text-[var(--sw-text-muted)]">
                        <div className="text-center">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-[var(--sw-text)] mb-2">Select a Scene</h3>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* TABS HEADER */}
                        <div className="h-9 flex bg-[#161b22] overflow-x-auto border-b border-[#30363d] shrink-0">
                            <div className="px-4 h-full min-w-[150px] max-w-[250px] bg-[#0d1117] text-[var(--sw-text)] text-xs font-medium border-r border-[#30363d] border-t-2 border-t-[#1f6feb] flex items-center gap-2 select-none">
                                <FileText size={14} className="text-[#1f6feb]" />
                                <span className="truncate">{scene.slugline || 'Untitled Scene'}</span>
                                <span className={cn("ml-auto w-2 h-2 rounded-full", autoSaveStatus === 'unsaved' ? "bg-white/20" : autoSaveStatus === 'saving' ? "bg-blue-500 animate-pulse" : "opacity-0")}></span>
                            </div>
                        </div>

                        {/* BREADCRUMBS & ACTIONS */}
                        <div className="h-8 flex items-center justify-between px-4 bg-[#0d1117] text-xs text-[#8b949e] border-b border-[#30363d] shrink-0">
                            <div className="flex items-center gap-2">
                                <span>{activeProject?.title}</span>
                                <ChevronRight size={10} />
                                <span>scenes</span>
                                <ChevronRight size={10} />
                                <span className="font-mono text-[var(--sw-text)]">{scene.slugline}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono opacity-50 mr-2">{wordCount} words</span>
                                <button onClick={handleExportFountain} className="hover:text-[var(--sw-text)]"><Download size={14} /></button>
                                <button onClick={handleGenerate} className={cn("hover:text-blue-400", isGenerating && "text-blue-400 animate-pulse")}><Wand2 size={14} /></button>
                                <button onClick={() => setRightPanelVisible(!rightPanelVisible)} className={cn("hover:text-[var(--sw-text)]", rightPanelVisible && "text-[var(--sw-text)]")}><Layout size={14} /></button>
                            </div>
                        </div>

                        {/* MAIN EDITOR AREA - Container scrolls, textarea auto-expands */}
                        <div className="flex-1 flex justify-center bg-[#0d1117] overflow-y-auto custom-scrollbar">
                            <div className="w-full max-w-[750px] py-12 px-8">
                                <textarea
                                    ref={editorRef}
                                    className="w-full resize-none bg-transparent border-none outline-none text-[17px] text-[#c9d1d9] p-0 m-0"
                                    style={{
                                        fontFamily: "'Courier Prime', 'Courier New', monospace",
                                        lineHeight: '2',
                                        caretColor: '#58a6ff'
                                    }}
                                    value={scene.content}
                                    onChange={handleContentChange}
                                    placeholder="FADE IN:"
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* RIGHT PANEL */}
            {scene && rightPanelVisible && (
                <ResizablePanel defaultWidth={320} minWidth={280} maxWidth={500} side="right">
                    <div className="h-9 px-4 flex items-center justify-between text-xs font-bold text-[#8b949e] bg-[#161b22] shrink-0 border-b border-[#30363d]">
                        <span>Studio Assistant</span>
                        <Sparkles size={14} className="text-[#1f6feb]" />
                    </div>
                    <div className="flex border-b border-[#30363d] bg-[#161b22] shrink-0">
                        <button onClick={() => setRightActiveTab('writer')} className={cn("flex-1 py-2 text-xs font-medium uppercase relative", rightActiveTab === 'writer' ? "text-[var(--sw-text)]" : "text-[#8b949e]")}>
                            Writer
                            {rightActiveTab === 'writer' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1f6feb]" />}
                        </button>
                        <button onClick={() => setRightActiveTab('critic')} className={cn("flex-1 py-2 text-xs font-medium uppercase relative", rightActiveTab === 'critic' ? "text-[var(--sw-text)]" : "text-[#8b949e]")}>
                            Critic
                            {rightActiveTab === 'critic' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1f6feb]" />}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 bg-[#0d1117]">
                        {rightActiveTab === 'writer' ? (
                            <div className="space-y-6">
                                <div className="p-4 rounded-lg border border-[#30363d] bg-[#161b22]">
                                    <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--sw-text)]">Auto-Write</h4>
                                    <label className="block text-xs text-[#8b949e] mb-1">Style</label>
                                    <select value={genStyle} onChange={(e) => setGenStyle(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] text-xs text-[var(--sw-text)] p-2 rounded mb-3">
                                        <option value="classic">Classic Hollywood</option>
                                        <option value="tarantino">Tarantino</option>
                                        <option value="nolan">Nolan</option>
                                    </select>
                                    <label className="block text-xs text-[#8b949e] mb-1">Scene Length</label>
                                    <select value={sceneLength} onChange={(e) => setSceneLength(e.target.value as any)} className="w-full bg-[#0d1117] border border-[#30363d] text-xs text-[var(--sw-text)] p-2 rounded mb-4">
                                        <option value="short">Short (1/4-1/2 page)</option>
                                        <option value="medium">Medium (1-2 pages)</option>
                                        <option value="long">Long (3-5 pages)</option>
                                        <option value="extended">Extended (5-10 pages)</option>
                                    </select>
                                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-[#1f6feb] text-white py-2 rounded text-xs font-bold hover:bg-[#1f6feb]/90 disabled:opacity-50">Generate</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="p-4 rounded-lg border border-[#30363d] bg-[#161b22]">
                                    <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--sw-text)]">Analysis</h4>
                                    <button onClick={handleCritique} disabled={isCritiquing} className="w-full bg-[#21262d] border border-[#30363d] text-[var(--sw-text)] py-2 rounded text-xs font-bold hover:bg-[#30363d] disabled:opacity-50">Run Critique</button>
                                </div>
                                {scene.critique && !isCritiquing && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
                                            <span className="text-xs font-bold text-[#8b949e]">Score</span>
                                            <span className={cn("text-2xl font-black", getScoreColor(scene.critique.score))}>{scene.critique.grade}</span>
                                        </div>
                                        <div className="p-4 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-[var(--sw-text)]">{scene.critique.summary}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            )}
        </div>
    );
};
