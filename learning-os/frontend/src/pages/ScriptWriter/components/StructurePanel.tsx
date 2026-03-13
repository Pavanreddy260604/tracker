import { useState } from 'react';
import { Map, AlignLeft, Plus, Trash2 } from 'lucide-react';
import { useDialog } from '../../../hooks/useDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import type { IScene as Scene } from '../../../services/project.api';

interface StructurePanelProps {
    scenes: Scene[];
    loading?: boolean;
    onNewScene: (projectId: string) => void;
    onDeleteScene: (projectId: string, sceneId: string) => void;
    onUpdateScene?: (sceneId: string, updates: Partial<Scene>) => Promise<void>;
}

export function StructurePanel({
    scenes = [],
    onNewScene,
    onDeleteScene,
    onUpdateScene
}: StructurePanelProps) {
    const { uiState, toggleLeftPanel, activeProject, setActiveScene, activeScene } = useScriptWriter();
    const { dialog, showConfirm, closeDialog } = useDialog();
    const { leftPanelOpen } = uiState;

    // PH Mixed RAG: Inline Edit State
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', slugline: '' });

    const startEditing = (e: React.MouseEvent, scene: Scene) => {
        e.stopPropagation();
        setEditingSceneId(scene._id);
        setEditForm({
            title: scene.title || '',
            slugline: scene.slugline || ''
        });
    };

    const handleSave = async () => {
        if (!editingSceneId || !onUpdateScene) return;

        await onUpdateScene(editingSceneId, {
            title: editForm.title,
            slugline: editForm.slugline
        });
        setEditingSceneId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') setEditingSceneId(null);
        if (e.key === 'Enter') {
            e.preventDefault();
            void handleSave();
        }
    };

    // Collapsed State (Rail)
    if (!leftPanelOpen) {
        return (
            <div className="flex flex-col h-full bg-zinc-950 items-center py-2 border-r border-zinc-800 w-12 text-zinc-500">
                <button
                    onClick={toggleLeftPanel}
                    className="p-2 hover:text-zinc-300 transition-colors"
                    title="Open Structure"
                >
                    <Map size={20} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-300">
            {/* Header */}
            <div className="h-10 border-b border-zinc-800 flex items-center px-3 bg-zinc-950 sticky top-0 z-10">
                <Map size={14} className="mr-2 text-zinc-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Structure</span>
                <div className="flex-1" />

                <button
                    onClick={() => activeProject?._id && onNewScene(activeProject._id)}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-blue-400 mr-1 transition-colors"
                    title="Add New Scene"
                >
                    <Plus size={16} />
                </button>

                <button onClick={toggleLeftPanel} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300">
                    <AlignLeft size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {!activeProject && (
                    <div className="p-4 text-center text-zinc-500 text-xs">
                        No Project Selected
                    </div>
                )}

                {activeProject && scenes.length === 0 && (
                    <div className="p-4 text-center text-zinc-500 text-xs">
                        No scenes found. Start writing!
                    </div>
                )}

                {scenes.map((scene, index) => {
                    const isActive = activeScene?._id === scene._id;
                    const isEditing = editingSceneId === scene._id;

                    return (
                        <div
                            key={scene._id}
                            onClick={() => !isEditing && setActiveScene(scene)}
                            onContextMenu={(e) => startEditing(e, scene)}
                            className={`
                                group flex items-start px-2 py-1.5 rounded cursor-pointer text-xs transition-all relative
                                ${isActive ? 'bg-blue-900/20 text-blue-200 border border-blue-900/30' : 'hover:bg-zinc-900 text-zinc-400 border border-transparent'}
                                ${isEditing ? 'ring-1 ring-blue-500/50 bg-zinc-900' : ''}
                            `}
                        >
                            <span className={`mr-2 font-mono opacity-50 mt-0.5 ${isActive ? 'text-blue-400' : ''}`}>
                                {index + 1}.
                            </span>
                            <div className="flex-1 overflow-hidden">
                                {isEditing ? (
                                    <div className="space-y-1 pr-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-[10px] font-bold text-white outline-none focus:border-blue-500"
                                            value={editForm.title}
                                            placeholder="Scene Title..."
                                            onChange={(e) => setEditForm((prev: { title: string; slugline: string }) => ({ ...prev, title: e.target.value }))}
                                            onKeyDown={handleKeyDown}
                                            onBlur={() => {
                                                void handleSave();
                                            }}
                                        />
                                        <input
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-[9px] text-zinc-400 outline-none focus:border-blue-500"
                                            value={editForm.slugline}
                                            placeholder="EXT. LOCATION - DAY"
                                            onChange={(e) => setEditForm((prev: { title: string; slugline: string }) => ({ ...prev, slugline: e.target.value }))}
                                            onKeyDown={handleKeyDown}
                                            onBlur={() => {
                                                void handleSave();
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className={`font-bold truncate ${isActive ? 'text-blue-100' : 'text-zinc-300'}`}>
                                            {scene.title || scene.slugline || 'UNTITLED SCENE'}
                                        </div>
                                        {scene.title && scene.slugline && (
                                            <div className="truncate opacity-30 text-[9px] uppercase tracking-tighter">
                                                {scene.slugline}
                                            </div>
                                        )}
                                        {scene.summary && (
                                            <div className="truncate opacity-50 mt-0.5 font-serif italic line-clamp-1">
                                                {scene.summary}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {!isEditing && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (activeProject?._id) {
                                            showConfirm(
                                                'Delete Scene',
                                                'Are you sure you want to delete this scene? This cannot be undone.',
                                                () => onDeleteScene(activeProject._id, scene._id)
                                            );
                                        }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-all ml-1"
                                    title="Delete Scene"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
            />
        </div>
    );
}
