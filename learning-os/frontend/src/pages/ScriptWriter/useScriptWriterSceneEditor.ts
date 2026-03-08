import { useEffect, useMemo, useRef, useState } from 'react';
import type { CritiqueResult, IScene as Scene } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { GenerationOptions, SceneForm } from './types';
import { DEFAULT_GENERATION, DEFAULT_SCENE_FORM, type SaveState } from './types';
import { getErrorMessage } from './utils';

interface UseScriptWriterSceneEditorProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterSceneEditor({
    activeScene,
    activeProjectId,
    updateSceneInState,
    setError
}: UseScriptWriterSceneEditorProps) {
    const [sceneForm, setSceneForm] = useState<SceneForm>(DEFAULT_SCENE_FORM);
    const [editorContent, setEditorContent] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('saved');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCritiquing, setIsCritiquing] = useState(false);
    const [critique, setCritique] = useState<CritiqueResult | null>(null);
    const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(DEFAULT_GENERATION);
    const [selectedSceneCharacterIds, setSelectedSceneCharacterIds] = useState<string[]>([]);
    const [pendingFix, setPendingFix] = useState<{
        content: string;
        critique?: CritiqueResult;
        auditNotes?: string;
        isSuperior?: boolean;
        benchmarkScore?: number;
        mode?: 'fix' | 'proposal';
        isStreaming?: boolean;
    } | null>(null);

    const saveTimer = useRef<number | null>(null);
    const isHydrating = useRef(false);

    const wordCount = useMemo(() => {
        if (!editorContent.trim()) return 0;
        return editorContent.trim().split(/\s+/).length;
    }, [editorContent]);

    useEffect(() => {
        if (!activeScene) return;
        isHydrating.current = true;
        setSceneForm({
            slugline: activeScene.slugline || '',
            summary: activeScene.summary || '',
            goal: activeScene.goal || '',
            status: activeScene.status || 'planned'
        });
        setEditorContent(activeScene.content || '');
        setCritique(activeScene.critique || null);
        setSaveState('saved');
        setHasUnsavedChanges(false);
        setSelectedSceneCharacterIds([]);
        setTimeout(() => {
            isHydrating.current = false;
        }, 0);
    }, [activeScene]);

    useEffect(() => {
        if (!activeScene || !hasUnsavedChanges || isHydrating.current || isGenerating) return;
        if (saveTimer.current) {
            window.clearTimeout(saveTimer.current);
        }

        saveTimer.current = window.setTimeout(async () => {
            if (!activeScene) return;
            setSaveState('saving');
            try {
                const updated = await projectApi.updateScene(activeScene._id, {
                    slugline: sceneForm.slugline,
                    summary: sceneForm.summary,
                    goal: sceneForm.goal,
                    status: sceneForm.status,
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
    }, [editorContent, sceneForm, hasUnsavedChanges, activeScene?._id, isGenerating]);

    const handleSceneFormChange = (field: keyof SceneForm, value: string) => {
        setSceneForm((prev) => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleContentChange = (value: string) => {
        setEditorContent(value);
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleGenerationOptionChange = (field: keyof GenerationOptions, value: string) => {
        setGenerationOptions((prev) => ({ ...prev, [field]: value as GenerationOptions[keyof GenerationOptions] }));
    };

    const handleGenerateScene = async () => {
        if (!activeScene) return;
        setIsGenerating(true);
        setError(null);
        try {
            const stream = await projectApi.generateScene(activeScene._id, 'current', {
                style: generationOptions.style,
                format: generationOptions.format,
                sceneLength: generationOptions.sceneLength,
                language: generationOptions.language,
                characterIds: selectedSceneCharacterIds
            });
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
                setEditorContent(fullText);
            }
            const updatedScene: Scene = { ...activeScene, content: fullText, status: 'drafted' };
            updateSceneInState(updatedScene, activeProjectId);
            setSaveState('saved');
            setHasUnsavedChanges(false);
        } catch (err) {
            setError(getErrorMessage(err, 'Generation failed'));
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper to count line changes
    function countLineChanges(oldText: string, newText: string): number {
        if (!oldText) return newText ? newText.split('\n').length : 0;
        const oldLines = new Set(oldText.split('\n').map(l => l.trim()).filter(l => l));
        const newLines = newText.split('\n').map(l => l.trim()).filter(l => l);

        // Count how many new lines are NOT in the old set
        let changes = 0;
        for (const line of newLines) {
            if (!oldLines.has(line)) changes++;
        }
        // Simple heuristic: also check length diff in case they just deleted stuff
        // But user asked for "minimum changes", implies adding/modifying.
        // If they deleted 3 lines, that's also a change.
        // Let's stick to "changed lines".
        return changes;
    }

    const { pointsToRefresh, canRefresh } = useMemo(() => {
        if (!critique) return { pointsToRefresh: 0, canRefresh: true };
        const lastContent = activeScene?.lastCritiqueContent || '';
        const changes = countLineChanges(lastContent, editorContent);
        return {
            pointsToRefresh: changes,
            canRefresh: changes >= 3
        };
    }, [critique, activeScene?.lastCritiqueContent, editorContent]);

    const handleCritiqueScene = async () => {
        if (!activeScene) return;

        // Block if not enough changes (unless force override is allowed, but we follow rules)
        if (critique && !canRefresh) {
            setError(`Please make significant changes (at least 3 new/modified lines) before refreshing the critique.`);
            return;
        }

        setIsCritiquing(true);
        setError(null);
        try {
            const result = await projectApi.critiqueScene(activeScene._id, editorContent);
            setCritique(result);

            // Save the content snapshot along with the critique
            const updatedScene: Scene = {
                ...activeScene,
                critique: result,
                lastCritiqueContent: editorContent, // Snapshot current content
                status: 'reviewed'
            };

            updateSceneInState(updatedScene, activeProjectId);
            setSceneForm((prev) => ({ ...prev, status: 'reviewed' }));
            setHasUnsavedChanges(false);
            setSaveState('saved');
        } catch (err) {
            setError(getErrorMessage(err, 'Critique failed'));
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleFixScene = async () => {
        if (!activeScene || !critique) return;
        setIsGenerating(true);
        setError(null);
        try {
            const result = await projectApi.fixScene(activeScene._id);

            // Instead of applying immediately, we set it as PENDING for review
            setPendingFix({
                content: result.content,
                critique: result.critique,
                auditNotes: result.auditNotes,
                isSuperior: result.isSuperior,
                benchmarkScore: result.benchmarkScore,
                mode: 'fix'
            });

        } catch (err) {
            setError(getErrorMessage(err, 'Applying fixes failed'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAcceptFix = async () => {
        if (!pendingFix || !activeScene) return;

        const fullText = pendingFix.content;
        const newCritique = pendingFix.critique || null;

        setSaveState('saving');
        try {
            // Apply to editor and state
            setEditorContent(fullText);
            setCritique(newCritique);

            // Force immediate persistence to DB
            const updated = await projectApi.updateScene(activeScene._id, {
                slugline: sceneForm.slugline,
                summary: sceneForm.summary,
                goal: sceneForm.goal,
                status: 'drafted',
                content: fullText,
                critique: newCritique || undefined
            });

            updateSceneInState(updated, activeProjectId);
            setSceneForm((prev) => ({ ...prev, status: 'drafted' }));
            setSaveState('saved');
            setHasUnsavedChanges(false);
            setPendingFix(null); // Clear review mode
        } catch (err) {
            setSaveState('error');
            setError(getErrorMessage(err, 'Failed to persist accepted fix'));
        }
    };

    const handleDiscardFix = () => {
        setPendingFix(null);
    };

    const toggleSceneCharacter = (characterId: string) => {
        setSelectedSceneCharacterIds((prev) =>
            prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId]
        );
    };

    return {
        sceneForm,
        editorContent,
        saveState,
        wordCount,
        hasUnsavedChanges,
        isGenerating,
        isCritiquing,
        critique,
        generationOptions,
        selectedSceneCharacterIds,
        setSelectedSceneCharacterIds,
        handleSceneFormChange,
        handleContentChange,
        handleGenerationOptionChange,
        handleGenerateScene,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix,
        toggleSceneCharacter,
        pendingFix,
        setPendingFix,
        canRefreshCritique: canRefresh,
        pointsToRefresh,
        eliteHighScore: activeScene?.highScore?.critique?.score || 0
    };
}
