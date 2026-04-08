import type { ReactNode, RefObject } from 'react';
import {
    ChevronDown,
    Loader2,
    Send,
    Square,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssistantScope, EditorSelection } from '../types';
import { placeholder } from './AssistantPanelConfig';

export function AssistantHeader() {
    return (
        <div className="border-b border-white/[0.06] px-5 py-3.5 bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[13px] font-semibold text-white/90 tracking-[-0.01em]">Assistant</span>
                <span className="text-[11px] text-white/30 font-medium ml-auto">AI</span>
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
        ? `Lines ${selection.lineStart}–${selection.lineEnd}`
        : activeSceneName || 'No scene selected';

    return (
        <div className="border-b border-white/[0.04]">
            <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-[11px] text-white/30 font-medium truncate">{contextLabel}</span>
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors font-medium"
                >
                    Context
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/[0.04] px-5 py-4 space-y-4"
                >
                    <div className="grid grid-cols-2 gap-2">
                        <ScopeButton active={effectiveScope === 'scene'} onClick={() => onScopeChange('scene')}>Full scene</ScopeButton>
                        <ScopeButton active={effectiveScope === 'selection'} disabled={!hasSelection} onClick={() => onScopeChange('selection')}>Selection</ScopeButton>
                    </div>

                    {hasSelection && selection && (
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Selected</span>
                                <span className="text-[10px] text-white/40">{selection.lineCount} lines</span>
                            </div>
                            <p className="text-[11px] text-white/50 leading-relaxed max-h-20 overflow-hidden whitespace-pre-wrap">{selection.preview}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                        {quickActions.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => onPromptPick(prompt)}
                                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-2 border-t border-white/[0.04]">
                        <button
                            type="button"
                            onClick={onClearChat}
                            className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-[11px] text-white/30 hover:text-white/70 transition-colors font-medium"
                        >
                            Reset
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

function ScopeButton({
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
            className={`rounded-lg border px-3 py-2 text-[11px] font-medium text-left transition-all ${
                active
                    ? 'border-white/[0.12] bg-white/[0.06] text-white/90'
                    : 'border-white/[0.04] bg-transparent text-white/30 hover:text-white/50 hover:border-white/[0.08]'
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
        <div className="flex h-full items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 max-w-[260px]">
                <div className="text-[13px] text-white/20 font-medium text-center leading-relaxed">
                    Ask anything about your script, or request edits.
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                    {quickActions.slice(0, 3).map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => onPromptPick(prompt)}
                            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
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
        <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-0.5">Detected Pattern</p>
                    <p className="text-[12px] text-white/70 font-medium truncate">{preferenceCandidateLabel}</p>
                </div>
                <button
                    type="button"
                    disabled={isSavingPreference}
                    onClick={onSavePreferenceCandidate}
                    className="shrink-0 rounded-md bg-white/[0.08] border border-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.12] hover:text-white transition-all disabled:opacity-40"
                >
                    {isSavingPreference ? 'Saving...' : 'Apply'}
                </button>
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
        <div className="border-t border-white/[0.06] bg-[rgba(255,255,255,0.015)] px-4 py-4">
            <div 
                className={`relative rounded-xl border transition-all duration-300 ${
                    isGenerating 
                        ? 'border-white/[0.08] bg-white/[0.03]' 
                        : 'border-white/[0.06] bg-white/[0.02] focus-within:border-white/[0.15] focus-within:bg-white/[0.03]'
                }`}
            >
                <textarea
                    ref={inputRef}
                    className="min-h-[72px] w-full resize-none bg-transparent px-4 py-3 pr-14 text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/20 font-[system-ui]"
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
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {}}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                            <Square size={12} fill="currentColor" />
                        </motion.button>
                    ) : (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={onSend}
                            disabled={!inputValue.trim()}
                            aria-label="Send"
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                                inputValue.trim() 
                                    ? 'bg-white text-black hover:bg-white/90' 
                                    : 'bg-white/[0.06] text-white/20 cursor-not-allowed'
                            }`}
                        >
                            <Send size={14} strokeWidth={2.5} />
                        </motion.button>
                    )}
                </div>
            </div>
            
            <div className="mt-2 px-1 flex items-center justify-between">
                <span className="text-[10px] text-white/15 font-medium">⇧ Enter for new line</span>
            </div>
        </div>
    );
}
