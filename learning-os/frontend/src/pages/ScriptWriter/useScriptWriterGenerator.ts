import { useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { ScriptHistoryItem, ScriptTemplates, IScriptDetail, ScriptRequest } from '../../services/scriptWriter.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { getErrorMessage } from './utils';
import type { AssistantMessage } from './types';

interface UseScriptWriterGeneratorProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    activeSceneId?: string | null;
    editorContext?: string;
    setError: (message: string | null) => void;
}

export function useScriptWriterGenerator({
    activeProject,
    activeProjectId,
    activeSceneId,
    editorContext,
    setError
}: UseScriptWriterGeneratorProps) {
    const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplates | null>(null);
    const [scriptIdea, setScriptIdea] = useState('');
    const [scriptFormat, setScriptFormat] = useState('');
    const [scriptStyle, setScriptStyle] = useState('');
    const [scriptOutput, setScriptOutput] = useState('');
    const [scriptLanguage, setScriptLanguage] = useState('English');
    const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
    const [isScriptGenerating, setIsScriptGenerating] = useState(false);
    const [selectedScriptCharacterIds, setSelectedScriptCharacterIds] = useState<string[]>([]);
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
    const [isAssistantThinking, setIsAssistantThinking] = useState(false);

    useEffect(() => {
        loadTemplates();
        loadScriptHistory();
    }, []);

    useEffect(() => {
        if (activeProject?.logline && !scriptIdea) {
            setScriptIdea(activeProject.logline);
        }
        // Default to project language if available
        if (activeProject && (activeProject as any).language) {
            setScriptLanguage((activeProject as any).language);
        }
    }, [activeProject]);

    useEffect(() => {
        setSelectedScriptCharacterIds([]);
        setAssistantMessages([]); // Clear chat temporarily
        if (activeSceneId) {
            loadAssistantHistory(activeSceneId);
        }
        if (!activeProjectId) {
            setScriptIdea('');
        }
    }, [activeProjectId, activeSceneId]);

    const loadAssistantHistory = async (sceneId: string) => {
        try {
            const history = await scriptWriterApi.getAssistantHistory(sceneId);
            const mappedMessages: AssistantMessage[] = history.map((m: any) => ({
                id: m._id,
                role: m.role,
                type: m.type,
                content: m.content,
                timestamp: new Date(m.timestamp).getTime(),
                status: m.type === 'proposal' ? 'pending' : undefined
            }));
            setAssistantMessages(mappedMessages);
        } catch (err) {
            console.error('Failed to load assistant history:', err);
        }
    };

    const loadTemplates = async () => {
        try {
            const templates = await scriptWriterApi.getTemplates();
            setScriptTemplates(templates);
            if (templates.formats.length > 0) setScriptFormat(templates.formats[0].id);
            if (templates.styles.length > 0) setScriptStyle(templates.styles[0].id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load templates'));
        }
    };

    const loadScriptHistory = async () => {
        try {
            const history = await scriptWriterApi.getHistory();
            setScriptHistory(history);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script history'));
        }
    };

    const handleScriptGenerate = async () => {
        if (!scriptIdea.trim() || !scriptFormat || !scriptStyle) return;
        setIsScriptGenerating(true);
        setScriptOutput('');
        setActiveHistoryId(null);
        setError(null);
        try {
            const request: ScriptRequest = {
                idea: scriptIdea,
                format: scriptFormat,
                style: scriptStyle,
                genre: activeProject?.genre,
                tone: activeProject?.tone,
                language: scriptLanguage, // Pass the selected language
                bibleId: activeProjectId || undefined,
                characterIds: selectedScriptCharacterIds,
                currentContent: editorContext,
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

    const handleScriptHistorySelect = async (scriptId: string) => {
        setActiveHistoryId(scriptId);
        try {
            const detail: IScriptDetail = await scriptWriterApi.getScript(scriptId);
            setScriptOutput(detail.content || '');
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script'));
        }
    };

    const toggleScriptCharacter = (characterId: string) => {
        setSelectedScriptCharacterIds((prev) =>
            prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId]
        );
    };

    const handleAssistantSendMessage = async (content: string, activeSceneId: string | null, onUpdatePending?: (content: string, finished?: boolean) => void) => {
        if (!content.trim() || isAssistantThinking) return;

        const userMsg: AssistantMessage = {
            id: Date.now().toString(),
            role: 'user',
            type: 'instruction',
            content,
            timestamp: Date.now()
        };

        setAssistantMessages(prev => [...prev, userMsg]);
        setIsAssistantThinking(true);

        // Placeholder for AI thought
        const thoughtMsg: AssistantMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            type: 'thought',
            content: 'Analyzing scene context and story bible...',
            timestamp: Date.now() + 1
        };
        setAssistantMessages(prev => [...prev, thoughtMsg]);

        try {
            if (activeSceneId) {
                // Assisted Edit Flow
                const proposalId = (Date.now() + 2).toString();
                const proposalMsg: AssistantMessage = {
                    id: proposalId,
                    role: 'assistant',
                    type: 'proposal',
                    content: '',
                    status: 'streaming',
                    timestamp: Date.now() + 2
                };
                setAssistantMessages(prev => [...prev, proposalMsg]);

                let accumulated = '';
                await scriptWriterApi.assistedEditStream(activeSceneId, content, (chunk) => {
                    accumulated += chunk;
                    setAssistantMessages(prev => prev.map(m =>
                        m.id === proposalId ? { ...m, content: accumulated } : m
                    ));
                    if (onUpdatePending) {
                        onUpdatePending(accumulated, false);
                    }
                }, {
                    language: scriptLanguage
                });

                // Set status to pending after generation is complete to show buttons
                setAssistantMessages(prev => prev.map(m =>
                    m.id === proposalId ? { ...m, status: 'pending' } : m
                ));
                if (onUpdatePending) {
                    onUpdatePending(accumulated, true);
                }
            } else {
                // Fallback to general generation if no scene selected
                // (Optional: Implement general chat logic here)
                const errorMsg: AssistantMessage = {
                    id: (Date.now() + 3).toString(),
                    role: 'assistant',
                    type: 'proposal', // Using proposal type for the result
                    content: 'Please select a scene to refactor.',
                    timestamp: Date.now() + 3
                };
                setAssistantMessages(prev => [...prev, errorMsg]);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Assistant request failed'));
        } finally {
            setIsAssistantThinking(false);
        }
    };

    const handleApplyProposal = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;
        // Optimization: Immediate disappearance from UI
        setAssistantMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            const { success } = await scriptWriterApi.commitEdit(activeSceneId);
            if (!success) {
                // If failed, we could technically restore the message, but user asked for "disappear"
                setError('Failed to apply edit');
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to apply edit'));
        }
    };

    const handleDiscardProposal = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;
        // Optimization: Immediate disappearance from UI
        setAssistantMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            const { success } = await scriptWriterApi.discardEdit(activeSceneId);
            if (!success) {
                setError('Failed to discard edit');
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to discard edit'));
        }
    };

    const handleDeleteAssistantMessage = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;
        try {
            await scriptWriterApi.deleteAssistantHistory(activeSceneId, messageId);
            // Sync UI
            setAssistantMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete message'));
        }
    };

    const handleUpdateAssistantMessage = async (messageId: string, content: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;
        try {
            await scriptWriterApi.updateAssistantHistory(activeSceneId, messageId, content);
            setAssistantMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, content } : m
            ));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update message'));
        }
    };

    const handleClearChat = async (activeSceneId: string | null) => {
        if (!activeSceneId) {
            setAssistantMessages([]);
            return;
        }
        try {
            await scriptWriterApi.deleteAssistantHistory(activeSceneId);
            setAssistantMessages([]);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to clear chat'));
        }
    };

    return {
        scriptTemplates,
        scriptIdea,
        scriptFormat,
        scriptStyle,
        scriptOutput,
        assistantMessages,
        isAssistantThinking,
        scriptHistory,
        activeHistoryId,
        isScriptGenerating,
        selectedScriptCharacterIds,
        scriptLanguage,
        setScriptIdea,
        setScriptFormat,
        setScriptStyle,
        setScriptLanguage,
        handleScriptGenerate,
        handleAssistantSendMessage,
        handleApplyProposal,
        handleDiscardProposal,
        handleDeleteAssistantMessage,
        handleUpdateAssistantMessage,
        handleClearChat,
        handleScriptHistorySelect,
        toggleScriptCharacter
    };
}
