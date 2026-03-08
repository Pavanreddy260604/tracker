import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { IScene, Bible } from '../services/project.api';

// Define the UI State for the "Infinite Desk"
interface ScriptWriterUIState {
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    viewMode: 'editor' | 'bible';
    activeTool: 'cast' | 'generator' | 'story' | 'settings' | null;
}

interface ScriptWriterContextType {
    // Data State
    activeProject: Bible | null;
    activeScene: IScene | null;
    editorContent: string;
    setActiveProject: (project: Bible | null) => void;
    setActiveScene: (scene: IScene | null) => void;
    setEditorContent: (content: string) => void;

    // UI State
    uiState: ScriptWriterUIState;
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    setRightPanelTool: (tool: ScriptWriterUIState['activeTool']) => void;
    setViewMode: (mode: 'editor' | 'bible') => void;
}

const ScriptWriterContext = createContext<ScriptWriterContextType | undefined>(undefined);

export function ScriptWriterProvider({ children }: { children: ReactNode }) {
    const [activeProject, setActiveProject] = useState<Bible | null>(null);
    const [activeScene, setActiveScene] = useState<IScene | null>(null);
    const [editorContent, setEditorContent] = useState<string>('');

    const [uiState, setUiState] = useState<ScriptWriterUIState>({
        leftPanelOpen: true,
        rightPanelOpen: true,
        viewMode: 'editor',
        activeTool: 'generator', // Default tool for easier testing of generator migration
    });

    // Custom setter to ensure view switches to editor when a scene is selected
    const handleSetActiveScene = (scene: IScene | null) => {
        setActiveScene(scene);
        if (scene) {
            setUiState(prev => ({ ...prev, viewMode: 'editor' }));
        }
    };

    const toggleLeftPanel = () => {
        setUiState(prev => ({ ...prev, leftPanelOpen: !prev.leftPanelOpen }));
    };

    const toggleRightPanel = () => {
        setUiState(prev => ({ ...prev, rightPanelOpen: !prev.rightPanelOpen }));
    };

    const setRightPanelTool = (tool: ScriptWriterUIState['activeTool']) => {
        setUiState(prev => {
            // If clicking the same tool that is already active
            if (prev.activeTool === tool) {
                // If panel is closed, just open it
                if (!prev.rightPanelOpen) return { ...prev, rightPanelOpen: true };
                // If panel is open, valid toggle? Maybe not. Let's keep it simple: always show.
                return { ...prev, rightPanelOpen: true };
            }
            // If switching tools, ensure panel is open
            return { ...prev, activeTool: tool, rightPanelOpen: true };
        });
    };

    const value = {
        activeProject,
        activeScene,
        editorContent,
        setActiveProject,
        setActiveScene: handleSetActiveScene,
        setEditorContent,
        uiState,
        toggleLeftPanel,
        toggleRightPanel,
        setRightPanelTool,
        setViewMode: (mode: 'editor' | 'bible') => setUiState(prev => ({ ...prev, viewMode: mode }))
    };

    return (
        <ScriptWriterContext.Provider value={value}>
            {children}
        </ScriptWriterContext.Provider>
    );
}

export function useScriptWriter() {
    const context = useContext(ScriptWriterContext);
    if (context === undefined) {
        throw new Error('useScriptWriter must be used within a ScriptWriterProvider');
    }
    return context;
}
