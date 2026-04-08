
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bible, IScene as Scene } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { EditorSelection, GenerationOptions, SceneForm } from './types';
import { DEFAULT_GENERATION, DEFAULT_SCENE_FORM, type SaveState } from './types';
import { getErrorMessage } from './utils';
import { useSceneCritique } from './useSceneCritique';
import { useSceneGeneration } from './useSceneGeneration';

interface UseScriptWriterSceneEditorProps {
    activeScene: Scene | null;
    activeProject: Bible | null;
    activeProjectId: string | null;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterSceneEditor({
    activeScene,
    activeProject,
    activeProjectId,
    updateSceneInState,
    setError
}: UseScriptWriterSceneEditorProps) {
    const [sceneForm, setSceneForm] = useState<SceneForm>(DEFAULT_SCENE_FORM);
    const [editorContent, setEditorContent] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('saved');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(DEFAULT_GENERATION);
    const [selectedSceneCharacterIds, setSelectedSceneCharacterIds] = useState<string[]>([]);
    const [editorSelection, setEditorSelection] = useState<EditorSelection | null>(null);

    const saveTimer = useRef<number | null>(null);
    const isHydrating = useRef(false);

    const wordCount = useMemo(() => {
        if (!editorContent.trim()) return 0;
        return editorContent.trim().split(/\s+/).length;
    }, [editorContent]);

    // 1. Generation Hook
    const { isGenerating, generationProgress, handleGenerateScene: generateSceneInner } = useSceneGeneration({
        activeScene,
        activeProjectId,
        updateSceneInState,
        setError,
        setEditorContent,
        setHasUnsavedChanges,
        setSaveState
    });

    // 2. Critique Hook
    const {
        isCritiquing,
        critique,
        pendingFix,
        setPendingFix,
        isCritiqueStale,
        pointsToRefresh,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix
    } = useSceneCritique({
        activeScene,
        activeProjectId,
        editorContent,
        updateSceneInState,
        setError,
        setSceneForm,
        setEditorContent,
        setHasUnsavedChanges,
        setSaveState
    });

    useEffect(() => {
        if (!activeScene) return;
        isHydrating.current = true;
        setSceneForm({
            title: activeScene.title || '',
            slugline: activeScene.slugline || '',
            summary: activeScene.summary || '',
            goal: activeScene.goal || '',
            status: activeScene.status || 'planned'
        });
        setEditorContent(activeScene.content || '');
        setSaveState('saved');
        setHasUnsavedChanges(false);
        setSelectedSceneCharacterIds([]);
        setEditorSelection(null);
        setTimeout(() => {
            isHydrating.current = false;
        }, 0);
    }, [activeScene]);

    useEffect(() => {
        if (activeProject?.language && (generationOptions.language === 'English' || !generationOptions.language) && activeProject.language !== 'English') {
            setGenerationOptions(prev => ({ ...prev, language: activeProject.language || 'English' }));
        }
    }, [activeProject?.language]);

    useEffect(() => {
        if (!activeScene || !hasUnsavedChanges || isHydrating.current || isGenerating) return;
        if (saveTimer.current) window.clearTimeout(saveTimer.current);

        saveTimer.current = window.setTimeout(async () => {
            if (!activeScene) return;
            setSaveState('saving');
            try {
                const updated = await projectApi.updateScene(activeScene._id, {
                    ...sceneForm,
                    content: editorContent
                });
                updateSceneInState(updated, activeProjectId);
                setSaveState('saved');
                setHasUnsavedChanges(false);
            } catch (err) {
                setSaveState('error');
                setError(getErrorMessage(err, 'Failed to save scene'));
            }
        }, 900);

        return () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
        };
    }, [editorContent, sceneForm, hasUnsavedChanges, activeProjectId, activeScene, isGenerating, setError, updateSceneInState]);

    const handleSceneFormChange = <K extends keyof SceneForm>(field: K, value: SceneForm[K]) => {
        setSceneForm((prev) => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleContentChange = (value: string) => {
        setEditorContent(value);
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleGenerateScene = () => generateSceneInner(generationOptions, selectedSceneCharacterIds);

    return {
        sceneForm,
        editorContent,
        saveState,
        wordCount,
        hasUnsavedChanges,
        isGenerating,
        generationProgress,
        isCritiquing,
        critique,
        generationOptions,
        editorSelection,
        selectedSceneCharacterIds,
        setSelectedSceneCharacterIds,
        handleSceneFormChange,
        handleContentChange,
        handleSelectionChange: setEditorSelection,
        handleGenerationOptionChange: (field: any, value: any) => setGenerationOptions(prev => ({ ...prev, [field]: value })),
        handleGenerateScene,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix: () => handleAcceptFix(sceneForm),
        handleDiscardFix,
        toggleSceneCharacter: (id: string) => setSelectedSceneCharacterIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
        pendingFix,
        setPendingFix,
        canRefreshCritique: true,
        pointsToRefresh,
        isCritiqueStale,
        eliteHighScore: activeScene?.highScore?.critique?.score || 0
    };
}
