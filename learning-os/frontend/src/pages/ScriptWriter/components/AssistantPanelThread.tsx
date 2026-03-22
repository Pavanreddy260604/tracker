import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight, Check, Copy, Loader2, Pencil, Trash2, User, Sparkles, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AssistantMessage, AssistantScope } from '../types';
import { statusText } from './AssistantPanelConfig';
import { EmptyState } from './AssistantPanelShared';
import { ProgressBar } from '../../../components/ui/ProgressBar';

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
    inline?: boolean;
};

function MessageActionButton({
    label,
    onClick,
    children,
    danger = false
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={`rounded-md border border-border-subtle bg-console-surface-2 p-1 text-text-muted transition-colors hover:text-text-primary ${
                danger ? 'hover:border-status-error/30 hover:text-status-error' : 'hover:border-border-muted'
            }`}
        >

            {children}
        </button>
    );
}

function renderPatchCard(content: string, messageId: string, onApplyProposal: (messageId: string) => void) {
    const searchIndex = content.indexOf('<<<SEARCH>>>');
    const replaceIndex = content.indexOf('<<<REPLACE>>>');

    if (searchIndex === -1 || replaceIndex === -1) {
        return null;
    }

    const oldText = content.substring(searchIndex + 12, replaceIndex).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    const newText = content.substring(replaceIndex + 13).replace(/^\r?\n/, '').replace(/\r?\n$/, '');

    return (
        <div className="group/patch my-3 overflow-hidden rounded-xl border border-border-subtle bg-console-surface">

            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
                <div className="flex items-center gap-2">
                    <Scissors size={12} className="text-text-tertiary" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">Local patch</span>
                </div>
                <button
                    type="button"
                    onClick={() => onApplyProposal(`${messageId}|${btoa(encodeURIComponent(content))}`)}
                    className="rounded-md border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary opacity-0 transition-all hover:border-border-strong hover:text-text-primary group-hover/message:opacity-100 group-focus-within/message:opacity-100"
                >
                    Apply
                </button>
            </div>
            <div className="divide-y divide-border-subtle">
                <div className="bg-console-bg/60 px-3 py-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Search</div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-tertiary line-through decoration-border-strong">{oldText}</pre>
                </div>
                <div className="flex items-center justify-center py-1.5 text-text-tertiary">
                    <ArrowRight size={13} />
                </div>
                <div className="bg-console-surface/40 px-3 py-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Replace</div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-primary">{newText}</pre>
                </div>
            </div>
        </div>
    );
}

