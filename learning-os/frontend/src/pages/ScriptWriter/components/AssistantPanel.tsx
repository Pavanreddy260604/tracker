import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AssistantPreferences, Bible } from '../../../services/project.api';
import type { AssistantMessage, AssistantMode, AssistantRequest, AssistantScope, EditorSelection } from '../types';
import { suggestions } from './AssistantPanelConfig';
import {
    AssistantComposer,
    AssistantGuidance,
    AssistantHeader,
    ContextTray
} from './AssistantPanelShared';
import { AssistantThread } from './AssistantPanelThread';
import {
    detectPreferenceSaveCandidate,
    classifyAssistantIntent,
    getIntentHint
} from '../utils';

interface AssistantPanelProps {
    activeProject: Bible | null;
    messages: AssistantMessage[];
    isGenerating: boolean;
    progress?: number;
    activeSceneId?: string | null;
    activeSceneName?: string;
    selection?: EditorSelection | null;
    onSendMessage: (request: AssistantRequest) => void;
    onApplyProposal: (messageId: string) => void;
    onDiscardProposal: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    onUpdateMessage: (messageId: string, content: string) => void;
    onClearChat: () => void;
    onSavePreferenceCandidate?: (candidate: {
        directive: string;
        updates: Partial<AssistantPreferences>;
    }) => Promise<unknown> | unknown;
}

