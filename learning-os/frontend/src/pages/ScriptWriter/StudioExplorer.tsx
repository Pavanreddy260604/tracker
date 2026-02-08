import { ChevronDown, ChevronRight, FileText, Loader2, PanelRight, Plus, Search } from 'lucide-react';
import type { Bible, Scene } from '../../services/project.api';
import type { ProjectForm } from './types';

interface StudioExplorerProps {
    projects: Bible[];
    loadingProjects: boolean;
    expandedProjects: Record<string, boolean>;
    loadingScenes: Record<string, boolean>;
    projectScenes: Record<string, Scene[]>;
    activeProjectId: string | null;
    activeSceneId: string | null;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onProjectToggle: (projectId: string) => void;
    onSceneSelect: (scene: Scene, projectId: string) => void;
    onNewScene: (projectId: string | null) => void;
    isCreatingProject: boolean;
    creatingProject: boolean;
    newProjectForm: ProjectForm;
    onNewProjectClick: () => void;
    onNewProjectCancel: () => void;
    onNewProjectFieldChange: (field: keyof ProjectForm, value: string) => void;
    onNewProjectSubmit: () => void;
    getScenes: (projectId: string) => Scene[];
    onCollapse: () => void;
}

export function StudioExplorer({
    projects,
    loadingProjects,
    expandedProjects,
    loadingScenes,
    projectScenes,
    activeProjectId,
    activeSceneId,
    searchTerm,
    onSearchChange,
    onProjectToggle,
    onSceneSelect,
    onNewScene,
    isCreatingProject,
    creatingProject,
    newProjectForm,
    onNewProjectClick,
    onNewProjectCancel,
    onNewProjectFieldChange,
    onNewProjectSubmit,
    getScenes,
    onCollapse
}: StudioExplorerProps) {
    console.log('[StudioExplorer] Render - projects:', projects.length, 'activeProjectId:', activeProjectId, 'onCollapse:', typeof onCollapse);
    return (
        <div className="ide-panel explorer-panel">
            <div className="ide-panel-header" style={{ justifyContent: 'space-between' }}>
                <div className="flex items-center gap-2">
                    <PanelRight size={14} /> Explorer
                </div>
                <button
                    onClick={onCollapse}
                    className="ide-btn-icon"
                    title="Collapse Explorer"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sw-text-secondary)' }}
                >
                    <PanelRight size={14} style={{ transform: 'rotate(180deg)' }} />
                </button>
            </div>
            <div className="ide-panel-content">
                <div className="ide-explorer-actions">
                    {!isCreatingProject ? (
                        <button className="ide-btn ide-btn-primary ide-btn-full" onClick={onNewProjectClick}>
                            <Plus size={14} /> New Script
                        </button>
                    ) : (
                        <div className="ide-card">
                            <div className="ide-field">
                                <label className="ide-label">Title</label>
                                <input
                                    className="ide-input"
                                    value={newProjectForm.title}
                                    onChange={(event) => onNewProjectFieldChange('title', event.target.value)}
                                />
                            </div>
                            <div className="ide-field">
                                <label className="ide-label">Logline</label>
                                <textarea
                                    className="ide-textarea ide-textarea-sm"
                                    value={newProjectForm.logline}
                                    onChange={(event) => onNewProjectFieldChange('logline', event.target.value)}
                                />
                            </div>
                            <div className="ide-field">
                                <label className="ide-label">Genre</label>
                                <input
                                    className="ide-input"
                                    value={newProjectForm.genre}
                                    onChange={(event) => onNewProjectFieldChange('genre', event.target.value)}
                                />
                            </div>
                            <div className="ide-field">
                                <label className="ide-label">Tone</label>
                                <input
                                    className="ide-input"
                                    value={newProjectForm.tone}
                                    onChange={(event) => onNewProjectFieldChange('tone', event.target.value)}
                                />
                            </div>
                            <div className="ide-inline-actions">
                                <button className="ide-btn ide-btn-secondary ide-btn-sm" onClick={onNewProjectCancel}>
                                    Cancel
                                </button>
                                <button
                                    className="ide-btn ide-btn-primary ide-btn-sm"
                                    onClick={onNewProjectSubmit}
                                    disabled={creatingProject}
                                >
                                    {creatingProject ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    )}
                    <button className="ide-btn ide-btn-secondary ide-btn-full" onClick={() => onNewScene(activeProjectId)} disabled={!activeProjectId}>
                        <FileText size={14} /> Add Scene
                    </button>
                </div>

                <div className="ide-search">
                    <Search size={14} />
                    <input
                        className="ide-input ide-input-sm"
                        placeholder="Search scenes"
                        value={searchTerm}
                        onChange={(event) => onSearchChange(event.target.value)}
                    />
                </div>

                {loadingProjects ? (
                    <div className="ide-empty-hint">
                        <Loader2 size={18} className="animate-spin" />
                        <p>Loading projects...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="ide-empty-hint">No projects yet. Create your first script.</div>
                ) : (
                    <div className="ide-explorer-tree">
                        {projects.map((project) => {
                            const isExpanded = !!expandedProjects[project._id];
                            const scenes = getScenes(project._id);
                            return (
                                <div key={project._id} className="ide-explorer-group">
                                    <button
                                        className={`ide-explorer-header ${activeProjectId === project._id ? 'is-active' : ''}`}
                                        onClick={() => onProjectToggle(project._id)}
                                    >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span>{project.title}</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="ide-explorer-list">
                                            {loadingScenes[project._id] ? (
                                                <div className="ide-explorer-loading">Loading scenes...</div>
                                            ) : scenes.length === 0 ? (
                                                <div className="ide-explorer-empty">No scenes yet.</div>
                                            ) : (
                                                scenes.map((scene) => (
                                                    <button
                                                        key={scene._id}
                                                        className={`ide-explorer-item ${activeSceneId === scene._id ? 'is-active' : ''}`}
                                                        onClick={() => onSceneSelect(scene, project._id)}
                                                    >
                                                        <FileText size={14} />
                                                        <div>
                                                            <div className="ide-explorer-title">{scene.sequenceNumber}. {scene.slugline || 'Untitled Scene'}</div>
                                                            <div className="ide-explorer-subtitle">{scene.summary || 'Add a summary for this scene.'}</div>
                                                        </div>
                                                        <span className={`ide-status-dot ${scene.status}`} />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {projectScenes[activeProjectId || '']?.length === 0 && activeProjectId && !loadingScenes[activeProjectId] ? (
                    <div className="ide-empty-hint">Add your first scene to start writing.</div>
                ) : null}
            </div>
        </div>
    );
}
