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
                    <div className="ide-editor-title">Scene Editor</div>
                </div>
                <div className="ide-editor-stats">
                    {editorSelection && (
                        <>
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                                Lines {editorSelection.lineStart}-{editorSelection.lineEnd}
                            </span>
                            <div className="ide-divider" />
                        </>
                    )}
                    <span>{wordCount} words</span>
                    <div className="ide-divider" />
                    <span className={`ide-save-status ${saveState}`}>{saveLabel}</span>
                </div>
            </div>
            <div className="ide-editor-body">
                {activeScene ? (
                    <div className="ide-paper relative">
                        {isGenerating && (
                            <div className="absolute top-0 left-0 right-0 z-20 px-8 pt-4 pb-6 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent">
                                <ProgressBar 
                                    progress={generationProgress} 
                                    label="Drafting Scene..." 
                                    className="max-w-md mx-auto"
                                />
                            </div>
                        )}
                        {editorSelection && (
                            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-100">
                                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] text-blue-300">
                                    Assistant Target
                                </span>
                                <span>
                                    Selected {editorSelection.lineCount} line{editorSelection.lineCount !== 1 ? 's' : ''} and {editorSelection.charCount} characters.
                                </span>
                                <span className="text-blue-200/70">The right panel can now edit just this selection.</span>
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
