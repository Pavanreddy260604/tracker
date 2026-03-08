import { useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { ScriptHistoryItem, ScriptTemplates, IScriptDetail, ScriptRequest } from '../../services/scriptWriter.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { chatApi } from '../../services/chat.api';
import { getErrorMessage } from './utils';
import type { AssistantMessage } from './types';

interface UseScriptWriterGeneratorProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    activeSceneId?: string | null;
    editorContext?: string;
    setEditorContent?: (content: string) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterGenerator({
    activeProject,
    activeProjectId,
    activeSceneId,
    editorContext,
    setEditorContent,
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
    const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null);

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
        setAssistantSessionId(null);
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
                id: m._id?.toString?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: m.role,
                type: m.type === 'instruction' || m.type === 'thought' || m.type === 'proposal' || m.type === 'chat'
                    ? m.type
                    : 'chat',
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

    const isMongoObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);
    const isPersistedSceneMessage = (msg?: AssistantMessage) => !!msg && msg.type !== 'chat' && isMongoObjectId(msg.id);

    const buildSceneContext = () => {
        const contextParts: string[] = [];

        if (activeProject) {
            contextParts.push([
                'PROJECT CONTEXT',
                `Title: ${activeProject.title || ''}`,
                `Logline: ${activeProject.logline || ''}`,
                `Genre: ${activeProject.genre || ''}`,
                `Tone: ${activeProject.tone || ''}`,
                `Language: ${scriptLanguage || ''}`
            ].join('\n'));
        }

        if (activeSceneId) {
            contextParts.push(`ACTIVE SCENE CONTEXT\nScene ID: ${activeSceneId}`);
        }

        if (editorContext?.trim()) {
            const maxScriptChars = 12000;
            const clippedScript = editorContext.trim().slice(0, maxScriptChars);
            contextParts.push(`OPEN SCENE SCRIPT\n${clippedScript}`);
        }

        return contextParts.join('\n\n');
    };

    const handleAssistantSendMessage = async (content: string, activeSceneId: string | null, onUpdatePending?: (content: string, finished?: boolean) => void) => {
        const trimmedContent = content.trim();
        if (!trimmedContent || isAssistantThinking) return;

        const isEditCommand = /^\/edit\b/i.test(trimmedContent);
        const editInstruction = isEditCommand ? trimmedContent.replace(/^\/edit\b/i, '').trim() : '';
        const isSceneEditMode = isEditCommand && !!activeSceneId && !!editInstruction;

        const userMsg: AssistantMessage = {
            id: Date.now().toString(),
            role: 'user',
            type: isSceneEditMode ? 'instruction' : 'chat',
            content: isSceneEditMode ? editInstruction : trimmedContent,
            timestamp: Date.now()
        };

        setAssistantMessages(prev => [...prev, userMsg]);
        setIsAssistantThinking(true);

        try {
            if (isEditCommand && !activeSceneId) {
                const guidanceMsg: AssistantMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    type: 'chat',
                    content: 'Select a scene first, then use `/edit <instruction>` to generate a scene rewrite.',
                    timestamp: Date.now() + 1
                };
                setAssistantMessages(prev => [...prev, guidanceMsg]);
                return;
            }

            if (isEditCommand && !editInstruction) {
                const usageMsg: AssistantMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    type: 'chat',
                    content: 'Use `/edit <instruction>`. Example: `/edit tighten dialogue and add subtext`.',
                    timestamp: Date.now() + 1
                };
                setAssistantMessages(prev => [...prev, usageMsg]);
                return;
            }

            if (isSceneEditMode && activeSceneId) {
                // Assisted edit flow.
                const thoughtMsg: AssistantMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    type: 'thought',
                    content: 'Analyzing scene context and story bible...',
                    timestamp: Date.now() + 1
                };
                setAssistantMessages(prev => [...prev, thoughtMsg]);

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
                await scriptWriterApi.assistedEditStream(activeSceneId, editInstruction, (chunk) => {
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
                // Conversational assistant flow.
                let sessionId = assistantSessionId;
                if (!sessionId) {
                    const session = await chatApi.createChatSession(undefined, undefined, 'script-writer');
                    sessionId = session._id;
                    setAssistantSessionId(sessionId);
                }
                if (!sessionId) {
                    throw new Error('Failed to create chat session');
                }

                const botMsgId = (Date.now() + 1).toString();
                const botMsg: AssistantMessage = {
                    id: botMsgId,
                    role: 'assistant',
                    type: 'chat',
                    content: '',
                    timestamp: Date.now() + 1
                };
                setAssistantMessages(prev => [...prev, botMsg]);

                let botContent = '';
                let lastUiUpdate = Date.now();
                const sceneContext = buildSceneContext();

                await chatApi.sendChatMessage(sessionId, trimmedContent, (chunk) => {
                    botContent += chunk;
                    const now = Date.now();

                    if (now - lastUiUpdate > 90) {
                        lastUiUpdate = now;
                        const currentText = botContent;
                        setAssistantMessages(prev => prev.map(m =>
                            m.id === botMsgId ? { ...m, content: currentText } : m
                        ));
                    }
                }, undefined, 'script-writer', sceneContext);

                setAssistantMessages(prev => prev.map(m =>
                    m.id === botMsgId
                        ? { ...m, content: botContent.trim() ? botContent : 'No response from assistant.' }
                        : m
                ));
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Assistant request failed'));
            const failedMsg: AssistantMessage = {
                id: (Date.now() + 4).toString(),
                role: 'assistant',
                type: 'chat',
                content: 'Assistant request failed. Please retry.',
                timestamp: Date.now() + 4
            };
            setAssistantMessages(prev => [...prev, failedMsg]);
        } finally {
            setIsAssistantThinking(false);
        }
    };

    const handleApplyProposal = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;

        // Surgical Patch Check
        if (messageId.includes('|')) {
            const [realMsgId, base64Patch] = messageId.split('|');
            try {
                const patchContent = atob(base64Patch);
                const searchIndex = patchContent.indexOf('<<<SEARCH>>>');
                const replaceIndex = patchContent.indexOf('<<<REPLACE>>>');

                if (searchIndex !== -1 && replaceIndex !== -1 && editorContext) {
                    const oldText = patchContent.substring(searchIndex + 12, replaceIndex).trim();
                    const newText = patchContent.substring(replaceIndex + 13).trim();

                    if (editorContext.includes(oldText)) {
                        const updated = editorContext.replace(oldText, newText);
                        if (setEditorContent) {
                            setEditorContent(updated);
                        }
                    } else {
                        console.warn('Surgical patch target not found in editor.');
                        setError('Could not find the target text to apply this patch. You might have changed it manually.');
                    }
                }
            } catch (err) {
                console.error('Failed to parse surgical patch:', err);
            }

            setAssistantMessages(prev => prev.filter(m => m.id !== realMsgId));
            return;
        }

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
        const targetMsg = assistantMessages.find(m => m.id === messageId);
        if (!activeSceneId || !isPersistedSceneMessage(targetMsg)) {
            setAssistantMessages(prev => prev.filter(m => m.id !== messageId));
            return;
        }

        try {
            await scriptWriterApi.deleteAssistantHistory(activeSceneId, messageId);
            // Sync UI
            setAssistantMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete message'));
        }
    };

    const handleUpdateAssistantMessage = async (messageId: string, content: string, activeSceneId: string | null) => {
        const targetMsg = assistantMessages.find(m => m.id === messageId);
        if (!activeSceneId || !isPersistedSceneMessage(targetMsg)) {
            setAssistantMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, content } : m
            ));
            return;
        }

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
        const hasSceneEditMessages = assistantMessages.some(msg => msg.type !== 'chat');

        if (activeSceneId && hasSceneEditMessages) {
            try {
                await scriptWriterApi.deleteAssistantHistory(activeSceneId);
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to clear chat'));
                return;
            }
        }

        setAssistantMessages([]);
        setAssistantSessionId(null);
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







