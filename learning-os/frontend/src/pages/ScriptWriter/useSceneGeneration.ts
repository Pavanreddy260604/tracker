
import { useState } from 'react';
import type { IScene as Scene, Bible } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { GenerationOptions } from './types';
import { getErrorMessage } from './utils';

interface UseSceneGenerationProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
    setEditorContent: (content: string) => void;
    setHasUnsavedChanges: (val: boolean) => void;
    setSaveState: (state: any) => void;
}

export function useSceneGeneration({
    activeScene,
    activeProjectId,
    updateSceneInState,
    setError,
    setEditorContent,
    setHasUnsavedChanges,
    setSaveState
}: UseSceneGenerationProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);

    const handleGenerateScene = async (options: GenerationOptions, characterIds: string[]) => {
        if (!activeScene) return;
        setIsGenerating(true);
        setGenerationProgress(5);
        setError(null);

        // Simulated progress for thinking phase
        const thinkingInterval = setInterval(() => {
            setGenerationProgress(prev => {
                if (prev < 40) return prev + 2.5;
                if (prev < 50) return prev + 0.5;
                return prev;
            });
        }, 800);

        try {
            const stream = await projectApi.generateScene(activeScene._id, 'current', {
                style: options.style,
                format: options.format,
                sceneLength: options.sceneLength,
                language: options.language,
                characterIds: characterIds
            });
            
            clearInterval(thinkingInterval);
            setGenerationProgress(55);

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
                setEditorContent(fullText);
                
                setGenerationProgress(prev => {
                    const next = prev + 0.2;
                    return next > 98 ? 98 : next;
                });
            }
            
            const updatedScene: Scene = { ...activeScene, content: fullText, status: 'drafted' };
            setGenerationProgress(100);
            updateSceneInState(updatedScene, activeProjectId);
            setSaveState('saved');
            setHasUnsavedChanges(false);
        } catch (err) {
            setError(getErrorMessage(err, 'Generation failed'));
        } finally {
            clearInterval(thinkingInterval);
            setTimeout(() => {
                setIsGenerating(false);
                setGenerationProgress(0);
            }, 1000);
        }
    };

    return {
        isGenerating,
        generationProgress,
        handleGenerateScene
    };
}
