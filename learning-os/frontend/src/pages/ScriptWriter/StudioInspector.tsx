import type { ComponentType } from 'react';
import { PanelRight, BookOpen, FileText } from 'lucide-react';
import type { Bible, IScene as Scene, CritiqueResult } from '../../services/project.api';
import type { AssistantMessage, AssistantRequest, GenerationOptions, InspectorTab, ProjectForm, SceneForm, StudioMode } from './types';
import { InspectorProjectTab } from './InspectorProjectTab';
import { InspectorSceneTab } from './InspectorSceneTab';
import { AssistantPanel } from './components/AssistantPanel';


interface StudioInspectorProps {
    tab: InspectorTab;
    onTabChange: (tab: InspectorTab) => void;
    activeProject: Bible | null;
    projectForm: ProjectForm;
    projectDirty: boolean;
    onProjectFormChange: <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => void;
    onSaveProject: () => void;
    onExport: (format: 'fountain' | 'txt' | 'json' | 'pdf') => void;
    activeScene: Scene | null;
    sceneForm: SceneForm;
    onSceneFormChange: <K extends keyof SceneForm>(field: K, value: SceneForm[K]) => void;
    generationOptions: GenerationOptions;
    onGenerationOptionChange: <K extends keyof GenerationOptions>(field: K, value: GenerationOptions[K]) => void;
    onGenerateScene: () => void;
    onCritiqueScene: () => void;
    isGenerating: boolean;
    isCritiquing: boolean;

    critique: CritiqueResult | null;
    activeMode: StudioMode;

    // PH 36: Assistant Props
    assistantMessages: AssistantMessage[];
    isAssistantThinking: boolean;
    onAssistantSendMessage: (request: AssistantRequest) => void;
    onApplyProposal: (messageId: string) => void;
    onDiscardProposal: (messageId: string) => void;
    onClearChat: () => void;
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
    activeMode,

    assistantMessages,
    isAssistantThinking,
    onAssistantSendMessage,
    onApplyProposal,
    // onDiscardProposal, // Removed
    // onClearChat // Removed
}: StudioInspectorProps) {
    console.log('[StudioInspector] Render - activeMode:', activeMode, 'tab:', tab, 'activeProject:', activeProject?.title);


    // Orbit Model: Sidebar content depends on activeMode
    let content = null;
    let headerTitle = "Inspector";

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
        content = (
            <AssistantPanel
                activeProject={activeProject}
                messages={assistantMessages}
                isGenerating={isAssistantThinking}
                activeSceneName={activeScene?.slugline || undefined}
                onSendMessage={onAssistantSendMessage}
                onApplyProposal={(messageId) => onApplyProposal(messageId)}
                onDiscardProposal={() => { }}
                onDeleteMessage={() => { }}
                onUpdateMessage={() => { }}
                onClearChat={() => { }}
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
