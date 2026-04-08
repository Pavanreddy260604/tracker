import { useState, useCallback, useEffect } from 'react';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { ScriptRequest, AssistantContextPayload, AssistedEditOptions, ProjectAssistantOptions } from '../../../services/scriptWriter.api';
import { chatApi } from '../../../services/chat.api';
import {
    extractBestEffortAssistantAnswer,
    extractStructuredAssistantSections,
    getErrorMessage,
    normalizeScreenplayWhitespace,
    detectLanguageOverride,
    detectTransliteration,
    classifyAssistantIntent
} from '../utils';
import type { AssistantMessage, AssistantRequest, AssistantScope, EditorSelection } from '../types';
import type { Bible } from '../../../services/project.api';

const ASSISTANT_EMPTY_RESPONSE = 'No response from assistant.';
const ASSISTANT_FAILURE_RESPONSE = 'Assistant request failed. Please retry.';
const isPatchProposal = (content: string) => content.includes('<<<SEARCH>>>') && content.includes('<<<REPLACE>>>');

export interface ApplyProposalResult {
    success?: boolean;
    requiresReview?: boolean;
    originalContent?: string;
    newContent?: string;
    messageId?: string;
    content?: string;
}

interface UseAssistantStreamProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    activeSceneId: string | null;
    activeSceneName?: string;
    editorContext?: string;
    scriptLanguage: string;
    aiModel: string;
    setError: (msg: string | null) => void;
}

