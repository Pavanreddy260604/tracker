import { useCallback, useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import type {
    ScriptTemplates,
    ScriptHistoryItem,
    ScriptRequest
} from '../../services/scriptWriter.api';
import { getErrorMessage } from './utils';

// PH 27: Modular Hook Architecture
import { useScriptHistory } from './hooks/useScriptHistory';
import { useScriptTemplates } from './hooks/useScriptTemplates';
import { useAssistantStream } from './hooks/useAssistantStream';

interface UseScriptWriterGeneratorProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    activeSceneId?: string | null;
    activeSceneName?: string;
    editorContext?: string;
    setEditorContent?: (content: string) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterGenerator({
    activeProject,
    activeProjectId,
    activeSceneId = null,
    activeSceneName,
    editorContext,
    setEditorContent,
    setError
}: UseScriptWriterGeneratorProps) {
    // 1. Templates & History (Modular)
    const { 
        scriptTemplates, 
        scriptFormat, setScriptFormat, 
        scriptStyle, setScriptStyle 
    } = useScriptTemplates(setError);
    
    const { 
        scriptHistory, 
        activeHistoryId, 
        loadScriptHistory, 
        handleScriptHistorySelect 
    } = useScriptHistory(setError);

    // 2. Local State
    const [scriptIdea, setScriptIdea] = useState('');
    const [scriptOutput, setScriptOutput] = useState('');
    const [scriptLanguage, setScriptLanguage] = useState('English');
    const [isScriptGenerating, setIsScriptGenerating] = useState(false);
    const [selectedScriptCharacterIds, setSelectedScriptCharacterIds] = useState<string[]>([]);
    const [aiModel, setAiModel] = useState<string>('');

    // 3. Assistant Stream (Modular)
    const assistant = useAssistantStream({
        activeProject,
        activeProjectId,
        activeSceneId: activeSceneId || null,
        activeSceneName,
        editorContext,
        scriptLanguage,
        aiModel,
        setError
    });

    // Sync project data to local states
    useEffect(() => {
        if (activeProject?.logline && !scriptIdea) {
            setScriptIdea(activeProject.logline);
        }
        if (activeProject?.language && scriptLanguage === 'English' && activeProject.language !== 'English') {
            setScriptLanguage(activeProject.language);
        }
    }, [activeProject, scriptIdea, scriptLanguage]);

    const handleScriptGenerate = async () => {
        if (!scriptIdea.trim() || !scriptFormat || !scriptStyle) return;
        setIsScriptGenerating(true);
        setScriptOutput('');
        setError(null);
        try {
            const request: ScriptRequest = {
                idea: scriptIdea,
                format: scriptFormat,
                style: scriptStyle,
                genre: activeProject?.genre,
                tone: activeProject?.tone,
                language: scriptLanguage,
                bibleId: activeProjectId || undefined,
                characterIds: selectedScriptCharacterIds,
                currentContent: editorContext,
                model: aiModel || undefined,
            };

            await scriptWriterApi.generateScriptStream(request, (chunk) => {
                setScriptOutput((prev) => prev + chunk);
            });

            await loadScriptHistory();
        } catch (err) {
            setError(getErrorMessage(err, 'Script generation failed'));
        } finally {
            setIsScriptGenerating(false);
        }
    };

    const toggleScriptCharacter = (characterId: string) => {
        setSelectedScriptCharacterIds((prev) =>
            prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId]
        );
    };

    const onApplyProposal = async (messageId: string) => {
        const result = await assistant.handleApplyProposal(messageId);
        if (result?.success && result.content && setEditorContent) {
            setEditorContent(result.content);
        }
    };

    return {
        scriptTemplates,
        scriptIdea,
        setScriptIdea,
        scriptFormat,
        setScriptFormat,
        scriptStyle,
        setScriptStyle,
        scriptOutput,
        setScriptOutput,
        scriptLanguage,
        setScriptLanguage,
        scriptHistory,
        activeHistoryId,
        handleScriptHistorySelect: (id: string) => handleScriptHistorySelect(id, setScriptOutput),
        isScriptGenerating,
        handleScriptGenerate,
        selectedScriptCharacterIds,
        toggleScriptCharacter,
        aiModel,
        setAiModel,
        
        // Assistant Props (Flattened for backward compatibility)
        assistantMessages: assistant.assistantMessages,
        isAssistantThinking: assistant.isAssistantThinking,
        assistantProgress: assistant.assistantProgress,
        handleAssistantSendMessage: assistant.handleAssistantSendMessage,
        handleApplyProposal: assistant.handleApplyProposal,
        handleConfirmEdit: assistant.handleConfirmEdit,
        handleDiscardProposal: assistant.handleDiscardProposal,
        handleDeleteAssistantMessage: assistant.handleDeleteAssistantMessage,
        handleUpdateAssistantMessage: assistant.handleUpdateAssistantMessage,
        handleClearChat: assistant.handleClearChat
    };
}