export function AssistantPanel({
    activeProject,
    messages,
    isGenerating,
    progress = 0,
    activeSceneId,
    activeSceneName,
    selection,
    onSendMessage,
    onApplyProposal,
    onDiscardProposal,
    onDeleteMessage,
    onUpdateMessage,
    onClearChat,
    onSavePreferenceCandidate
}: AssistantPanelProps) {
    const [inputValue, setInputValue] = useState('');
    const projectDefaultMode = activeProject?.assistantPreferences?.defaultMode ?? 'ask';
    const [mode, setMode] = useState<AssistantMode>(projectDefaultMode);
    const [scopePreference, setScopePreference] = useState<AssistantScope>(selection?.text ? 'selection' : 'scene');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [isContextTrayOpen, setIsContextTrayOpen] = useState(false);
    const [dismissedSelectionTrayKey, setDismissedSelectionTrayKey] = useState<string | null>(null);
    const [isSavingPreference, setIsSavingPreference] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const hasSelection = !!selection?.text?.trim();
    const selectionKey = hasSelection
        ? `${selection?.start ?? 'na'}-${selection?.end ?? 'na'}-${selection?.text.length ?? 0}`
        : null;
    const effectiveScope: AssistantScope = scopePreference === 'selection' && hasSelection ? 'selection' : 'scene';
    const autoOpenSelectionTray = Boolean(
        selectionKey &&
        effectiveScope === 'selection' &&
        dismissedSelectionTrayKey !== selectionKey
    );
    const contextTrayOpen = isContextTrayOpen || autoOpenSelectionTray;
    const quickActions = useMemo(() => suggestions(mode, effectiveScope, hasSelection), [mode, effectiveScope, hasSelection]);
    const draftIntent = useMemo(
        () => mode === 'ask' ? classifyAssistantIntent(inputValue, effectiveScope, hasSelection) : 'chat',
        [effectiveScope, hasSelection, inputValue, mode]
    );
    const intentHint = useMemo(() => getIntentHint(draftIntent), [draftIntent]);
    const preferenceCandidate = useMemo(
        () => activeProject ? detectPreferenceSaveCandidate(inputValue) : null,
        [activeProject, inputValue]
    );
    const hasSavedDirective = Boolean(
        preferenceCandidate &&
        activeProject?.assistantPreferences?.savedDirectives?.includes(preferenceCandidate.directive)
    );
    const showPreferenceCandidate = Boolean(
        preferenceCandidate &&
        onSavePreferenceCandidate &&
        !hasSavedDirective
    );

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (nearBottom || isGenerating) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isGenerating]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 220);
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [inputValue]);

    useEffect(() => {
        setMode(projectDefaultMode);
    }, [activeSceneId, activeProject?._id, projectDefaultMode]);

    const resetPanelState = () => {
        setInputValue('');
        setMode(projectDefaultMode);
        setScopePreference(hasSelection ? 'selection' : 'scene');
        setEditingId(null);
        setEditValue('');
        setCopiedId(null);
        setIsContextTrayOpen(false);
        setDismissedSelectionTrayKey(null);
    };

    const buildRequest = (requestMode: AssistantMode): AssistantRequest => ({
        content: inputValue.trim(),
        mode: requestMode,
        scope: effectiveScope,
        selection: effectiveScope === 'selection' ? selection : null
    });

    const handleScopeChange = (nextScope: AssistantScope) => {
        setScopePreference(nextScope);
        if (nextScope === 'selection' && selectionKey) {
            setDismissedSelectionTrayKey(null);
        }
    };

    const handleContextTrayToggle = () => {
        if (contextTrayOpen) {
            setIsContextTrayOpen(false);
            if (selectionKey && effectiveScope === 'selection') {
                setDismissedSelectionTrayKey(selectionKey);
            }
            return;
        }

        setIsContextTrayOpen(true);
        if (selectionKey) {
            setDismissedSelectionTrayKey(null);
        }
    };

    const send = () => {
        if (!inputValue.trim() || isGenerating) return;

        onSendMessage(buildRequest(mode));

        setInputValue('');
        inputRef.current?.focus();
    };

    const rerunInMode = (nextMode: AssistantMode) => {
        if (!inputValue.trim() || isGenerating) return;
        onSendMessage(buildRequest(nextMode));
        setInputValue('');
        setMode(nextMode);
    };

    const copyMessage = async (content: string, id: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 2000);
    };

    const savePreferenceCandidate = async () => {
        if (!preferenceCandidate || !onSavePreferenceCandidate || isSavingPreference) {
            return;
        }

        try {
            setIsSavingPreference(true);
            await onSavePreferenceCandidate(preferenceCandidate);
        } catch {
            // Project update flow owns user-facing error reporting.
        } finally {
            setIsSavingPreference(false);
        }
    };

    if (!activeProject) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="max-w-[220px] text-xs leading-relaxed text-zinc-500">Open a project and scene to use the assistant.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <AssistantHeader
                mode={mode}
                onModeChange={setMode}
            />

            <ContextTray
                activeSceneName={activeSceneName}
                selection={selection}
                hasSelection={hasSelection}
                effectiveScope={effectiveScope}
                isOpen={contextTrayOpen}
                onToggle={handleContextTrayToggle}
                onScopeChange={handleScopeChange}
                quickActions={quickActions}
                onPromptPick={(prompt) => {
                    setInputValue(prompt);
                    inputRef.current?.focus();
                }}
                onClearChat={onClearChat}
                onReset={resetPanelState}
            />

            <div ref={scrollRef} className="relative flex-1 overflow-y-auto custom-scrollbar">
                <AssistantThread
                    messages={messages}
                    isGenerating={isGenerating}
                    progress={progress}
                    mode={mode}
                    effectiveScope={effectiveScope}
                    quickActions={quickActions}
                    copiedId={copiedId}
                    editingId={editingId}
                    editValue={editValue}
                    onPromptPick={(prompt) => {
                        setInputValue(prompt);
                        inputRef.current?.focus();
                    }}
                    onEditValueChange={setEditValue}
                    onStartEdit={(msg) => {
                        setEditingId(msg.id);
                        setEditValue(msg.content);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(messageId) => {
                        onUpdateMessage(messageId, editValue);
                        setEditingId(null);
                    }}
                    onCopy={copyMessage}
                    onDelete={onDeleteMessage}
                    onApplyProposal={onApplyProposal}
                    onDiscardProposal={onDiscardProposal}
                />

                {showScrollDown && (
                    <button
                        type="button"
                        onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
                        className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900/95 p-2 text-zinc-400 shadow-xl transition-colors hover:border-zinc-600 hover:text-zinc-100"
                    >
                        <ChevronDown size={16} />
                    </button>
                )}
            </div>

            <AssistantGuidance
                intentHint={mode === 'ask' ? intentHint : ''}
                draftIntent={draftIntent}
                isGenerating={isGenerating}
                showPreferenceCandidate={showPreferenceCandidate}
                preferenceCandidateLabel={preferenceCandidate?.directive}
                isSavingPreference={isSavingPreference}
                onSavePreferenceCandidate={savePreferenceCandidate}
                onRerunInEdit={() => rerunInMode('edit')}
                onRerunInAgent={() => rerunInMode('agent')}
            />

            <AssistantComposer
                inputValue={inputValue}
                mode={mode}
                effectiveScope={effectiveScope}
                isGenerating={isGenerating}
                activeSceneName={activeSceneName}
                onInputChange={setInputValue}
                onSend={send}
                inputRef={inputRef}
            />
        </div>
    );
}
