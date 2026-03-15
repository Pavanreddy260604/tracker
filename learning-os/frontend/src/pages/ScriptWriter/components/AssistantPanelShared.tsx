import type { ReactNode, RefObject } from 'react';
import {
    ChevronDown,
    Loader2,
    Send,
} from 'lucide-react';
import type { AssistantScope, EditorSelection } from '../types';
import { placeholder } from './AssistantPanelConfig';

export function AssistantHeader() {
    return (
        <div className="border-b border-zinc-800/80 px-3 py-2.5">
            <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Assistant
            </div>
        </div>
    );
}

export function ContextTray({
    activeSceneName,
    selection,
    hasSelection,
    effectiveScope,
    isOpen,
    onToggle,
    onScopeChange,
    quickActions,
    onPromptPick,
    onClearChat,
    onReset
}: {
    activeSceneName?: string;
    selection?: EditorSelection | null;
    hasSelection: boolean;
    effectiveScope: AssistantScope;
    isOpen: boolean;
    onToggle: () => void;
    onScopeChange: (scope: AssistantScope) => void;
    quickActions: string[];
    onPromptPick: (prompt: string) => void;
    onClearChat: () => void;
    onReset: () => void;
}) {
    const contextLabel = effectiveScope === 'selection' && hasSelection && selection
        ? `Selection: lines ${selection.lineStart}-${selection.lineEnd}`
        : activeSceneName || 'No scene selected';

    return (
        <div className="border-b border-zinc-800/80 bg-zinc-950/80">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-zinc-300">{contextLabel}</p>
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                >
                    Context
                    <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="space-y-3 border-t border-zinc-800/70 px-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                        <TrayButton active={effectiveScope === 'scene'} onClick={() => onScopeChange('scene')}>Full scene</TrayButton>
                        <TrayButton active={effectiveScope === 'selection'} disabled={!hasSelection} onClick={() => onScopeChange('selection')}>Selection only</TrayButton>
                    </div>

                    {hasSelection && selection && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Selection</span>
                                <span className="text-[10px] text-zinc-600">{selection.lineCount} lines</span>
                            </div>
                            <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">{selection.preview}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {quickActions.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => onPromptPick(prompt)}
                                className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClearChat}
                            className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                        >
                            Clear chat
                        </button>
                        <button
                            type="button"
                            onClick={onReset}
                            className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function TrayButton({
    active,
    disabled,
    onClick,
    children
}: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                active
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'
            } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        >
            {children}
        </button>
    );
}

export function EmptyState({
    quickActions,
    onPromptPick
}: {
    quickActions: string[];
    onPromptPick: (prompt: string) => void;
}) {
    return (
        <div className="flex h-full items-start px-3 py-3">
            <div className="flex flex-wrap gap-2">
                {quickActions.slice(0, 2).map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        onClick={() => onPromptPick(prompt)}
                        className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function AssistantGuidance({
    showPreferenceCandidate,
    preferenceCandidateLabel,
    isSavingPreference,
    onSavePreferenceCandidate
}: {
    showPreferenceCandidate: boolean;
    preferenceCandidateLabel?: string;
    isSavingPreference: boolean;
    onSavePreferenceCandidate: () => void;
}) {
    if (!showPreferenceCandidate) {
        return null;
    }

    return (
        <div className="border-t border-zinc-800/70 bg-zinc-950/95 px-3 py-2">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Save To Project</p>
                        <p className="truncate text-[11px] text-zinc-300">{preferenceCandidateLabel}</p>
                    </div>
                    <button
                        type="button"
                        disabled={isSavingPreference}
                        onClick={onSavePreferenceCandidate}
                        className="rounded-full border border-sky-500/30 bg-zinc-950 px-3 py-1 text-[10px] font-medium text-sky-200 transition-colors hover:border-sky-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSavingPreference ? 'Saving...' : 'Save preference'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AssistantComposer({
    inputValue,
    effectiveScope,
    isGenerating,
    activeSceneName,
    onInputChange,
    onSend,
    inputRef
}: {
    inputValue: string;
    effectiveScope: AssistantScope;
    isGenerating: boolean;
    activeSceneName?: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
    return (
        <div className="border-t border-zinc-800/80 bg-zinc-950/90 px-3 py-2.5">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition-colors focus-within:border-zinc-700">
                <textarea
                    ref={inputRef}
                    className="min-h-[56px] w-full resize-none bg-transparent px-3 py-3 pr-12 text-[13px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 custom-scrollbar"
                    rows={1}
                    placeholder={placeholder(effectiveScope, activeSceneName)}
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSend();
                        }
                    }}
                    disabled={isGenerating}
                />
                <div className="absolute bottom-2.5 right-2.5">
                    {isGenerating ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-medium text-zinc-500">
                            <Loader2 size={11} className="animate-spin" />
                            Collaborating
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onSend}
                            disabled={!inputValue.trim()}
                            aria-label="Send assistant request"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                inputValue.trim() ? 'bg-zinc-100 text-zinc-900 hover:bg-white' : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                            }`}
                        >
                            <Send size={13} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
