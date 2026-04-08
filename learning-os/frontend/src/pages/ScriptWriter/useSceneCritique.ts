
import { useState, useMemo } from 'react';
import type { IScene as Scene, CritiqueResult } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import type { ScriptRequest } from '../../services/scriptWriter.api';
import type { PendingFixState, SceneForm } from './types';
import { getErrorMessage } from './utils';

interface UseSceneCritiqueProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    editorContent: string;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
    setSceneForm: React.Dispatch<React.SetStateAction<SceneForm>>;
    setEditorContent: (content: string) => void;
    setHasUnsavedChanges: (val: boolean) => void;
    setSaveState: (state: any) => void;
}

export function useSceneCritique({
    activeScene,
    activeProjectId,
    editorContent,
    updateSceneInState,
    setError,
    setSceneForm,
    setEditorContent,
    setHasUnsavedChanges,
    setSaveState
}: UseSceneCritiqueProps) {
    const [isCritiquing, setIsCritiquing] = useState(false);
    const [critique, setCritique] = useState<CritiqueResult | null>(activeScene?.critique || null);
    const [pendingFix, setPendingFix] = useState<PendingFixState | null>(null);

    // Sync critique when activeScene changes
    useMemo(() => {
        if (activeScene) setCritique(activeScene.critique || null);
    }, [activeScene]);

    const { pointsToRefresh } = useMemo(() => {
        if (!critique) return { pointsToRefresh: 0 };
        const lastContent = activeScene?.lastCritiqueContent || '';
        
        // Simple heuristic for line changes
        const oldLines = new Set(lastContent.split('\n').map(l => l.trim()).filter(l => l));
        const newLines = editorContent.split('\n').map(l => l.trim()).filter(l => l);
        let changes = 0;
        for (const line of newLines) {
            if (!oldLines.has(line)) changes++;
        }
        return { pointsToRefresh: changes };
    }, [critique, activeScene?.lastCritiqueContent, editorContent]);

    const isCritiqueStale = pointsToRefresh > 0;

    const handleCritiqueScene = async () => {
        if (!activeScene) return;
        setIsCritiquing(true);
        setError(null);
        try {
            const result = await projectApi.critiqueScene(activeScene._id, editorContent);
            setCritique(result);
            const updatedScene: Scene = { ...activeScene, critique: result, lastCritiqueContent: editorContent, status: 'reviewed' };
            updateSceneInState(updatedScene, activeProjectId);
            setSceneForm(prev => ({ ...prev, status: 'reviewed' }));
            setHasUnsavedChanges(false);
            setSaveState('saved');
        } catch (err) {
            setError(getErrorMessage(err, 'Critique failed'));
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleFixScene = async () => {
        if (!activeScene || !critique || isCritiqueStale) return;
        setIsCritiquing(true); // Re-use critiquing state for UI
        setError(null);
        try {
            const result = await projectApi.fixScene(activeScene._id);
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
            setIsCritiquing(false);
        }
    };

    const handleAcceptFix = async (currentForm: SceneForm) => {
        if (!pendingFix || !activeScene) return;
        const fullText = pendingFix.content;
        const newCritique = pendingFix.critique || null;
        setSaveState('saving');
        try {
            setEditorContent(fullText);
            setCritique(newCritique);
            const updated = pendingFix.mode === 'proposal'
                ? await (async () => {
                    if (pendingFix.commitProposal) await pendingFix.commitProposal();
                    else await scriptWriterApi.commitEdit(activeScene._id);
                    return projectApi.updateScene(activeScene._id, { ...currentForm, status: 'drafted' });
                })()
                : await projectApi.updateScene(activeScene._id, { ...currentForm, status: 'drafted', content: fullText, critique: newCritique || undefined });
            updateSceneInState(updated, activeProjectId);
            setSceneForm(prev => ({ ...prev, status: 'drafted' }));
            setSaveState('saved');
            setHasUnsavedChanges(false);
            setPendingFix(null);
        } catch (err) {
            setSaveState('error');
            setError(getErrorMessage(err, 'Failed to persist accepted fix'));
        }
    };

    const handleDiscardFix = async () => {
        if (pendingFix?.mode === 'proposal' && activeScene) {
            try {
                if (pendingFix.discardProposal) await pendingFix.discardProposal();
                else await scriptWriterApi.discardEdit(activeScene._id);
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to discard assistant proposal'));
                return;
            }
        }
        setPendingFix(null);
    };

    return {
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
    };
}
