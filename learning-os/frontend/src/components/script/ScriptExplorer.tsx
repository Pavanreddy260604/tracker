import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import {
    Plus, Trash2, MoreVertical,
    ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Textarea } from '../ui/Textarea';
// Actually, to avoid circular deps or missing exports, I will implement a simple vertical split without resize for now, or copy the Simple resize logic if needed.
// I'll stick to a flex layout with overflow for now.

export const ScriptExplorer: React.FC = () => {
    const { scenes, activeSceneId, selectScene, createScene, deleteScene, updateSceneLocal, saveScene } = useProjectStore();

    // Scene List State
    const [isCreating, setIsCreating] = useState(false);
    const [newSlugline, setNewSlugline] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Scene Details State
    const [detailsOpen, setDetailsOpen] = useState(true);

    // Derive active scene
    const scene = scenes.find(s => s._id === activeSceneId);

    const handleAddScene = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSlugline.trim()) return;
        await createScene({ slugline: newSlugline, summary: 'New scene', status: 'planned' });
        setNewSlugline('');
        setIsCreating(false);
    };

    const handleDeleteScene = async (sceneId: string) => {
        await deleteScene(sceneId);
        setDeleteConfirmId(null);
        setMenuOpenId(null);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--sw-surface)] border-r border-[var(--sw-border)]">
            {/* HEADER */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--sw-border)] shrink-0">
                <span className="text-sm font-bold text-[var(--sw-text-muted)] uppercase tracking-wider">Scenes</span>
                <button
                    onClick={() => setIsCreating(true)}
                    className="p-1.5 rounded-md hover:bg-[var(--sw-surface-2)] text-[var(--sw-text-muted)] hover:text-[var(--sw-text)] transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {scenes.map((s, idx) => (
                    <div
                        key={s._id}
                        className={cn(
                            "group relative flex flex-col p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                            activeSceneId === s._id
                                ? "bg-[var(--sw-bg)] border-[var(--sw-accent)] shadow-md"
                                : "bg-[var(--sw-surface)] border-transparent hover:bg-[var(--sw-surface-2)] hover:border-[var(--sw-border)]"
                        )}
                        onClick={() => selectScene(s._id)}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                                "text-xs font-bold uppercase tracking-wide",
                                activeSceneId === s._id ? "text-[var(--sw-accent)]" : "text-[var(--sw-text-muted)]"
                            )}>
                                Scene {idx + 1}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(menuOpenId === s._id ? null : s._id);
                                }}
                                className={cn(
                                    "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--sw-border)]",
                                    menuOpenId === s._id && "opacity-100"
                                )}
                            >
                                <MoreVertical size={14} className="text-[var(--sw-text-muted)]" />
                            </button>
                        </div>

                        <span className={cn(
                            "font-mono text-sm leading-snug truncate",
                            activeSceneId === s._id ? "text-[var(--sw-text)]" : "text-[var(--sw-text)] opacity-80"
                        )}>
                            {s.slugline}
                        </span>

                        {/* Dropdown Menu */}
                        {menuOpenId === s._id && (
                            <div className="absolute right-2 top-8 z-20 w-32 bg-[var(--sw-surface-2)] border border-[var(--sw-border)] shadow-xl rounded-lg p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(s._id);
                                        setMenuOpenId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--sw-text-muted)] hover:bg-[var(--github-danger)]/10 hover:text-[var(--github-danger)] rounded-md transition-colors"
                                >
                                    <Trash2 size={12} /> Delete Scene
                                </button>
                            </div>
                        )}

                        {/* Delete Confirmation */}
                        {deleteConfirmId === s._id && (
                            <div className="absolute inset-0 bg-[var(--sw-surface-2)]/95 backdrop-blur-sm flex items-center justify-center gap-3 rounded-lg z-30 animate-in fade-in duration-200">
                                <span className="text-xs font-medium text-[var(--sw-text)]">Delete?</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteScene(s._id); }}
                                    className="text-xs font-bold text-[var(--github-danger)] hover:underline"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                    className="text-xs text-[var(--sw-text-muted)] hover:text-[var(--sw-text)]"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {isCreating && (
                    <form onSubmit={handleAddScene} className="p-3 bg-[var(--sw-bg)] border border-[var(--sw-accent)] rounded-lg shadow-lg animate-in slide-in-from-top-2">
                        <input
                            autoFocus
                            type="text"
                            className="w-full bg-transparent text-sm font-mono text-[var(--sw-text)] placeholder-[var(--sw-text-muted)] outline-none"
                            placeholder="INT. STUDIO - DAY"
                            value={newSlugline}
                            onChange={e => setNewSlugline(e.target.value)}
                            onBlur={() => !newSlugline && setIsCreating(false)}
                        />
                        <div className="mt-2 text-[10px] text-[var(--sw-text-muted)] text-right">Press Enter to create</div>
                    </form>
                )}
            </div>

            {/* DETAILS PANEL (Collapsible Bottom) */}
            {scene && detailsOpen && (
                <div className="h-1/3 border-t border-[var(--sw-border)] bg-[var(--sw-surface)] flex flex-col shrink-0 animate-in slide-in-from-bottom-10">
                    <div
                        className="px-6 py-3 border-b border-[var(--sw-border)] flex items-center justify-between cursor-pointer hover:bg-[var(--sw-surface-2)] transition-colors"
                        onClick={() => setDetailsOpen(false)}
                    >
                        <span className="text-xs font-bold text-[var(--sw-text-muted)] uppercase tracking-wider">Details</span>
                        <ChevronDown size={14} className="text-[var(--sw-text-muted)]" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="space-y-1.5">
                            <Textarea
                                label="Summary"
                                placeholder="What happens in this scene?"
                                value={scene.summary}
                                onChange={(e) => updateSceneLocal(scene._id, { summary: e.target.value })}
                                onBlur={() => saveScene(scene._id, { summary: scene.summary })}
                                rows={3}
                                className="resize-none overflow-y-auto"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Textarea
                                label="Goal"
                                placeholder="Character's objective..."
                                value={scene.goal || ''}
                                onChange={(e) => updateSceneLocal(scene._id, { goal: e.target.value })}
                                onBlur={() => saveScene(scene._id, { goal: scene.goal })}
                                rows={2}
                                className="resize-none overflow-y-auto"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Collapsed Details Toggle */}
            {scene && !detailsOpen && (
                <button
                    onClick={() => setDetailsOpen(true)}
                    className="py-2 border-t border-[var(--sw-border)] text-xs font-medium text-[var(--sw-text-muted)] hover:text-[var(--sw-text)] hover:bg-[var(--sw-surface-2)] transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                    <ChevronDown size={12} className="rotate-180" /> Show Details
                </button>
            )}
        </div>
    );
};
