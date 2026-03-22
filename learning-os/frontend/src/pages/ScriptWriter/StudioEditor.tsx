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

    // Auto-focus and scroll to top when switching scenes
    useEffect(() => {
        if (activeScene) {
            // Small timeout to ensure DOM update is complete and textarea is mounted
            const timer = setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.scrollTop = 0;
                    textareaRef.current.focus();
                    console.log('[StudioEditor] Focused scene:', activeScene.slugline);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
        onSelectionChange(null);
    }, [activeScene, activeScene?._id, onSelectionChange]);

    return (
        <div className="ide-editor">
            <div className="ide-editor-header">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
                        <div className="ide-editor-title font-bold tracking-tight text-[color:var(--text-primary)]">
                            {activeScene ? activeScene.title || activeScene.slugline || 'Untitled Scene' : 'Scene Editor'}
                        </div>
                    </div>
                </div>
                <div className="ide-editor-stats flex items-center gap-4 text-[11px] font-medium text-text-secondary">
                    {editorSelection && (
                        <>
                            <span className="rounded-md border border-accent-primary/40 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-bold text-accent-primary uppercase tracking-wider">
                                Selection: {editorSelection.lineCount} lines
                            </span>
                            <div className="h-4 w-[1px] bg-border-subtle" />
                        </>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-text-secondary/40" />
                        {wordCount} words
                    </span>
                    <div className="h-4 w-[1px] bg-border-subtle" />
                    <span className={`ide-save-status flex items-center gap-1.5 ${saveState}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                            saveState === 'saved' ? 'bg-status-ok' : 
                            saveState === 'saving' ? 'bg-accent-primary animate-ping' : 
                            'bg-status-error'
                        }`} />
                        {saveLabel}
                    </span>
                </div>
            </div>
            <div className="ide-editor-body">
                {activeScene ? (
                    <div className="ide-paper relative">
                        {isGenerating && (
                            <div className="absolute top-0 left-0 right-0 z-20 px-8 pt-4 pb-6 bg-gradient-to-b from-console-bg via-console-bg/80 to-transparent">
                                <ProgressBar 
                                    progress={generationProgress} 
                                    label="Drafting Scene..." 
                                    className="max-w-md mx-auto"
                                />
                            </div>
                        )}
                        {editorSelection && (
                            <div className="mx-auto mb-6 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle/40 bg-console-bg/50 p-4 text-xs text-text-primary backdrop-blur-md shadow-lg">
                                    <span className="rounded-lg border border-accent-primary/30 bg-accent-primary/15 px-2.5 py-1 font-bold uppercase tracking-widest text-[9px] text-accent-primary">
                                        Assistant Focused
                                    </span>
                                    <span className="font-medium text-text-secondary italic">
                                        "Targeting {editorSelection.lineCount} lines..."
                                    </span>
                                    <div className="ml-auto flex items-center gap-2 text-accent-primary/80 font-semibold">
                                        <div className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
                                        Ready for Assist
                                    </div>
                                </div>
                            </div>
                        )}
                        <textarea
                            ref={textareaRef}
                            className={`ide-script-editor ${isGenerating ? 'is-locked opacity-80 cursor-not-allowed select-none' : ''}`}
                            value={editorContent}
                            onChange={(event) => !isGenerating && onContentChange(event.target.value)}
                            readOnly={isGenerating}
                            placeholder={isGenerating ? "AI is drafting... Editor locked." : "Begin with INT. or EXT. and write your scene..."}
                            spellCheck={false}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            onSelect={syncSelection}
                            onKeyUp={syncSelection}
                            onMouseUp={syncSelection}
                        />
                    </div>
                ) : (
                    <div className="ide-empty">
                        <div className="ide-empty-content">
                            <h3>{activeProject ? activeProject.title : 'Create a project'}</h3>
                            <p>{activeProject ? activeProject.logline || 'Add a logline to guide the writing.' : 'Start by creating a Script project.'}</p>
                            {activeProject && (
                                <div className="ide-overview">
                                    <div className="ide-overview-card">
                                        <span>Genre</span>
                                        <strong>{activeProject.genre || 'Drama'}</strong>
                                    </div>
                                    <div className="ide-overview-card">
                                        <span>Scenes</span>
                                        <strong>{sceneCount}</strong>
                                    </div>
                                    <div className="ide-overview-card">
                                        <span>Cast</span>
                                        <strong>{characterCount}</strong>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
