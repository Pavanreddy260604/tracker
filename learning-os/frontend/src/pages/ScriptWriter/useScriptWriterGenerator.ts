import { useCallback, useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import type {
    AssistantContextPayload,
    ScriptHistoryItem,
    ScriptTemplates,
    IScriptDetail,
    ScriptRequest
} from '../../services/scriptWriter.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { chatApi } from '../../services/chat.api';
import {
    extractBestEffortAssistantAnswer,
    extractStructuredAssistantSections,
    getErrorMessage,
    normalizeScreenplayWhitespace
} from './utils';
import type { AssistantMessage, AssistantRequest, AssistantScope, EditorSelection } from './types';

type AssistantHistoryEntry = {
    _id?: { toString?: () => string } | string;
    role: 'user' | 'assistant';
    type?: string;
    content: string;
    timestamp: string | number | Date;
};

const ASSISTANT_EMPTY_RESPONSE = 'No response from assistant.';
const ASSISTANT_FAILURE_RESPONSE = 'Assistant request failed. Please retry.';

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
    activeSceneId,
    activeSceneName,
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
    const [assistantProgress, setAssistantProgress] = useState(0);
    const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null);

    const loadAssistantHistory = useCallback(async (sceneId: string) => {
        try {
            const history = await scriptWriterApi.getAssistantHistory(sceneId);
            const mappedMessages: AssistantMessage[] = (history as AssistantHistoryEntry[]).map((message) => ({
                id: typeof message._id === 'string'
                    ? message._id
                    : message._id?.toString?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: message.role,
                type: message.type === 'instruction' || message.type === 'thought' || message.type === 'proposal' || message.type === 'chat'
                    ? message.type
                    : 'chat',
                content: message.type === 'proposal'
                    ? normalizeScreenplayWhitespace(extractStructuredAssistantSections(message.content).script || message.content)
                    : extractBestEffortAssistantAnswer(message.content) || message.content,
                timestamp: new Date(message.timestamp).getTime(),
                status: message.type === 'proposal' ? 'pending' : undefined
            }));
            setAssistantMessages(mappedMessages);
        } catch (err) {
            console.error('Failed to load assistant history:', err);
        }
    }, []);

    const loadTemplates = useCallback(async () => {
        try {
            const templates = await scriptWriterApi.getTemplates();
            setScriptTemplates(templates);
            if (templates.formats.length > 0) setScriptFormat(templates.formats[0].id);
            if (templates.styles.length > 0) setScriptStyle(templates.styles[0].id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load templates'));
        }
    }, [setError]);

    const loadScriptHistory = useCallback(async () => {
        try {
            const history = await scriptWriterApi.getHistory();
            setScriptHistory(history);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script history'));
        }
    }, [setError]);

    useEffect(() => {
        void loadTemplates();
        void loadScriptHistory();
    }, [loadScriptHistory, loadTemplates]);

    useEffect(() => {
        if (activeProject?.logline && !scriptIdea) {
            setScriptIdea(activeProject.logline);
        }
        // Default to project language if available
        if (activeProject?.language) {
            setScriptLanguage(activeProject.language);
        }
    }, [activeProject, scriptIdea]);

    useEffect(() => {
        setSelectedScriptCharacterIds([]);
        setAssistantMessages([]); // Clear chat temporarily
        setAssistantSessionId(null);
        if (activeSceneId) {
            void loadAssistantHistory(activeSceneId);
        }
        if (!activeProjectId) {
            setScriptIdea('');
        }
    }, [activeProjectId, activeSceneId, loadAssistantHistory]);

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
    const buildSelectionLabel = (selection?: EditorSelection | null) =>
        selection ? `Lines ${selection.lineStart}-${selection.lineEnd}` : undefined;
    const assistantReplyLanguage = activeProject?.assistantPreferences?.replyLanguage || scriptLanguage;
    const assistantTransliteration = activeProject?.assistantPreferences?.transliteration ?? activeProject?.transliteration ?? false;

    const createLocalMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const buildSelectionPayload = (selection?: EditorSelection | null) => {
        if (!selection?.text?.trim()) {
            return null;
        }

        return {
            text: selection.text,
            start: selection.start,
            end: selection.end,
            lineStart: selection.lineStart,
            lineEnd: selection.lineEnd,
            lineCount: selection.lineCount,
            charCount: selection.charCount,
            preview: selection.preview
        };
    };

    const buildAssistantContext = (
        selection?: EditorSelection | null,
        scope: AssistantScope = 'scene'
    ): AssistantContextPayload => {
        const selectionPayload = scope === 'selection' ? buildSelectionPayload(selection) : null;

        return {
            project: activeProject ? {
                id: activeProject._id,
                title: activeProject.title,
                logline: activeProject.logline,
                genre: activeProject.genre,
                tone: activeProject.tone,
                language: activeProject.language || scriptLanguage
            } : undefined,
            scene: activeSceneId ? {
                id: activeSceneId,
                name: activeSceneName
            } : undefined,
            script: editorContext?.trim()
                ? { excerpt: editorContext.trim().slice(0, 12000) }
                : undefined,
            selection: selectionPayload,
            reply: {
                language: assistantReplyLanguage,
                transliteration: assistantTransliteration
            },
            assistantPreferences: activeProject?.assistantPreferences
        };
    };

    const buildAssistantPlaceholder = (
        type: AssistantMessage['type'],
        mode: AssistantRequest['mode'],
        scope: AssistantScope,
        selectionLabel?: string
    ): AssistantMessage => ({
        id: createLocalMessageId(),
        role: 'assistant',
        type,
        content: '',
        status: 'streaming',
        timestamp: Date.now(),
        mode,
        scope,
        selectionLabel
    });

    const updateAssistantMessage = (messageId: string | null, updater: (message: AssistantMessage) => AssistantMessage) => {
        if (!messageId) {
            return;
        }
        setAssistantMessages((prev) => prev.map((message) => (
            message.id === messageId ? updater(message) : message
        )));
    };

    const normalizeProposalPreview = (content: string, scope: AssistantScope) => {
        const cleaned = content.replace(/^RESPONSE:\s*/i, '').trim();
        if (scope !== 'scene') {
            return cleaned;
        }

        const extractedScreenplay = extractStructuredAssistantSections(cleaned).script;
        return normalizeScreenplayWhitespace(extractedScreenplay || cleaned);
    };

    const finalizeAssistantText = (content: string) => {
        const trimmed = extractBestEffortAssistantAnswer(content);
        return trimmed ? trimmed : ASSISTANT_EMPTY_RESPONSE;
    };

    const handleAssistantSendMessage = async (
        request: AssistantRequest,
        activeSceneId: string | null,
        onUpdatePending?: (content: string | null, finished?: boolean, request?: AssistantRequest, proposalMessageId?: string) => void
    ) => {
        const trimmedContent = request.content.trim();
        if (!trimmedContent || isAssistantThinking) return;

        const scope: AssistantScope = request.scope === 'selection' && request.selection?.text?.trim()
            ? 'selection'
            : 'scene';
        const isEditLike = request.mode !== 'ask';
        const selectionLabel = buildSelectionLabel(request.selection);

        const userMsg: AssistantMessage = {
            id: createLocalMessageId(),
            role: 'user',
            type: isEditLike ? 'instruction' : 'chat',
            content: trimmedContent,
            timestamp: Date.now(),
            mode: request.mode,
            scope,
            selectionLabel
        };

        setAssistantMessages(prev => [...prev, userMsg]);
        setIsAssistantThinking(true);
        setAssistantProgress(10);

        const thinkingInterval = setInterval(() => {
            setAssistantProgress(prev => {
                if (prev < 45) return prev + 2;
                if (prev < 60) return prev + 0.5;
                return prev;
            });
        }, 1000);

        let assistantPlaceholderId: string | null = null;
        const selectionPayload = buildSelectionPayload(scope === 'selection' ? request.selection : null);

        try {
            if (isEditLike && !activeSceneId) {
                const guidanceMsg: AssistantMessage = {
                    id: createLocalMessageId(),
                    role: 'assistant',
                    type: 'chat',
                    content: 'Select a scene first. Edit and agent modes work against an active scene in the editor.',
                    timestamp: Date.now(),
                    mode: request.mode,
                    scope,
                    selectionLabel
                };
                setAssistantMessages(prev => [...prev, guidanceMsg]);
                return;
            }

            if (activeSceneId) {
                const placeholder = buildAssistantPlaceholder(request.mode === 'ask' ? 'chat' : 'proposal', request.mode, scope, selectionLabel);
                assistantPlaceholderId = placeholder.id;
                setAssistantMessages((prev) => [...prev, placeholder]);

                clearInterval(thinkingInterval);
                setAssistantProgress(65);

                if (request.mode === 'ask') {
                    let botContent = '';
                    await scriptWriterApi.assistedEditStream(activeSceneId, trimmedContent, (chunk) => {
                        botContent += chunk;
                        updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                            ...message,
                            content: botContent
                        }));
                        setAssistantProgress(prev => {
                            const next = prev + 0.15;
                            return next > 98 ? 98 : next;
                        });
                    }, {
                        language: assistantReplyLanguage,
                        mode: 'ask',
                        target: scope,
                        currentContent: editorContext,
                        selection: selectionPayload,
                        transliteration: assistantTransliteration
                    });

                    updateAssistantMessage(assistantPlaceholderId, (message) => ({
                        ...message,
                        content: finalizeAssistantText(botContent),
                        status: undefined
                    }));
                    return;
                }

                let accumulated = '';
                await scriptWriterApi.assistedEditStream(activeSceneId, trimmedContent, (chunk) => {
                    accumulated += chunk;
                    const preview = normalizeProposalPreview(accumulated, scope);
                    updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                        ...message,
                        content: preview
                    }));
                    setAssistantProgress(prev => {
                        const next = prev + 0.15;
                        return next > 98 ? 98 : next;
                    });
                    if (onUpdatePending && scope === 'scene') {
                        onUpdatePending(preview, false, request, assistantPlaceholderId ?? undefined);
                    }
                }, {
                    language: scriptLanguage,
                    mode: request.mode,
                    target: scope,
                    currentContent: editorContext,
                    selection: selectionPayload,
                    transliteration: assistantTransliteration
                });

                const finalProposal = normalizeProposalPreview(accumulated, scope);
                if (!finalProposal.trim()) {
                    updateAssistantMessage(assistantPlaceholderId, (message) => ({
                        ...message,
                        type: 'chat',
                        content: ASSISTANT_EMPTY_RESPONSE,
                        status: 'error'
                    }));
                    if (onUpdatePending && scope === 'scene') {
                        onUpdatePending(null, true, request, assistantPlaceholderId ?? undefined);
                    }
                    return;
                }

                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: finalProposal,
                    status: 'pending'
                }));
                if (onUpdatePending && scope === 'scene') {
                    onUpdatePending(finalProposal, true, request, assistantPlaceholderId ?? undefined);
                }
                return;
            }

            const placeholder = buildAssistantPlaceholder('chat', request.mode, scope, selectionLabel);
            assistantPlaceholderId = placeholder.id;
            setAssistantMessages((prev) => [...prev, placeholder]);

            clearInterval(thinkingInterval);
            setAssistantProgress(65);

            if (activeProjectId && request.mode === 'ask') {
                let botContent = '';
                await scriptWriterApi.projectAssistantStream(activeProjectId, trimmedContent, (chunk) => {
                    botContent += chunk;
                    updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                        ...message,
                        content: botContent
                    }));
                }, {
                    language: assistantReplyLanguage,
                    mode: 'ask',
                    target: scope,
                    currentContext: buildAssistantContext(request.selection, scope),
                    selection: selectionPayload
                });

                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: finalizeAssistantText(botContent),
                    status: undefined
                }));
                return;
            }

            let sessionId = assistantSessionId;
            if (!sessionId) {
                const session = await chatApi.createChatSession(undefined, undefined, 'script-writer');
                sessionId = session._id;
                setAssistantSessionId(sessionId);
            }
            if (!sessionId) {
                throw new Error('Failed to create chat session');
            }

            let botContent = '';
            let lastUiUpdate = Date.now();
            const sceneContext = buildAssistantContext(request.selection, scope);

            await chatApi.sendChatMessage(sessionId, trimmedContent, (chunk) => {
                botContent += chunk;
                const now = Date.now();

                if (now - lastUiUpdate > 90) {
                    lastUiUpdate = now;
                    const currentText = botContent;
                    updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                        ...message,
                        content: currentText
                    }));
                }
            }, undefined, 'script-writer', sceneContext);

            updateAssistantMessage(assistantPlaceholderId, (message) => ({
                ...message,
                content: finalizeAssistantText(botContent),
                status: undefined
            }));
        } catch (err) {
            setError(getErrorMessage(err, 'Assistant request failed'));
            if (assistantPlaceholderId) {
                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    type: 'chat',
                    content: ASSISTANT_FAILURE_RESPONSE,
                    status: 'error'
                }));
            }
            if (onUpdatePending && scope === 'scene' && isEditLike) {
                onUpdatePending(null, true, request, assistantPlaceholderId ?? undefined);
            }
        } finally {
            clearInterval(thinkingInterval);
            setAssistantProgress(100);
            setTimeout(() => {
                setIsAssistantThinking(false);
                setAssistantProgress(0);
            }, 800);
        }
    };

    const handleApplyProposal = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;

        // Surgical Patch Check
        if (messageId.includes('|')) {
            const [realMsgId, base64Patch] = messageId.split('|');
            try {
                const patchContent = decodeURIComponent(atob(base64Patch));
                const searchIndex = patchContent.indexOf('<<<SEARCH>>>');
                const replaceIndex = patchContent.indexOf('<<<REPLACE>>>');

                if (searchIndex !== -1 && replaceIndex !== -1 && editorContext) {
                    const oldTextRaw = patchContent.substring(searchIndex + 12, replaceIndex);
                    const newTextRaw = patchContent.substring(replaceIndex + 13);

                    // Clean and normalize both
                    const oldText = oldTextRaw.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
                    const newText = newTextRaw.replace(/^\r?\n/, '').replace(/\r?\n$/, '');

                    // Helper for robust search
                    const normalizeForSearch = (t: string) => t.replace(/\r/g, '').trim();
                    const normalizedEditor = normalizeForSearch(editorContext);
                    const normalizedOld = normalizeForSearch(oldText);

                    if (editorContext.includes(oldText)) {
                        // Perfect match
                        const updated = editorContext.replace(oldText, newText);
                        if (setEditorContent) setEditorContent(updated);
                    } else if (normalizedEditor.includes(normalizedOld)) {
                        // Whitespace-normalized match
                        // We need to find the actual start in the original editorContext to avoid breaking formatting
                        // This is a bit tricky, but we can attempt a simpler replacement if the first one fails
                        const regexOld = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g');
                        const updated = editorContext.replace(regexOld, newText);

                        if (updated !== editorContext) {
                            if (setEditorContent) setEditorContent(updated);
                        } else {
                            setError('Patch failed: The text was found but could not be safely replaced due to formatting conflicts.');
                            return;
                        }
                    } else {
                        console.warn('Surgical patch target not found in editor.');
                        console.log('Normalized Old:', JSON.stringify(normalizedOld));

                        // Fallback: Notify user with specific context
                        const preview = oldText.length > 50 ? oldText.slice(0, 50) + '...' : oldText;
                        setError(`Could not apply patch. The original text ("${preview}") was not found exactly as expected. Please apply manually or try a new edit request.`);
                        return;
                    }
                }
            } catch (err) {
                console.error('Failed to parse surgical patch:', err);
                setError('Failed to process the AI patch. Please try again.');
            }

            setAssistantMessages(prev => prev.filter(m => m.id !== realMsgId));
            return;
        }

        // Optimization: Immediate disappearance from UI
        setAssistantMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            console.log(`[Assistant] Applying proposal for scene ${activeSceneId}`);
            const result = await scriptWriterApi.commitEdit(activeSceneId);
            console.log(`[Assistant] Commit result for ${activeSceneId}:`, result);

            if (!result || !result.success) {
                setError('Failed to apply edit. Ensure you have an active scene with a pending change.');
            }
        } catch (err) {
            console.error('[Assistant] Apply failed:', err);
            setError(getErrorMessage(err, 'Failed to apply edit'));
        }
    };

    const handleDiscardProposal = async (messageId: string, activeSceneId: string | null) => {
        if (!activeSceneId) return;
        // Optimization: Immediate disappearance from UI
        setAssistantMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            console.log(`[Assistant] Discarding proposal for scene ${activeSceneId}`);
            const result = await scriptWriterApi.discardEdit(activeSceneId);
            console.log(`[Assistant] Discard result for ${activeSceneId}:`, result);

            if (!result || !result.success) {
                setError('Failed to discard edit');
            }
        } catch (err) {
            console.error('[Assistant] Discard failed:', err);
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
        assistantProgress,
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
