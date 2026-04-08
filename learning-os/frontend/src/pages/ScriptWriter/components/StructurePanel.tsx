import { useState, useMemo } from 'react';
import { Map, AlignLeft, Plus, Trash2, Layers } from 'lucide-react';
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    onReorderScenes?: (reordered: Scene[]) => Promise<void>;
}

// Sortable Item Component
function SortableSceneItem({ 
    scene, 
    isActive, 
    isEditing, 
    onSelect, 
    onStartEdit, 
    onDelete,
    editForm,
    setEditForm,
    handleSave,
    handleKeyDown,
    isHeader = false
}: { 
    scene: Scene, 
    isActive: boolean, 
    isEditing: boolean, 
    onSelect: () => void,
    onStartEdit: (e: React.MouseEvent) => void,
    onDelete: () => void,
    editForm: any,
    setEditForm: any,
    handleSave: () => void,
    handleKeyDown: (e: React.KeyboardEvent) => void,
    isHeader?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scene._id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : isHeader ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onSelect}
            onContextMenu={onStartEdit}
            className={`
                group flex items-start px-2 py-1.5 rounded cursor-grab active:cursor-grabbing text-xs transition-all relative
                ${isHeader ? 'sticky top-10 bg-console-surface border-y border-accent-primary/20 my-2 shadow-sm z-10' : ''}
                ${isActive ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' : 'hover:bg-console-surface text-text-secondary border border-transparent'}
                ${isEditing ? 'ring-1 ring-accent-primary/50 bg-console-surface' : ''}
                ${isDragging ? 'shadow-premium ring-2 ring-accent-primary/40' : ''}
            `}
        >
            <div className="flex-1 overflow-hidden">
                {isEditing ? (
                    <div className="space-y-1 pr-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            autoFocus
                            className="w-full bg-console-bg border border-border-subtle rounded px-1 py-0.5 text-[10px] font-bold text-text-primary outline-none focus:border-accent-primary font-mono"
                            value={editForm.title}
                            placeholder="Header or Title..."
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, title: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            onBlur={() => handleSave()}
                        />
                        <input
                            className="w-full bg-console-bg border border-border-subtle rounded px-1 py-0.5 text-[9px] text-text-secondary outline-none focus:border-accent-primary uppercase"
                            value={editForm.slugline}
                            placeholder="EXT. LOCATION - DAY"
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, slugline: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            onBlur={() => handleSave()}
                        />
                    </div>
                ) : (
                    <>
                        <div className={`font-bold truncate tracking-tight uppercase ${isHeader ? 'text-accent-primary text-[10px] tracking-[0.1em]' : isActive ? 'text-accent-primary' : 'text-text-primary'}`}>
                            {isHeader && <span className="mr-2 opacity-50">§</span>}
                            {scene.title || scene.slugline || 'UNTITLED SCENE'}
                        </div>
                        {!isHeader && scene.title && scene.slugline && (
                            <div className="truncate opacity-40 text-[9px] uppercase tracking-wider font-mono mt-0.5">
                                {scene.slugline}
                            </div>
                        )}
                        {!isHeader && scene.summary && (
                            <div className="mt-1.5 text-[10px] opacity-70 font-serif italic line-clamp-3 leading-relaxed border-l border-accent-primary/20 pl-2 py-0.5 group-hover:opacity-100 transition-opacity">
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
                        onDelete();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-console-surface rounded text-text-tertiary hover:text-status-error transition-all ml-1"
                    title={isHeader ? "Delete Header" : "Delete Scene"}
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    );
}

export function StructurePanel({
    scenes = [],
    onNewScene,
    onDeleteScene,
    onUpdateScene,
    onReorderScenes
}: StructurePanelProps) {
    const { uiState, toggleLeftPanel, activeProject, setActiveScene, activeScene } = useScriptWriter();
    const { dialog, showConfirm, closeDialog } = useDialog();
    const { leftPanelOpen } = uiState;

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Allow clicks without starting drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id && onReorderScenes) {
            const oldIndex = scenes.findIndex(s => s._id === active.id);
            const newIndex = scenes.findIndex(s => s._id === over.id);
            const reordered = arrayMove(scenes, oldIndex, newIndex);
            void onReorderScenes(reordered);
        }
    };

    // Logical Act Dividers (Every 10 scenes for now, or could be user-defined)
    const groupedScenes = useMemo(() => {
        const groups: { type: 'act' | 'scene', content: any }[] = [];
        scenes.forEach((scene, index) => {
            if (index === 0) groups.push({ type: 'act', content: 'Act I: Setup' });
            if (index === Math.floor(scenes.length / 4)) groups.push({ type: 'act', content: 'Act II: Confrontation' });
            if (index === Math.floor(scenes.length * 0.75)) groups.push({ type: 'act', content: 'Act III: Resolution' });
            groups.push({ type: 'scene', content: scene });
        });
        return groups;
    }, [scenes]);

    // Collapsed State (Rail)
    if (!leftPanelOpen) {
        return (
            <div className="flex flex-col h-full bg-console-bg items-center py-2 border-r border-border-subtle w-12 text-text-tertiary">
                <button
                    onClick={toggleLeftPanel}
                    className="p-2 hover:text-text-primary transition-colors"
                    title="Open Structure"
                >
                    <Map size={20} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-console-bg text-text-secondary select-none">
            {/* Header */}
            <div className="h-10 border-b border-border-subtle flex items-center px-3 bg-console-bg sticky top-0 z-20 backdrop-blur-md bg-opacity-80">
                <Map size={14} className="mr-2 text-accent-primary shadow-glow shadow-accent-primary/20" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">Architecture</span>
                <div className="flex-1" />

                <button
                    onClick={() => activeProject?._id && onNewScene(activeProject._id)}
                    className="p-1.5 hover:bg-console-surface rounded-lg text-text-tertiary hover:text-accent-primary mr-1 transition-all"
                    title="Add New Scene"
                >
                    <Plus size={16} />
                </button>

                <button onClick={toggleLeftPanel} className="p-1.5 hover:bg-console-surface rounded-lg text-text-tertiary hover:text-text-primary transition-all">
                    <AlignLeft size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
                {!activeProject && (
                    <div className="p-4 text-center text-text-tertiary text-xs italic">
                        No Project Selected
                    </div>
                )}

                {activeProject && scenes.length === 0 && (
                    <div className="p-8 text-center text-text-tertiary text-xs border border-dashed border-border-subtle rounded-2xl flex flex-col items-center gap-3">
                        <Layers size={24} className="opacity-20" />
                        <div>No scenes found. <br/> Start your story arc.</div>
                    </div>
                )}

                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={scenes.map(s => s._id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {scenes.map((scene, index) => {
                                const isActMarker = (scene.title || '').toUpperCase().startsWith('ACT') || (scene.slugline || '').startsWith('#');

                                return (
                                    <div key={scene._id}>
                                        <SortableSceneItem
                                            scene={scene}
                                            isActive={activeScene?._id === scene._id}
                                            isEditing={editingSceneId === scene._id}
                                            onSelect={() => !editingSceneId && setActiveScene(scene)}
                                            onStartEdit={(e) => startEditing(e, scene)}
                                            onDelete={() => {
                                                if (activeProject?._id) {
                                                    showConfirm(
                                                        'Purge Scene',
                                                        'Are you sure you want to delete this scene? This cannot be undone.',
                                                        () => onDeleteScene(activeProject._id, scene._id)
                                                    );
                                                }
                                            }}
                                            editForm={editForm}
                                            setEditForm={setEditForm}
                                            handleSave={handleSave}
                                            handleKeyDown={handleKeyDown}
                                            isHeader={isActMarker}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
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
