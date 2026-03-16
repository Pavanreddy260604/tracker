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
    normalizeScreenplayWhitespace,
    classifyAssistantIntent,
    detectLanguageOverride,
    detectTransliteration
} from './utils';
import type { AssistantMessage, AssistantRequest, AssistantScope, EditorSelection } from './types';

type AssistantHistoryEntry = {
    _id?: { toString?: () => string } | string;
    role: 'user' | 'assistant';
    type?: string;
    content: string;
    timestamp: string | number | Date;
    metadata?: {
        explanation?: string[];
        analysis?: string;
        plan?: string;
        craft?: string;
    };
};

const ASSISTANT_EMPTY_RESPONSE = 'No response from assistant.';
const ASSISTANT_FAILURE_RESPONSE = 'Assistant request failed. Please retry.';
const ASSISTANT_V2_ENABLED = String(import.meta.env?.VITE_ASSISTANT_V2 ?? 'true').toLowerCase() !== 'false';

const isPatchProposal = (content: string) => content.includes('<<<SEARCH>>>') && content.includes('<<<REPLACE>>>');

const formatExplanationBlock = (explanations?: string[]) => {
    if (!explanations || explanations.length === 0) return '';
    const bullets = explanations.slice(0, 7).map((item) => `- ${item}`);
    return ['**What I improved**', ...bullets].join('\n');
};

