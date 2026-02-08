import type { ComponentType } from 'react';
import { PanelRight, BookOpen, FileText } from 'lucide-react';
import type { Bible, Scene, CritiqueResult } from '../../services/project.api';
import type { GenerationOptions, InspectorTab, ProjectForm, SceneForm, StudioMode } from './types';
import { InspectorProjectTab } from './InspectorProjectTab';
import { InspectorSceneTab } from './InspectorSceneTab';
import { GeneratorPanel } from './GeneratorPanel';


interface StudioInspectorProps {
    tab: InspectorTab;
    onTabChange: (tab: InspectorTab) => void;
    activeProject: Bible | null;
    projectForm: ProjectForm;
    projectDirty: boolean;
    onProjectFormChange: (field: keyof ProjectForm, value: string) => void;
    onSaveProject: () => void;
    onExport: (format: 'fountain' | 'txt' | 'json') => void;
    activeScene: Scene | null;
    sceneForm: SceneForm;
    onSceneFormChange: (field: keyof SceneForm, value: string) => void;
    generationOptions: GenerationOptions;
    onGenerationOptionChange: (field: keyof GenerationOptions, value: string) => void;
    onGenerateScene: () => void;
    onCritiqueScene: () => void;
    isGenerating: boolean;
    isCritiquing: boolean;

    critique: CritiqueResult | null;
    activeMode: StudioMode;
}


const tabs: { id: InspectorTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { id: 'project', label: 'Project', icon: BookOpen },
    { id: 'scene', label: 'Scene', icon: FileText }
];

export function StudioInspector({
    tab,
    onTabChange,
    activeProject,
    projectForm,
    projectDirty,
    onProjectFormChange,
    onSaveProject,
    onExport,
    activeScene,
    sceneForm,
    onSceneFormChange,
    generationOptions,
    onGenerationOptionChange,
    onGenerateScene,
    onCritiqueScene,
    isGenerating,
    isCritiquing,
    critique,
    activeMode
}: StudioInspectorProps) {
    console.log('[StudioInspector] Render - activeMode:', activeMode, 'tab:', tab, 'activeProject:', activeProject?.title);


    // Orbit Model: Sidebar content depends on activeMode
    let content = null;
    let headerTitle = "Inspector";
    let headerIcon = PanelRight;

    if (activeMode === 'write') {
        // Standard Inspector with Project/Scene tabs
        headerTitle = "Inspector";
        content = (
            <>
                <div className="ide-panel-tabs">
                    {tabs.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`ide-panel-tab ${tab === item.id ? 'is-active' : ''}`}
                                onClick={() => onTabChange(item.id)}
                            >
                                <Icon size={14} /> {item.label}
                            </button>
                        );
                    })}
                </div>
                <div className="ide-panel-content">
                    {tab === 'project' && (
                        <InspectorProjectTab
                            activeProject={activeProject}
                            projectForm={projectForm}
                            projectDirty={projectDirty}
                            onProjectFormChange={onProjectFormChange}
                            onSaveProject={onSaveProject}
                            onExport={onExport}
                        />
                    )}
                    {tab === 'scene' && (
                        <InspectorSceneTab
                            activeScene={activeScene}
                            sceneForm={sceneForm}
                            onSceneFormChange={onSceneFormChange}
                            generationOptions={generationOptions}
                            onGenerationOptionChange={onGenerationOptionChange}
                            onGenerateScene={onGenerateScene}
                            onCritiqueScene={onCritiqueScene}
                            isGenerating={isGenerating}
                            isCritiquing={isCritiquing}
                            critique={critique}
                        />
                    )}
                </div>
            </>
        );
    } else if (activeMode === 'generate') {
        headerTitle = "AI Assistant";
        console.log('[StudioInspector] Generate mode - Using MOCK data for GeneratorPanel (scriptTemplates: null, scriptIdea: "")');
        content = (
            <GeneratorPanel
                activeProject={activeProject}
                scriptTemplates={null}
                scriptIdea={""}
                onScriptIdeaChange={() => { }}
                scriptFormat={"screenplay"}
                onScriptFormatChange={() => { }}
                scriptStyle={"standard"}
                onScriptStyleChange={() => { }}
                scriptOutput={""}
                scriptHistory={[]}
                activeHistoryId={null}
                onScriptHistorySelect={() => { }}
                onGenerateScript={() => { }}
                isScriptGenerating={isGenerating}
                characters={[]}
                selectedScriptCharacterIds={[]}
                onToggleScriptCharacter={() => { }}
            />
        );
    } else {
        headerTitle = activeMode === 'story' ? "Story Board" : "Inspector";
        content = <div className="p-4 text-zinc-500">Coming soon</div>;
    }

    return (
        <div className="ide-panel inspector-panel">
            <div className="ide-panel-header">
                <PanelRight size={14} /> {headerTitle}
            </div>
            <div className="flex-1 overflow-y-auto">
                {content}
            </div>
        </div>
    );
}

