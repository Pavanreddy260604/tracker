import type { Bible, Scene } from '../../services/project.api';

interface StudioStatusbarProps {
    projectCount: number;
    activeProject: Bible | null;
    activeScene: Scene | null;
    error: string | null;
}

export function StudioStatusbar({
    projectCount,
    activeProject,
    activeScene,
    error
}: StudioStatusbarProps) {
    return (
        <div className="ide-statusbar">
            <div className="ide-statusbar-left">
                <div className="ide-statusbar-item">Projects: {projectCount}</div>
                {activeProject && (
                    <div className="ide-statusbar-item">Project: {activeProject.title}</div>
                )}
                {activeScene && (
                    <div className="ide-statusbar-item">Scene: {activeScene.slugline || 'Untitled Scene'}</div>
                )}
            </div>
            <div className="ide-statusbar-right">
                {error && <div className="ide-statusbar-item ide-save-status error">{error}</div>}
            </div>
        </div>
    );
}
