import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';
import { FolderPlus, BookOpen, Clock, Film, Trash2, MoreVertical } from 'lucide-react';
import type { Bible } from '../../services/project.api';

export const ProjectDashboard: React.FC = () => {
    const { projects, fetchProjects, createProject, deleteProject, selectProject, isLoading } = useProjectStore();
    const { user } = useAuthStore();

    // Local form state
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newGenre, setNewGenre] = useState('Drama');
    const [newLogline, setNewLogline] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchProjects(user._id);
        }
    }, [user, fetchProjects]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = () => setMenuOpenId(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        await createProject(user._id, {
            title: newTitle,
            genre: newGenre,
            logline: newLogline
        });
        setIsCreating(false);
        setNewTitle('');
        setNewGenre('Drama');
        setNewLogline('');
    };

    const handleDelete = async (projectId: string) => {
        await deleteProject(projectId);
        setDeleteConfirmId(null);
        setMenuOpenId(null);
    };

    return (
        <div className="sw-page flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="sw-page-title">Script Writer Studio</h1>
                        <p className="sw-page-subtitle">
                            Manage story bibles, screenplays, and episodic worlds in one place.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="sw-btn sw-btn-primary"
                    >
                        <FolderPlus size={18} /> New Project
                    </button>
                </div>

                {isCreating && (
                    <div className="sw-card p-6 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="sw-section-title">Create Project</h3>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="sw-btn sw-btn-ghost"
                            >
                                Cancel
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="sw-label">Title</label>
                                    <input
                                        required
                                        type="text"
                                        className="sw-input"
                                        placeholder="e.g. The Midnight Pact"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="sw-label">Genre</label>
                                    <select
                                        className="sw-select"
                                        value={newGenre}
                                        onChange={e => setNewGenre(e.target.value)}
                                    >
                                        <option>Drama</option>
                                        <option>Sci-Fi</option>
                                        <option>Comedy</option>
                                        <option>Thriller</option>
                                        <option>Horror</option>
                                        <option>Action</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="sw-label">Logline</label>
                                <input
                                    type="text"
                                    className="sw-input"
                                    placeholder="One sentence summary of the story..."
                                    value={newLogline}
                                    onChange={e => setNewLogline(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="sw-btn sw-btn-primary"
                                >
                                    {isLoading ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project: Bible) => (
                        <div
                            key={project._id}
                            className="sw-card sw-card-hover p-6 flex flex-col gap-4 relative group"
                        >
                            {/* Menu Button */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(menuOpenId === project._id ? null : project._id);
                                }}
                                className="absolute top-4 right-4 sw-icon-button sw-icon-button-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                aria-label="Project options"
                            >
                                <MoreVertical size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpenId === project._id && (
                                <div
                                    className="absolute top-12 right-4 z-20 sw-dropdown"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteConfirmId(project._id);
                                            setMenuOpenId(null);
                                        }}
                                        className="sw-dropdown-item sw-dropdown-item-danger"
                                    >
                                        <Trash2 size={12} /> Delete Project
                                    </button>
                                    <div className="h-[1px] bg-[var(--sw-border)] my-1" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            import('../../services/project.api').then(({ projectApi }) =>
                                                projectApi.exportProject(project._id, 'fountain')
                                            );
                                            setMenuOpenId(null);
                                        }}
                                        className="sw-dropdown-item"
                                    >
                                        <div className="flex items-center gap-2">
                                            📄 Export Fountain
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            import('../../services/project.api').then(({ projectApi }) =>
                                                projectApi.exportProject(project._id, 'txt')
                                            );
                                            setMenuOpenId(null);
                                        }}
                                        className="sw-dropdown-item"
                                    >
                                        <div className="flex items-center gap-2">
                                            📝 Export Text
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* Delete Confirmation Modal */}
                            {deleteConfirmId === project._id && (
                                <div
                                    className="absolute inset-0 bg-[var(--sw-surface)]/95 backdrop-blur-sm rounded-xl z-30 flex flex-col items-center justify-center p-6 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Trash2 size={32} className="text-red-500 mb-3" />
                                    <h4 className="sw-section-title">Delete Project?</h4>
                                    <p className="sw-muted text-sm mt-2 mb-4">
                                        This will permanently delete "{project.title}" and all its scenes.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(project._id)}
                                            className="sw-btn sw-btn-danger"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Deleting...' : 'Delete'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmId(null)}
                                            className="sw-btn sw-btn-ghost"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Card Content */}
                            <div
                                className="cursor-pointer flex-1 flex flex-col"
                                onClick={() => selectProject(project)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="sw-icon-pill">
                                        <BookOpen size={20} />
                                    </div>
                                    <span className="sw-tag">{project.genre}</span>
                                </div>

                                <div className="mt-4 flex-1">
                                    <h3 className="sw-card-title">{project.title}</h3>
                                    <p className="sw-muted line-clamp-2 mt-2">
                                        {project.logline || 'No logline provided.'}
                                    </p>
                                </div>

                                <div className="sw-card-footer mt-auto pt-4">
                                    <div className="flex items-center gap-2">
                                        <Clock size={12} />
                                        {new Date(project.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Film size={12} />
                                        Feature
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {projects.length === 0 && !isLoading && !isCreating && (
                        <div className="sw-empty-card col-span-full">
                            <BookOpen size={42} className="opacity-40" />
                            <div>
                                <p className="sw-empty-title">No projects yet.</p>
                                <p className="sw-empty-subtitle">Create your first story bible to get started.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
