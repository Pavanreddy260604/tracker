import { useEffect, useRef } from 'react';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Bible, IScene as Scene } from '../../services/project.api';
import type { EditorSelection, SaveState } from './types';

interface StudioEditorProps {
    activeProject: Bible | null;
    activeScene: Scene | null;
    editorContent: string;
    editorSelection: EditorSelection | null;
    onContentChange: (value: string) => void;
    onSelectionChange: (selection: EditorSelection | null) => void;
    saveState: SaveState;
    wordCount: number;
    sceneCount: number;
    characterCount: number;
    isGenerating?: boolean;
    generationProgress?: number;

    onFocus?: () => void;
    onBlur?: () => void;
}

export function StudioEditor({
    activeProject,
    activeScene,
    editorContent,
    editorSelection,
    onContentChange,
    onSelectionChange,
    saveState,
    wordCount,
    sceneCount,
    characterCount,
    isGenerating = false,
    generationProgress = 0,
    onFocus,
    onBlur
}: StudioEditorProps) {
    const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Unsaved';

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const syncSelection = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart, selectionEnd, value } = textarea;
        if (selectionStart === selectionEnd) {
            onSelectionChange(null);
            return;
        }

        const selectedText = value.slice(selectionStart, selectionEnd);
        if (!selectedText.trim()) {
            onSelectionChange(null);
            return;
        }

        const beforeSelection = value.slice(0, selectionStart);
        const selectedLines = selectedText.split('\n');
        const lineStart = beforeSelection.split('\n').length;
        const lineEnd = lineStart + selectedLines.length - 1;
        const preview = selectedText.replace(/\s+/g, ' ').trim().slice(0, 140);

        onSelectionChange({
            start: selectionStart,
            end: selectionEnd,
            text: selectedText,
            lineStart,
            lineEnd,
            lineCount: selectedLines.length,
            charCount: selectedText.length,
            preview
        });
    };

    // PH 25: PRO-LEVEL INFINITE CANVAS (ResizeObserver + Ref Sync)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const syncHeight = () => {
            textarea.style.height = 'auto';
            const frameHeight = Math.max(1100, textarea.scrollHeight);
            textarea.style.height = `${frameHeight}px`;
            
            const paper = textarea.parentElement;
            if (paper) paper.style.height = `${frameHeight}px`;
        };

        const observer = new ResizeObserver(syncHeight);
        observer.observe(textarea);
        
        // Initial sync
        syncHeight();

        return () => observer.disconnect();
    }, [editorContent]);

    // Clean Scrolls & Auto-focus
    useEffect(() => {
        if (activeScene && textareaRef.current) {
            if (bodyRef.current) bodyRef.current.scrollTop = 0;
            textareaRef.current.focus();
        }
    }, [activeScene?._id]);

    return (
        <div className="ide-editor">
            <div className="ide-editor-header">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
                    <div className="ide-editor-title font-bold tracking-tight text-text-primary">
                        {activeScene ? activeScene.title || activeScene.slugline || 'Untitled Scene' : 'Script Studio'}
                    </div>
                </div>
                <div className="ide-editor-stats flex items-center gap-4 text-[11px] font-medium text-text-secondary">
                    <span className="flex items-center gap-1.5">{wordCount} words</span>
                    <div className="h-4 w-[1px] bg-border-subtle" />
                    <span className={`ide-save-status flex items-center gap-1.5 ${saveState}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${saveState === 'saved' ? 'bg-status-ok' : 'bg-accent-primary'}`} />
                        {saveLabel}
                    </span>
                </div>
            </div>
            
            <div ref={bodyRef} className="ide-editor-body">
                {activeScene ? (
                    <div className="ide-paper relative">
                        {isGenerating && (
                            <div className="absolute top-0 left-0 right-0 z-20 px-8 pt-4 pb-6 bg-gradient-to-b from-console-bg via-console-bg/80 to-transparent">
                                <ProgressBar 
                                    progress={generationProgress} 
                                    label="Synchronizing Narrative..." 
                                    className="max-w-md mx-auto"
                                />
                            </div>
                        )}

                        {editorSelection && (
                            <div className="mx-auto mb-6 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-500 absolute top-[-60px] left-0 right-0 z-50">
                                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent-primary/20 bg-console-bg/80 p-3 text-xs text-text-primary backdrop-blur-xl shadow-2xl">
                                    <span className="rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-2.5 py-1 font-bold uppercase tracking-widest text-[9px] text-accent-primary">
                                        Selection Focus
                                    </span>
                                    <div className="h-4 w-px bg-border-subtle/40" />
                                    <span className="font-medium text-text-secondary">
                                        {editorSelection.lineCount} lines selected
                                    </span>
                                </div>
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            className={`ide-script-editor ${isGenerating ? 'is-locked opacity-60' : ''}`}
                            value={editorContent}
                            onChange={(e) => onContentChange(e.target.value)}
                            onSelect={syncSelection}
                            onKeyUp={syncSelection}
                            onMouseUp={syncSelection}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            placeholder="Begin the sequence..."
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-text-tertiary">
                        <div className="p-4 rounded-3xl bg-console-surface border border-border-subtle animate-bounce">
                            <span className="text-2xl">✍️</span>
                        </div>
                        <p className="text-sm font-medium italic">Select a sequence to initiate writing flow.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