function MessageCard({
    msg,
    copiedId,
    editingId,
    editValue,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
    onDelete,
    onApplyProposal,
    onDiscardProposal,
    progress = 0
}: {
    msg: AssistantMessage;
    copiedId: string | null;
    editingId: string | null;
    editValue: string;
    onEditValueChange: (value: string) => void;
    onStartEdit: (msg: AssistantMessage) => void;
    onCancelEdit: () => void;
    onSaveEdit: (messageId: string) => void;
    onCopy: (content: string, id: string) => void;
    onDelete: (messageId: string) => void;
    onApplyProposal: (messageId: string) => void;
    onDiscardProposal: (messageId: string) => void;
    progress?: number;
}) {
    const isUser = msg.role === 'user';
    const isEditing = msg.type === 'instruction' && editingId === msg.id;
    const wrapperClass = isUser ? 'ml-auto w-full max-w-[88%]' : 'w-full';
    const metaAlignClass = isUser ? 'justify-end' : 'justify-start';
    const bubbleClass = isUser
        ? 'rounded-[24px] rounded-tr-[4px] border border-accent-primary/20 bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 p-5 shadow-xl shadow-accent-primary/5'
        : msg.status === 'error'
            ? 'rounded-[24px] rounded-tl-[4px] border border-status-error/20 bg-status-error-soft/30 p-5 backdrop-blur-md'
            : 'rounded-[24px] rounded-tl-[4px] border border-border-subtle/30 bg-console-surface/50 p-5 shadow-2xl shadow-console-bg/40 backdrop-blur-xl';

    const isStreamingPlaceholder = msg.status === 'streaming' && !msg.content.trim();

    return (
        <motion.div 
            initial={{ opacity: 0, x: isUser ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={wrapperClass}
        >
            <div className={`mb-3 flex flex-wrap items-center gap-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-text-disabled ${metaAlignClass}`}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                    isUser 
                        ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary' 
                        : 'bg-console-surface/50 border-border-subtle/30 text-text-secondary'
                }`}>
                    {isUser ? <User size={10} strokeWidth={3} /> : <Sparkles size={10} strokeWidth={3} />}
                    <span>{isUser ? 'Director' : 'Assistant'}</span>
                </div>
                {msg.selectionLabel && (
                    <span className="rounded-full border border-border-subtle/20 bg-console-surface/30 px-3 py-1.5 normal-case tracking-normal text-text-tertiary italic backdrop-blur-sm">
                        {msg.selectionLabel}
                    </span>
                )}
            </div>


            {msg.type === 'thought' ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-console-bg/80 px-2.5 py-1.5 text-[10px] text-text-tertiary">
                    <Loader2 size={11} className="animate-spin" />
                    <span>{msg.content}</span>
                </div>
            ) : (
                <div className={`group/message relative overflow-hidden backdrop-blur-sm transition-all duration-300 ${bubbleClass}`}>
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 z-10">
                        <MessageActionButton label="Copy message" onClick={() => onCopy(msg.content, msg.id)}>
                            {copiedId === msg.id ? <Check size={12} className="text-status-ok" /> : <Copy size={12} />}
                        </MessageActionButton>
                        {isUser && msg.type === 'instruction' && !isEditing && (
                            <MessageActionButton label="Edit instruction" onClick={() => onStartEdit(msg)}>
                                <Pencil size={12} />
                            </MessageActionButton>
                        )}
                        <MessageActionButton label="Delete message" onClick={() => onDelete(msg.id)} danger>
                            <Trash2 size={12} />
                        </MessageActionButton>
                    </div>

                    {isEditing ? (
                        <div className="space-y-3">
                            <textarea
                                className="w-full resize-none rounded-xl border border-border-subtle bg-console-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none focus:border-border-strong"
                                value={editValue}
                                onChange={(e) => onEditValueChange(e.target.value)}
                                rows={4}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') onCancelEdit();
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onSaveEdit(msg.id);
                                    }
                                }}
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={onCancelEdit} className="rounded-lg px-2 py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:bg-console-surface hover:text-text-primary">Cancel</button>
                                <button type="button" onClick={() => onSaveEdit(msg.id)} className="rounded-lg bg-text-primary px-2.5 py-1 text-[11px] font-medium text-console-bg transition-colors hover:opacity-90">Save</button>
                            </div>
                        </div>
                    ) : isUser || msg.type === 'instruction' ? (
                        <p className="whitespace-pre-wrap pr-14 text-[13px] leading-relaxed text-text-primary">{msg.content}</p>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none pr-14 text-text-secondary">
                            {isStreamingPlaceholder ? (
                                msg.type === 'proposal' ? (
                                    <div className="py-2">
                                        <ProgressBar 
                                            progress={progress} 
                                            label="Drafting screenplay..." 
                                            showPercentage={true}
                                            className="mb-2"
                                        />
                                        <div className="flex items-center gap-2 text-text-tertiary">
                                            <Loader2 size={10} className="animate-spin" />
                                            <span className="text-[10px] italic">
                                                Analyzing context and shaping the revision...
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 py-2 text-[11px] text-text-tertiary">
                                        <Loader2 size={12} className="animate-spin" />
                                        <span>Thinking...</span>
                                    </div>
                                )
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        pre: ({ children }) => <div className="not-prose overflow-x-auto rounded-xl border border-border-subtle/30 bg-console-bg/50 p-3">{children}</div>,
                                        code({ inline, className, children, ...props }: MarkdownCodeProps) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const isPatch = match && match[1] === 'script-edit';
                                            const content = String(children).replace(/\n$/, '');
    
                                            if (!inline && isPatch) {
                                                return renderPatchCard(content, msg.id, onApplyProposal);
                                            }
    
                                            if (inline) {
                                                return <code className="rounded bg-console-surface-2 px-1 py-0.5 text-[0.85em] text-text-primary" {...props}>{children}</code>;
                                            }

                                        return <code className={className} {...props}>{children}</code>;
                                    }
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        )}
                        </div>
                    )}

                    {msg.type === 'proposal' && msg.scope === 'scene' && msg.status !== 'streaming' && msg.content.trim() && (
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => onDiscardProposal(msg.id)}
                                className="rounded-md border border-border-subtle px-2 py-1 text-[10px] font-medium text-text-tertiary transition-colors hover:border-status-error/30 hover:text-status-error"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={() => onApplyProposal(msg.id)}
                                className="rounded-md border border-border-strong px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-text-primary"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

export function AssistantThread({
    messages,
    isGenerating,
    progress = 0,
    effectiveScope,
    quickActions,
    copiedId,
    editingId,
    editValue,
    onPromptPick,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
    onDelete,
    onApplyProposal,
    onDiscardProposal
}: {
    messages: AssistantMessage[];
    isGenerating: boolean;
    progress?: number;
    effectiveScope: AssistantScope;
    quickActions: string[];
    copiedId: string | null;
    editingId: string | null;
    editValue: string;
    onPromptPick: (prompt: string) => void;
    onEditValueChange: (value: string) => void;
    onStartEdit: (msg: AssistantMessage) => void;
    onCancelEdit: () => void;
    onSaveEdit: (messageId: string) => void;
    onCopy: (content: string, id: string) => void;
    onDelete: (messageId: string) => void;
    onApplyProposal: (messageId: string) => void;
    onDiscardProposal: (messageId: string) => void;
}) {
    const visibleMessages = messages.filter((message) => {
        if (message.role === 'user' || message.type === 'thought') {
            return true;
        }

        return message.status === 'streaming' || message.content.trim().length > 0;
    });

    if (visibleMessages.length === 0) {
        return <EmptyState quickActions={quickActions} onPromptPick={onPromptPick} />;
    }

    return (
        <div className="flex flex-col gap-5 px-4 py-4">
            <AnimatePresence mode="popLayout">
                {visibleMessages.map((msg) => (
                    <MessageCard
                        key={msg.id}
                        msg={msg}
                        copiedId={copiedId}
                        editingId={editingId}
                        editValue={editValue}
                        onEditValueChange={onEditValueChange}
                        onStartEdit={onStartEdit}
                        onCancelEdit={onCancelEdit}
                        onSaveEdit={onSaveEdit}
                        onCopy={onCopy}
                        onDelete={onDelete}
                        onApplyProposal={onApplyProposal}
                        onDiscardProposal={onDiscardProposal}
                        progress={progress}
                    />
                ))}
            </AnimatePresence>
            {isGenerating
                && visibleMessages[visibleMessages.length - 1]?.type === 'proposal'
                && visibleMessages[visibleMessages.length - 1]?.status !== 'streaming'
                && (
                <div className="inline-flex w-full flex-col gap-2 rounded-lg border border-border-subtle bg-console-bg/80 px-3 py-2.5">
                    <ProgressBar 
                        progress={progress} 
                        label={statusText(effectiveScope)} 
                    />
                </div>
            )}
        </div>
    );
}
