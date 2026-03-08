import { useEffect, useRef } from 'react';
import type { Bible, IScene as Scene } from '../../services/project.api';
import type { SaveState } from './types';

interface StudioEditorProps {
    activeProject: Bible | null;
    activeScene: Scene | null;
    editorContent: string;
    onContentChange: (value: string) => void;
    saveState: SaveState;
    wordCount: number;
    sceneCount: number;
    characterCount: number;

    onFocus?: () => void;
    onBlur?: () => void;
}

export function StudioEditor({
    activeProject,
    activeScene,
    editorContent,
    onContentChange,
    saveState,
    wordCount,
    sceneCount,
    characterCount,
    onFocus,
    onBlur
}: StudioEditorProps) {
    const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Unsaved';

    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    }, [activeScene?._id]);

    return (
        <div className="ide-editor">
            <div className="ide-editor-header">
                <div>
                    <div className="ide-editor-title">Scene Editor</div>
                </div>
                <div className="ide-editor-stats">
                    <span>{wordCount} words</span>
                    <div className="ide-divider" />
                    <span className={`ide-save-status ${saveState}`}>{saveLabel}</span>
                </div>
            </div>
            <div className="ide-editor-body">
                {activeScene ? (
                    <div className="ide-paper">
                        <textarea
                            ref={textareaRef}
                            className="ide-script-editor"
                            value={editorContent}
                            onChange={(event) => onContentChange(event.target.value)}
                            placeholder="Begin with INT. or EXT. and write your scene..."
                            spellCheck={false}
                            onFocus={onFocus}
                            onBlur={onBlur}
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
