import type { ReactNode, RefObject } from 'react';
import {
    ChevronDown,
    Loader2,
    Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssistantScope, EditorSelection } from '../types';
import { placeholder } from './AssistantPanelConfig';

export function AssistantHeader() {
    return (
        <div className="border-b border-border-subtle/30 px-4 py-4 bg-console-header/90 backdrop-blur-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle/30 bg-console-surface/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-text-tertiary shadow-inner">
                <div className="h-1.5 w-1.5 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-primary)]" />
                Assistant Intelligence
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
        <div className="border-b border-border-subtle/20 bg-console-bg/30">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{contextLabel}</p>
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/30 bg-console-surface/50 px-3 py-1 text-[11px] font-medium text-text-secondary transition-all hover:bg-console-surface hover:text-text-primary"
                >
                    Context
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 border-t border-border-subtle/30 px-4 py-4 bg-console-surface/20 backdrop-blur-md"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <TrayButton active={effectiveScope === 'scene'} onClick={() => onScopeChange('scene')}>Full scene</TrayButton>
                        <TrayButton active={effectiveScope === 'selection'} disabled={!hasSelection} onClick={() => onScopeChange('selection')}>Selection only</TrayButton>
                    </div>

                    {hasSelection && selection && (
                        <div className="rounded-2xl border border-border-subtle/30 bg-console-bg/40 p-3.5 backdrop-blur-sm shadow-inner">
                            <div className="mb-2.5 flex items-center justify-between gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Selection Context</span>
                                <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full">{selection.lineCount} lines</span>
                            </div>
                            <p className="max-h-32 overflow-hidden whitespace-pre-wrap text-[11px] leading-relaxed text-text-secondary italic">{selection.preview}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                        {quickActions.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => onPromptPick(prompt)}
                                className="rounded-xl border border-border-subtle/30 bg-console-surface/50 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-all hover:border-accent-primary/30 hover:bg-accent-primary/5 hover:text-accent-primary"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle/30 mt-2">
                        <button
                            type="button"
                            onClick={onClearChat}
                            className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary hover:text-status-error transition-colors"
                        >
                            Clear History
                        </button>
                        <button
                            type="button"
                            onClick={onReset}
                            className="bg-console-surface/50 border border-border-subtle/30 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:bg-console-surface transition-colors"
                        >
                            Reset Focus
                        </button>
                    </div>
                </motion.div>
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
            className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all duration-300 ${
                active
                    ? 'border-accent-primary/40 bg-accent-primary/10 text-text-primary'
                    : 'border-border-subtle/30 bg-console-surface/50 text-text-tertiary hover:border-border-subtle hover:text-text-secondary'
            } ${disabled ? 'cursor-not-allowed opacity-20' : ''}`}
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
                {quickActions.slice(0, 3).map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        onClick={() => onPromptPick(prompt)}
                        className="rounded-full border border-border-subtle/30 bg-console-surface/50 px-3 py-1.5 text-[11px] font-medium text-text-tertiary transition-all hover:border-accent-primary/30 hover:text-text-primary hover:bg-console-surface"
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
        <div className="border-t border-border-subtle/30 bg-console-bg/50 backdrop-blur-2xl px-5 py-4">
            <div className="rounded-[20px] border border-accent-primary/20 bg-accent-primary/5 px-5 py-4 shadow-xl shadow-accent-primary/5">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-primary mb-1">Architectural Insight</p>
                        <p className="truncate text-xs font-bold text-text-primary tracking-tight">{preferenceCandidateLabel}</p>
                    </div>
                    <button
                        type="button"
                        disabled={isSavingPreference}
                        onClick={onSavePreferenceCandidate}
                        className="rounded-xl bg-accent-primary text-console-bg shadow-lg shadow-accent-primary/25 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        {isSavingPreference ? 'Sycing...' : 'Adopt Pattern'}
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
        <div className="border-t border-border-subtle/30 bg-console-bg/50 backdrop-blur-2xl px-5 py-5">
            <div className="relative overflow-hidden rounded-[24px] border border-border-subtle/30 bg-console-surface/40 transition-all duration-300 focus-within:border-accent-primary/40 focus-within:bg-console-surface/60 focus-within:shadow-[0_0_30px_rgba(var(--accent-primary-rgb),0.1)]">
                <textarea
                    ref={inputRef}
                    className="min-h-[64px] w-full resize-none bg-transparent px-5 py-5 pr-16 text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary/50 custom-scrollbar"
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
                <div className="absolute bottom-3 right-3">
                    {isGenerating ? (
                        <div className="inline-flex h-10 items-center gap-2.5 rounded-2xl border border-accent-primary/20 bg-accent-primary/10 px-4 text-[10px] font-bold uppercase tracking-widest text-accent-primary backdrop-blur-md">
                            <Loader2 size={14} className="animate-spin" />
                            Thinking
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onSend}
                            disabled={!inputValue.trim()}
                            aria-label="Send assistant request"
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-500 ${
                                inputValue.trim() 
                                    ? 'bg-accent-primary text-console-bg shadow-lg shadow-accent-primary/25 hover:scale-105 hover:shadow-accent-primary/40 active:scale-95' 
                                    : 'cursor-not-allowed bg-console-surface/50 text-text-disabled/30'
                            }`}
                        >
                            <Send size={16} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
