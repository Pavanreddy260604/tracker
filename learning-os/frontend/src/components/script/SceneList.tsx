import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Plus, CheckCircle, Circle, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SceneList: React.FC = () => {
    const { scenes, activeSceneId, selectScene, createScene, deleteScene, isLoading } = useProjectStore();
    const [isCreating, setIsCreating] = useState(false);
    const [newSlugline, setNewSlugline] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleAddScene = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSlugline.trim()) return;

        await createScene({
            slugline: newSlugline,
            summary: 'New scene',
            status: 'planned'
        });
        setNewSlugline('');
        setIsCreating(false);
    };

    const handleDeleteScene = async (sceneId: string) => {
        await deleteScene(sceneId);
        setDeleteConfirmId(null);
        setMenuOpenId(null);
    };

    return (
        <div className="sw-sidebar w-72 flex flex-col">
            <div className="sw-sidebar-header">
                <h3 className="sw-sidebar-title">Scenes</h3>
                <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="sw-icon-button sw-icon-button-sm"
                    aria-label="Add scene"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {scenes.map((scene) => (
                    <div
                        key={scene._id}
                        className={cn("sw-list-item group relative", activeSceneId === scene._id && "is-active")}
                    >
                        <div
                            className="flex-1 flex items-start cursor-pointer"
                            onClick={() => selectScene(scene._id)}
                        >
                            <div className="mt-0.5 mr-3 text-gray-400">
                                {scene.status === 'final' ? <CheckCircle size={14} className="sw-success-text" /> : <Circle size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="sw-mono-label">Scene {scene.sequenceNumber}</div>
                                <div className="sw-item-title truncate">{scene.slugline}</div>
                                <div className="sw-item-subtitle line-clamp-1">
                                    {scene.summary}
                                </div>
                            </div>
                        </div>

                        {/* Menu Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === scene._id ? null : scene._id);
                            }}
                            className="sw-icon-button sw-icon-button-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Scene options"
                        >
                            <MoreVertical size={14} />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpenId === scene._id && (
                            <div className="absolute right-2 top-full mt-1 z-10 sw-dropdown">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(scene._id);
                                        setMenuOpenId(null);
                                    }}
                                    className="sw-dropdown-item sw-dropdown-item-danger"
                                >
                                    <Trash2 size={12} /> Delete Scene
                                </button>
                            </div>
                        )}

                        {/* Delete Confirmation */}
                        {deleteConfirmId === scene._id && (
                            <div className="absolute inset-0 bg-[var(--sw-surface)] rounded-lg z-20 flex items-center justify-center p-2 gap-2">
                                <span className="text-xs sw-muted">Delete?</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteScene(scene._id);
                                    }}
                                    className="sw-btn sw-btn-danger sw-btn-sm"
                                    disabled={isLoading}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(null);
                                    }}
                                    className="sw-btn sw-btn-ghost sw-btn-sm"
                                >
                                    No
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {isCreating && (
                    <form onSubmit={handleAddScene} className="sw-card sw-card-muted p-3">
                        <input
                            autoFocus
                            type="text"
                            placeholder="INT. LOCATION - DAY"
                            className="sw-input sw-input-compact"
                            value={newSlugline}
                            onChange={(e) => setNewSlugline(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end mt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="sw-btn sw-btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="sw-btn sw-btn-primary"
                            >
                                Add
                            </button>
                        </div>
                    </form>
                )}

                {scenes.length === 0 && !isCreating && (
                    <div className="sw-empty py-8 text-center">
                        <p className="sw-muted text-sm">No scenes yet.</p>
                        <button
                            type="button"
                            onClick={() => setIsCreating(true)}
                            className="sw-link text-xs mt-2"
                        >
                            Create your first scene
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