const buildCombinedProposalContent = (proposal: string, explanations?: string[]) => {
    const explanationBlock = formatExplanationBlock(explanations);
    if (!explanationBlock) return proposal;
    if (isPatchProposal(proposal)) {
        return `${explanationBlock}\n\n${proposal}`;
    }
    return `${explanationBlock}\n\n**Revised Scene**\n\n\`\`\`fountain\n${proposal}\n\`\`\``;
};

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
    const [aiModel, setAiModel] = useState<string>('');

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
                    ? (() => {
                        const isPatch = isPatchProposal(message.content);
                        const baseContent = isPatch
                            ? message.content
                            : normalizeScreenplayWhitespace(extractStructuredAssistantSections(message.content).script || message.content);
                        return ASSISTANT_V2_ENABLED
                            ? buildCombinedProposalContent(baseContent, message.metadata?.explanation)
                            : baseContent;
                    })()
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
        // Default to project language if available and not yet customized
        if (activeProject?.language && scriptLanguage === 'English' && activeProject.language !== 'English') {
            setScriptLanguage(activeProject.language);
        }
    }, [activeProject, scriptIdea]); // Removed scriptLanguage from deps to prevent re-sync after user change

    const [lastLoadedSceneId, setLastLoadedSceneId] = useState<string | null>(null);

    useEffect(() => {
        if (activeSceneId && activeSceneId !== lastLoadedSceneId && !isAssistantThinking) {
            setLastLoadedSceneId(activeSceneId);
            setSelectedScriptCharacterIds([]);
            setAssistantMessages([]); 
            setAssistantSessionId(null);
            void loadAssistantHistory(activeSceneId);
        }
    }, [activeSceneId, lastLoadedSceneId, isAssistantThinking, loadAssistantHistory]);

    useEffect(() => {
        if (!activeProjectId) {
            setScriptIdea('');
            setAssistantMessages([]);
            setAssistantSessionId(null);
        }
    }, [activeProjectId]);

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
        scope: AssistantScope = 'scene',
        replyLanguageOverride?: string,
        transliterationOverride?: boolean
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
                language: replyLanguageOverride || assistantReplyLanguage,
                transliteration: transliterationOverride ?? assistantTransliteration
            },
            assistantPreferences: activeProject?.assistantPreferences
        };
    };

    const buildAssistantPlaceholder = (
        type: AssistantMessage['type'],
        scope: AssistantScope,
        selectionLabel?: string
    ): AssistantMessage => ({
        id: createLocalMessageId(),
        role: 'assistant',
        type,
        content: '',
        status: 'streaming',
        timestamp: Date.now(),
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
        const selectionLabel = buildSelectionLabel(request.selection);
        const intentDecision = classifyAssistantIntent(trimmedContent, scope, Boolean(request.selection?.text?.trim()));
        let intent = intentDecision.intent;
        
        // Elite ML Bias: If frontend is unsure, lean on project preferences
        if (intentDecision.confidence < 0.6) {
            const defaultMode = activeProject?.assistantPreferences?.defaultMode || 'ask';
            if (defaultMode === 'edit') {
                intent = scope === 'selection' ? 'selection_edit' : 'scene_edit';
            } else {
                intent = 'chat';
            }
        }

        const isEditLike = intent === 'selection_edit' || intent === 'scene_edit';
        const requestForPending: AssistantRequest = {
            ...request,
            mode: isEditLike ? 'agent' : 'ask'
        };

        const baseLanguage = activeProject?.language || scriptLanguage;
        const overrideLanguage = detectLanguageOverride(trimmedContent);
        const replyLanguage = overrideLanguage || assistantReplyLanguage || baseLanguage;
        const fallbackTransliteration = Boolean(assistantTransliteration);
        const transliterationDecision = detectTransliteration(trimmedContent, overrideLanguage || replyLanguage || baseLanguage, fallbackTransliteration);
        const requestTransliteration = transliterationDecision.enabled;
        const targetLanguage = overrideLanguage || baseLanguage;

        if (ASSISTANT_V2_ENABLED) {
            console.info('[AssistantV2] routing', {
                intent,
                confidence: intentDecision.confidence,
                targetLanguage,
                replyLanguage,
                overrideLanguage: overrideLanguage || null,
                transliteration: requestTransliteration,
                transliterationConfidence: transliterationDecision.confidence,
                transliterationReason: transliterationDecision.reason
            });
        }

        const userMsg: AssistantMessage = {
            id: createLocalMessageId(),
            role: 'user',
            type: isEditLike ? 'instruction' : 'chat',
            content: trimmedContent,
            timestamp: Date.now(),
            scope,
            selectionLabel
        };

        setAssistantMessages(prev => [...prev, userMsg]);

        if (intent === 'ambiguous') {
            const clarification: AssistantMessage = {
                id: createLocalMessageId(),
                role: 'assistant',
                type: 'chat',
                content: 'Do you want analysis or a rewrite? If you want changes, tell me what to change or say \"rewrite it\".',
                timestamp: Date.now(),
                scope,
                selectionLabel
            };
            setAssistantMessages(prev => [...prev, clarification]);
            return;
        }

        setIsAssistantThinking(true);
        setAssistantProgress(5);

        let thinkingInterval: any = setInterval(() => {
            setAssistantProgress(prev => {
                if (prev < 40) return prev + (40 - prev) * 0.1;
                return prev;
            });
        }, 800);

        let assistantPlaceholderId: string | null = null;
        const selectionPayload = buildSelectionPayload(scope === 'selection' ? request.selection : null);

        try {
            if (isEditLike && !activeSceneId) {
                const guidanceMsg: AssistantMessage = {
                    id: createLocalMessageId(),
                    role: 'assistant',
                    type: 'chat',
                    content: 'Select a scene first to apply changes. If you want analysis without a scene, ask a question.',
                    timestamp: Date.now(),
                    scope,
                    selectionLabel
                };
                setAssistantMessages(prev => [...prev, guidanceMsg]);
                return;
            }

            if (activeSceneId) {
                const placeholder = buildAssistantPlaceholder(isEditLike ? 'proposal' : 'chat', scope, selectionLabel);
                assistantPlaceholderId = placeholder.id;
                setAssistantMessages((prev) => [...prev, placeholder]);

                // Interval will be cleared when first chunk arrives OR in finally block

                if (!isEditLike) {
                    let botContent = '';
                    await scriptWriterApi.assistedEditStream(activeSceneId, trimmedContent, (chunk) => {
                        botContent += chunk;
                        updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                            ...message,
                            content: botContent
                        }));
                        setAssistantProgress(prev => {
                            if (thinkingInterval) {
                                clearInterval(thinkingInterval);
                                thinkingInterval = null;
                            }
                            const next = prev + (98 - prev) * 0.05;
                            return next > 98 ? 98 : next;
                        });
                    }, {
                        language: replyLanguage,
                        mode: 'ask',
                        target: scope,
                        currentContent: editorContext,
                        selection: selectionPayload,
                        transliteration: requestTransliteration,
                        model: aiModel || undefined
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
                        if (thinkingInterval) {
                            clearInterval(thinkingInterval);
                            thinkingInterval = null;
                        }
                        const next = prev + (98 - prev) * 0.05;
                        return next > 98 ? 98 : next;
                    });
                    if (onUpdatePending && scope === 'scene') {
                        onUpdatePending(preview, false, requestForPending, assistantPlaceholderId ?? undefined);
                    }
                }, {
                    language: targetLanguage,
                    mode: 'agent',
                    target: scope,
                    currentContent: editorContext,
                    selection: selectionPayload,
                    transliteration: requestTransliteration,
                    model: aiModel || undefined
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
                        onUpdatePending(null, true, requestForPending, assistantPlaceholderId ?? undefined);
                    }
                    return;
                }

                let enhancedProposal = finalProposal;
                if (ASSISTANT_V2_ENABLED && activeSceneId) {
                    try {
                        const history = await scriptWriterApi.getAssistantHistory(activeSceneId);
                        const latest = [...(history as AssistantHistoryEntry[])].reverse().find((entry) => entry.role === 'assistant' && entry.type === 'proposal' && entry.metadata?.explanation?.length);
                        if (latest?.metadata?.explanation?.length) {
                            enhancedProposal = buildCombinedProposalContent(finalProposal, latest.metadata.explanation);
                        }
                    } catch (err) {
                        console.warn('[AssistantV2] Failed to load explanation metadata:', err);
                    }
                }

                updateAssistantMessage(assistantPlaceholderId, (message) => ({
                    ...message,
                    content: enhancedProposal,
                    status: 'pending'
                }));
                if (onUpdatePending && scope === 'scene') {
                    onUpdatePending(finalProposal, true, requestForPending, assistantPlaceholderId ?? undefined);
                }
                return;
            }

            const placeholder = buildAssistantPlaceholder('chat', scope, selectionLabel);
            assistantPlaceholderId = placeholder.id;
            setAssistantMessages((prev) => [...prev, placeholder]);

            clearInterval(thinkingInterval!);
            thinkingInterval = null;
            // No jump to 65%

            if (activeProjectId) {
                let botContent = '';
                await scriptWriterApi.projectAssistantStream(activeProjectId, trimmedContent, (chunk) => {
                    botContent += chunk;
                    updateAssistantMessage(assistantPlaceholderId!, (message) => ({
                        ...message,
                        content: botContent
                    }));
                    setAssistantProgress(prev => {
                        const next = prev + (98 - prev) * 0.05;
                        return next > 98 ? 98 : next;
                    });
                }, {
                    language: replyLanguage,
                    mode: 'ask',
                    target: scope,
                    currentContext: buildAssistantContext(request.selection, scope, replyLanguage, requestTransliteration),
                    selection: selectionPayload,
                    transliteration: requestTransliteration,
                    model: aiModel || undefined
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
            const sceneContext = buildAssistantContext(request.selection, scope, replyLanguage, requestTransliteration);

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
                    setAssistantProgress(prev => {
                        const next = prev + (98 - prev) * 0.05;
                        return next > 98 ? 98 : next;
                    });
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
                onUpdatePending(null, true, requestForPending, assistantPlaceholderId ?? undefined);
            }
        } finally {
            if (thinkingInterval) clearInterval(thinkingInterval);
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
                const searchMarker = '<<<SEARCH>>>';
                const replaceMarker = '<<<REPLACE>>>';
                const searchIndex = patchContent.indexOf(searchMarker);
                const replaceIndex = patchContent.indexOf(replaceMarker);

                if (searchIndex !== -1 && replaceIndex !== -1 && editorContext) {
                    const oldTextRaw = patchContent.substring(searchIndex + searchMarker.length, replaceIndex);
                    const newTextRaw = patchContent.substring(replaceIndex + replaceMarker.length);

                    // Clean and normalize
                    const clean = (t: string) => t.replace(/\r/g, '').replace(/^\n/, '').replace(/\n$/, '');
                    const oldText = clean(oldTextRaw);
                    const newText = clean(newTextRaw);

                    const normalizedEditor = editorContext.replace(/\r/g, '');
                    
                    if (normalizedEditor.includes(oldText)) {
                        // Match found in normalized (line endings ignored)
                        // We must perform the replacement on the original editorContext to preserve CRLF if present
                        // But wait, if normalizedEditor includes it, replace might still fail if editor uses \r\n
                        const searchPattern = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
                        const regex = new RegExp(searchPattern, 'g');
                        const updated = editorContext.replace(regex, newText);

                        if (updated !== editorContext) {
                            if (setEditorContent) setEditorContent(updated);
                        } else {
                            setError('Patch failed: Content found but could not be safely replaced.');
                            return;
                        }
                    } else {
                        // Try ultra-normalized (ignore all leading/trailing whitespace of the search block)
                        const ultraOld = oldText.trim();
                        const searchPatternUltra = ultraOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                        const regexUltra = new RegExp(searchPatternUltra, 'g');
                        const updatedUltra = editorContext.replace(regexUltra, newText);

                        if (updatedUltra !== editorContext) {
                            if (setEditorContent) setEditorContent(updatedUltra);
                        } else {
                            console.warn('Surgical patch target not found in editor.');
                            const preview = ultraOld.length > 50 ? ultraOld.slice(0, 50) + '...' : ultraOld;
                            setError(`Could not apply patch. The text "${preview}" was not found. Please try again with a clearer selection.`);
                            return;
                        }
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
        toggleScriptCharacter,
        aiModel,
        setAiModel
    };
}
