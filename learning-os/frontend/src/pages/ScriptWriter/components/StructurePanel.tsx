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
}

export function StructurePanel({
    scenes = [],
    onNewScene,
    onDeleteScene
}: StructurePanelProps) {
    const { uiState, toggleLeftPanel, activeProject, setActiveScene, activeScene } = useScriptWriter();
    const { dialog, showConfirm, closeDialog } = useDialog();
    const { leftPanelOpen } = uiState;

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
                    return (
                        <div
                            key={scene._id}
                            onClick={() => setActiveScene(scene)}
                            className={`
                                group flex items-start px-2 py-1.5 rounded cursor-pointer text-xs
                                ${isActive ? 'bg-blue-900/20 text-blue-200 border border-blue-900/30' : 'hover:bg-zinc-900 text-zinc-400 border border-transparent'}
                            `}
                        >
                            <span className={`mr-2 font-mono opacity-50 mt-0.5 ${isActive ? 'text-blue-400' : ''}`}>
                                {index + 1}.
                            </span>
                            <div className="flex-1 overflow-hidden">
                                <div className={`font-bold truncate ${isActive ? 'text-blue-100' : 'text-zinc-300'}`}>
                                    {scene.slugline || 'UNTITLED SCENE'}
                                </div>
                                {scene.summary && (
                                    <div className="truncate opacity-50 mt-0.5 font-serif italic">
                                        {scene.summary}
                                    </div>
                                )}
                            </div>
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
