import { Menu, ChevronRight, Plus, Sparkles, Brain } from 'lucide-react';
import type { Bible, Scene } from '../../services/project.api';
import type { SaveState, StudioMode } from './types';

interface StudioTopbarProps {
    activeProject: Bible | null;
    activeScene: Scene | null;
    saveState: SaveState;
    onNewScene: () => void;
    onGenerate: () => void;
    onCritique: () => void;
    isGenerating: boolean;
    isCritiquing: boolean;
    onBackToDashboard: () => void;
    activeMode: StudioMode;
    onModeChange: (mode: StudioMode) => void;
    isExplorerOpen: boolean;
}

export function StudioTopbar({
    activeProject,
    activeScene,
    saveState,
    onNewScene,
    onGenerate,
    onCritique,
    isGenerating,
    isCritiquing,

    onBackToDashboard,
    activeMode,
    onModeChange,
    isExplorerOpen
}: StudioTopbarProps) {
    console.log('[StudioTopbar] Render - isExplorerOpen:', isExplorerOpen, 'activeMode:', activeMode);
    const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Unsaved';

    return (
        <div className="ide-toolbar">
            <div className="ide-toolbar-left">
                {!isExplorerOpen && (
                    <button
                        className="ide-toolbar-btn"
                        title="Open Explorer"
                        onClick={onBackToDashboard}
                        style={{ marginRight: 8 }}
                    >
                        <Menu size={16} />
                    </button>
                )}
                <div className="ide-breadcrumb">
                    <span className="opacity-50">Script Studio</span>
                    <ChevronRight size={14} className="opacity-30" />
                    <span className={activeProject ? 'font-medium' : 'opacity-50'}>{activeProject?.title || 'No Project'}</span>
                    <ChevronRight size={14} className="opacity-30" />
                    <span className="ide-breadcrumb-current opacity-80">{activeScene?.slugline || 'Select a scene'}</span>
                </div>
            </div>


            {/* Center Tabs Removed - Moved to Side Activity Bar */}


            <div className="ide-toolbar-right">
                {activeScene && (
                    <div className="flex items-center gap-2">
                        <button
                            className="ide-btn ide-btn-secondary ide-btn-sm"
                            onClick={onCritique}
                            disabled={isCritiquing || isGenerating}
                            title="Critique current scene"
                        >
                            <Brain size={14} className={isCritiquing ? "animate-pulse" : ""} />
                            {isCritiquing ? 'Critiquing...' : 'Critique'}
                        </button>
                        <button
                            className="ide-btn ide-btn-primary ide-btn-sm"
                            onClick={onGenerate}
                            disabled={isGenerating || isCritiquing}
                            title="Generate script content with AI"
                        >
                            <Sparkles size={14} className={isGenerating ? "animate-spin" : ""} />
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                )}
            </div>


        </div>
    );
}