export function useAssistantStream({
    activeProject,
    activeProjectId,
    activeSceneId,
    activeSceneName,
    editorContext,
    scriptLanguage,
    aiModel,
    setError
}: UseAssistantStreamProps) {
    const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
    const [isAssistantThinking, setIsAssistantThinking] = useState(false);
    const [assistantStatus, setAssistantStatus] = useState<'idle' | 'thinking' | 'streaming' | 'error'>('idle');
    const [assistantProgress, setAssistantProgress] = useState(0);
    const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null);

    const loadAssistantHistory = useCallback(async (sceneId: string) => {
        try {
            const history = await scriptWriterApi.getAssistantHistory(sceneId);
            const mappedMessages: AssistantMessage[] = (history as any[]).map((message) => ({
                id: typeof message._id === 'string'
                    ? message._id
                    : message._id?.toString?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: message.role,
                type: message.type === 'instruction' || message.type === 'thought' || message.type === 'proposal' || message.type === 'chat'
                    ? message.type
                    : 'chat',
                content: message.type === 'proposal'
                    ? (() => {
                        const isPatch = isPatchProposal(message.content);
                        const sections = extractStructuredAssistantSections(message.content);
                        return isPatch ? message.content : normalizeScreenplayWhitespace(sections.script || message.content);
                    })()
                    : extractBestEffortAssistantAnswer(message.content) || message.content,
                timestamp: new Date(message.timestamp).getTime(),
                status: message.status || (message.type === 'proposal' ? 'pending' : undefined),
                metadata: {
                    research: message.metadata?.research,
                    plan: message.metadata?.plan,
                    explanation: message.metadata?.explanation || (message.metadata?.craft),
                    summary: message.metadata?.summary
                }
            }));
            setAssistantMessages(mappedMessages);
        } catch (err) {
            console.error('Failed to load assistant history:', err);
        }
    }, []);

    useEffect(() => {
        if (activeSceneId && !isAssistantThinking) {
            void loadAssistantHistory(activeSceneId);
        }
    }, [activeSceneId, isAssistantThinking, loadAssistantHistory]);

    const createLocalMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const updateAssistantMessage = useCallback((messageId: string | null, updater: (message: AssistantMessage) => AssistantMessage) => {
        if (!messageId) return;
        setAssistantMessages((prev) => prev.map((message) => (
            message.id === messageId ? updater(message) : message
        )));
    }, []);

    const buildAssistantContext = useCallback((
        selection?: EditorSelection | null,
        scope: AssistantScope = 'scene',
        replyLanguageOverride?: string,
        transliterationOverride?: boolean
    ): AssistantContextPayload => {
        const selectionPayload = scope === 'selection' && selection ? {
            text: selection.text,
            start: selection.start,
            end: selection.end,
            lineStart: selection.lineStart,
            lineEnd: selection.lineEnd,
            lineCount: selection.lineCount,
            charCount: selection.charCount,
            preview: selection.preview
        } : null;

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
                language: replyLanguageOverride || activeProject?.assistantPreferences?.replyLanguage || scriptLanguage,
                transliteration: transliterationOverride ?? activeProject?.assistantPreferences?.transliteration ?? activeProject?.transliteration ?? false
            },
            assistantPreferences: activeProject?.assistantPreferences
        };
    }, [activeProject, activeSceneId, activeSceneName, editorContext, scriptLanguage]);

    const handleAssistantSendMessage = async (
        request: AssistantRequest,
        onUpdatePending?: (content: string | null, finished?: boolean, request?: AssistantRequest, proposalMessageId?: string) => void
    ) => {
        const trimmedContent = request.content.trim();
        if (!trimmedContent || isAssistantThinking) return;

        let assistantPlaceholderId: string | null = null;
        let thinkingInterval: any = null;

        try {
            const scope: AssistantScope = request.scope === 'selection' && request.selection?.text?.trim()
                ? 'selection'
                : 'scene';

            const userMsg: AssistantMessage = {
                id: createLocalMessageId(),
                role: 'user',
                type: 'chat', 
                content: trimmedContent,
                timestamp: Date.now(),
                scope,
                selectionLabel: request.selection ? `Lines ${request.selection.lineStart}-${request.selection.lineEnd}` : undefined
            };

            const placeholder: AssistantMessage = {
                id: createLocalMessageId(),
                role: 'assistant',
                type: 'chat',
                content: '',
                status: 'streaming',
                timestamp: Date.now(),
                scope,
                selectionLabel: userMsg.selectionLabel,
                metadata: {
                    analyzedFiles: [
                        { name: 'hollywood.ts', type: 'code' },
                        { name: 'screenplayFormatting.ts', type: 'code' }
                    ],
                    thoughtDuration: 0
                }
            };
            assistantPlaceholderId = placeholder.id;

            setAssistantMessages(prev => [...prev, userMsg, placeholder]);

            let startTime = Date.now();
            thinkingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                    ...message,
                    metadata: {
                        ...message.metadata,
                        thoughtDuration: elapsed
                    }
                }));
                setAssistantProgress(prev => {
                    if (prev < 40) return prev + (40 - prev) * 0.1;
                    return prev;
                });
            }, 1000);

            // Phase 1: Classification & Intent
            setIsAssistantThinking(true);
            setAssistantStatus('thinking');
            setAssistantProgress(10);

            let classification: { intent: AssistantIntent, confidence: number };
            try {
                classification = await scriptWriterApi.classifyIntent(trimmedContent, {
                    hasScene: Boolean(activeSceneId),
                    hasSelection: Boolean(request.selection?.text?.trim()),
                    currentMode: activeProject?.assistantPreferences?.defaultMode || 'ask'
                });
            } catch (err) {
                console.warn('[AssistantV2] Classification failed, falling back to local:', err);
                classification = { intent: 'ambiguous', confidence: 0 };
            }

            setAssistantProgress(30);

            console.info('[AssistantV2] intent classification result:', classification);
            let intent = classification?.intent;
            
            // Fallback to local classification if confidence is low, failed, or malformed
            if (!classification || !intent || classification.confidence < 0.3) {
                const localIntent = classifyAssistantIntent(trimmedContent, scope, Boolean(request.selection?.text?.trim()));
                intent = localIntent?.intent || 'ambiguous';
            }

            const isEditLike = intent === 'selection_edit' || intent === 'scene_edit';

            // Update user message type and placeholder type based on classification
            const intentScope = intent === 'selection_edit' ? 'selection' : 'scene';
            setAssistantMessages(prev => prev.map(m => {
                if (m.id === userMsg.id) return { ...m, type: isEditLike ? 'instruction' : 'chat', scope: isEditLike ? intentScope : m.scope };
                if (m.id === placeholder.id) return { ...m, type: isEditLike ? 'proposal' : 'chat', scope: isEditLike ? intentScope : m.scope };
                return m;
            }));

            if (intent === 'ambiguous') {
                updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                    ...message,
                    status: undefined,
                    content: 'Do you want analysis or a rewrite? If you want changes, tell me what to change or say \"rewrite it\".'
                }));
                setAssistantStatus('idle');
                return;
            }

            const baseLanguage = activeProject?.language || scriptLanguage;
            const overrideLanguage = detectLanguageOverride(trimmedContent);
            const replyLanguage = overrideLanguage || activeProject?.assistantPreferences?.replyLanguage || baseLanguage;
            const transliterationEnabled = detectTransliteration(trimmedContent, replyLanguage, activeProject?.assistantPreferences?.transliteration ?? false).enabled;

            const selectionPayload = (scope === 'selection' && request.selection) ? {
                text: request.selection.text,
                start: request.selection.start,
                end: request.selection.end,
                lineStart: request.selection.lineStart,
                lineEnd: request.selection.lineEnd,
                lineCount: request.selection.lineCount,
                charCount: request.selection.charCount,
                preview: request.selection.preview
            } : null;

            if (isEditLike && !activeSceneId) {
                updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                    ...message,
                    status: undefined,
                    content: 'Select a scene first to apply changes.'
                }));
                setAssistantStatus('idle');
                return;
            }

            if (activeSceneId) {
                let accumulated = '';
                let lastPreviewUpdate = 0;
                const PREVIEW_THROTTLE_MS = 150;

                await scriptWriterApi.assistedEditStream(activeSceneId, trimmedContent, (chunk: string) => {
                    accumulated += chunk;
                    if (thinkingInterval) { clearInterval(thinkingInterval); thinkingInterval = null; }
                    
                    const now = Date.now();
                    if (now - lastPreviewUpdate > PREVIEW_THROTTLE_MS) {
                        const sections = isEditLike ? extractStructuredAssistantSections(accumulated.replace(/^RESPONSE:\s*/i, '')) : null;
                        const preview = (isEditLike && sections) 
                            ? (sections.script || accumulated.replace(/^RESPONSE:\s*/i, ''))
                            : accumulated;

                        updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                            ...message,
                            content: isEditLike ? normalizeScreenplayWhitespace(preview) : preview,
                            metadata: sections ? {
                                research: sections.research,
                                plan: sections.plan,
                                explanation: sections.craft,
                                summary: sections.summary
                            } : message.metadata
                        }));
                        lastPreviewUpdate = now;
                    }
                    
                    setAssistantProgress(prev => Math.min(98, prev + (98 - prev) * 0.05));
                    
                    if (onUpdatePending && isEditLike && scope === 'scene') {
                        // For the editor preview, we still want it to be relatively fresh but throttled
                        onUpdatePending(accumulated, false, request, assistantPlaceholderId ?? undefined);
                    }
                }, {
                    language: isEditLike ? (overrideLanguage || baseLanguage) : replyLanguage,
                    mode: isEditLike ? 'agent' : 'ask',
                    target: scope,
                    currentContent: editorContext,
                    selection: selectionPayload,
                    transliteration: transliterationEnabled,
                    model: aiModel || undefined
                });

                const finalResponse = isEditLike ? accumulated : extractBestEffortAssistantAnswer(accumulated) || accumulated;

                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: finalResponse,
                    status: isEditLike ? 'pending' : undefined
                }));

                if (onUpdatePending && isEditLike && scope === 'scene') {
                    onUpdatePending(finalResponse, true, request, assistantPlaceholderId ?? undefined);
                }
            } else if (activeProjectId) {
                // Project-level chat
                let accumulated = '';
                await scriptWriterApi.projectAssistantStream(activeProjectId, trimmedContent, (chunk: string) => {
                    accumulated += chunk;
                    if (thinkingInterval) { clearInterval(thinkingInterval); thinkingInterval = null; }
                    updateAssistantMessage(assistantPlaceholderId!, (message) => ({ ...message, content: accumulated }));
                    setAssistantProgress(prev => Math.min(98, prev + (98 - prev) * 0.05));
                }, {
                    language: replyLanguage,
                    mode: 'ask',
                    target: scope,
                    currentContext: buildAssistantContext(request.selection, scope, replyLanguage, transliterationEnabled),
                    selection: selectionPayload,
                    transliteration: transliterationEnabled,
                    model: aiModel || undefined
                });

                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: extractBestEffortAssistantAnswer(accumulated) || accumulated,
                    status: undefined
                }));
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Assistant request failed'));
            if (assistantPlaceholderId) {
                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: ASSISTANT_FAILURE_RESPONSE,
                    status: 'error'
                }));
            }
        } finally {
            if (thinkingInterval) clearInterval(thinkingInterval);
            setAssistantProgress(100);
            setTimeout(() => {
                setIsAssistantThinking(false);
                setAssistantStatus('idle');
                setAssistantProgress(0);
            }, 800);
        }
    };

    const handleClearChat = useCallback(async () => {
        if (activeSceneId) {
            try {
                await scriptWriterApi.deleteAssistantHistory(activeSceneId);
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to clear chat'));
                return;
            }
        }
        setAssistantMessages([]);
        setAssistantSessionId(null);
    }, [activeSceneId, setError]);

    return {
        assistantMessages,
        setAssistantMessages,
        isAssistantThinking,
        assistantStatus,
        assistantProgress,
        handleAssistantSendMessage,
        handleClearChat,
        handleApplyProposal: async (messageId: string): Promise<ApplyProposalResult> => {
            if (!activeSceneId) return { success: false };

            // Local Patch Application (Selection edits)
            if (messageId.includes('|')) {
                const [realMsgId, base64Patch] = messageId.split('|');
                try {
                    const patchContent = decodeURIComponent(atob(base64Patch));
                    const searchMarker = '<<<SEARCH>>>';
                    const replaceMarker = '<<<REPLACE>>>';
                    const searchIndex = patchContent.indexOf(searchMarker);
                    const replaceIndex = patchContent.indexOf(replaceMarker);

                    if (searchIndex !== -1 && replaceIndex !== -1 && editorContext) {
                        const oldTextRaw = patchContent.substring(searchIndex + searchMarker.length, replaceIndex);
                        const newTextRaw = patchContent.substring(replaceIndex + replaceMarker.length);
                        const clean = (t: string) => t.replace(/\r/g, '').replace(/^\n/, '').replace(/\n$/, '');
                        const oldText = clean(oldTextRaw);
                        const newText = clean(newTextRaw);

                        const searchPattern = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
                        const regex = new RegExp(searchPattern, 'g');
                        const updated = editorContext.replace(regex, newText);

                        if (updated !== editorContext) {
                            // INTERCEPT: Return for review instead of applying
                            return { 
                                requiresReview: true, 
                                originalContent: editorContext, 
                                newContent: updated, 
                                messageId: realMsgId 
                            };
                        }
                    }
                } catch (err) {
                    console.error('Failed to parse surgical patch:', err);
                }
                // setAssistantMessages(prev => prev.filter(m => m.id !== realMsgId)); // REMOVED: Don't delete message!
                return { success: false };
            }

            // Full Scene Edit Application
            try {
                // Fetch the proposed revision from the server *before* committing it
                const sceneResult = await scriptWriterApi.getScene(activeSceneId);
                const proposedContent = sceneResult.assistantDraft;
                
                if (proposedContent && proposedContent !== editorContext) {
                    // INTERCEPT: Return for review
                    return {
                        requiresReview: true,
                        originalContent: editorContext || '',
                        newContent: proposedContent,
                        messageId: messageId
                    };
                }

                // Fallback (shouldn't hit this if draft exists)
                return { success: false };
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to fetch proposal for review'));
                return { success: false };
            }
        },
        handleConfirmEdit: async (messageId: string, updatedContent?: string): Promise<ApplyProposalResult> => {
            if (!activeSceneId) return { success: false };

            setAssistantMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'applied' } : m));
            
            try {
                if (updatedContent) {
                    // It was a local patch, so we just return the string for the caller to apply
                    return { success: true, content: updatedContent, messageId };
                } else {
                    // It was a full scene commit
                    const result = await scriptWriterApi.commitEdit(activeSceneId);
                    return { success: result?.success ?? false, messageId };
                }
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to confirm edit'));
                return { success: false };
            }
        },
        handleDiscardProposal: async (messageId: string) => {
            if (!activeSceneId) return;
            setAssistantMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'discarded' } : m));
            try {
                await scriptWriterApi.discardEdit(activeSceneId);
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to discard edit'));
            }
        },
        handleDeleteAssistantMessage: async (messageId: string) => {
            const isMongoId = /^[a-f0-9]{24}$/i.test(messageId);
            if (!activeSceneId || !isMongoId) {
                setAssistantMessages(prev => prev.filter(m => m.id !== messageId));
                return;
            }
            try {
                await scriptWriterApi.deleteAssistantHistory(activeSceneId, messageId);
                setAssistantMessages(prev => prev.filter(m => m.id !== messageId));
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to delete message'));
            }
        },
        handleUpdateAssistantMessage: async (messageId: string, content: string) => {
            const isMongoId = /^[a-f0-9]{24}$/i.test(messageId);
            if (!activeSceneId || !isMongoId) {
                setAssistantMessages(prev => prev.map(m => m.id === messageId ? { ...m, content } : m));
                return;
            }
            try {
                await scriptWriterApi.updateAssistantHistory(activeSceneId, messageId, content);
                setAssistantMessages(prev => prev.map(m => m.id === messageId ? { ...m, content } : m));
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to update message'));
            }
        }
    };
}
