import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight, Check, Copy, Loader2, Pencil, Scissors, Trash2 } from 'lucide-react';
import type { AssistantMessage, AssistantMode, AssistantScope } from '../types';
import { getModeConfig, statusText } from './AssistantPanelConfig';
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
            className={`rounded-md border border-zinc-700 bg-zinc-900/95 p-1 text-zinc-500 transition-colors hover:text-zinc-100 ${
                danger ? 'hover:border-red-500/30 hover:text-red-300' : 'hover:border-zinc-600'
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
        <div className="group/patch my-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2">
                    <Scissors size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Local patch</span>
                </div>
                <button
                    type="button"
                    onClick={() => onApplyProposal(`${messageId}|${btoa(encodeURIComponent(content))}`)}
                    className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 opacity-0 transition-all hover:border-zinc-600 hover:text-zinc-100 group-hover/message:opacity-100 group-focus-within/message:opacity-100"
                >
                    Apply
                </button>
            </div>
            <div className="divide-y divide-zinc-800">
                <div className="bg-zinc-950/60 px-3 py-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Search</div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-500 line-through decoration-zinc-700">{oldText}</pre>
                </div>
                <div className="flex items-center justify-center py-1.5 text-zinc-700">
                    <ArrowRight size={13} />
                </div>
                <div className="bg-zinc-900/40 px-3 py-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Replace</div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-100">{newText}</pre>
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
    const config = getModeConfig(msg.mode);
    const wrapperClass = isUser ? 'ml-auto w-full max-w-[88%]' : 'w-full';
    const metaAlignClass = isUser ? 'justify-end' : 'justify-start';
    const bubbleClass = isUser
        ? 'rounded-2xl rounded-tr-md border border-zinc-800 bg-zinc-900/85'
        : msg.status === 'error'
            ? 'rounded-2xl border border-red-500/30 bg-red-950/30'
            : 'rounded-2xl border border-zinc-800 bg-zinc-950/75';
    const isStreamingPlaceholder = msg.status === 'streaming' && !msg.content.trim();

    return (
        <div className={wrapperClass}>
            <div className={`mb-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500 ${metaAlignClass}`}>
                <span className="font-semibold text-zinc-400">{isUser ? 'You' : 'Assistant'}</span>
                {msg.mode && <span className={`rounded-full border px-2 py-0.5 normal-case tracking-normal ${config.badgeClass}`}>{config.label}</span>}
                {msg.selectionLabel && <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 normal-case tracking-normal text-zinc-400">{msg.selectionLabel}</span>}
            </div>

            {msg.type === 'thought' ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5 text-[10px] text-zinc-500">
                    <Loader2 size={11} className="animate-spin" />
                    <span>{msg.content}</span>
                </div>
            ) : (
                <div className={`group/message relative overflow-hidden p-3 ${bubbleClass}`}>
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
                        <MessageActionButton label="Copy message" onClick={() => onCopy(msg.content, msg.id)}>
                            {copiedId === msg.id ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
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
                                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none focus:border-zinc-600"
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
                                <button type="button" onClick={onCancelEdit} className="rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">Cancel</button>
                                <button type="button" onClick={() => onSaveEdit(msg.id)} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-900 transition-colors hover:bg-white">Save</button>
                            </div>
                        </div>
                    ) : isUser || msg.type === 'instruction' ? (
                        <p className="whitespace-pre-wrap pr-14 text-[13px] leading-relaxed text-zinc-100">{msg.content}</p>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none pr-14 text-zinc-200">
                            {isStreamingPlaceholder ? (
                                <div className="py-2">
                                    <ProgressBar 
                                        progress={progress} 
                                        label={msg.type === 'proposal' ? 'Drafting screenplay...' : 'Thinking...'} 
                                        showPercentage={true}
                                        className="mb-2"
                                    />
                                    <div className="flex items-center gap-2 text-zinc-500">
                                        <Loader2 size={10} className="animate-spin" />
                                        <span className="text-[10px] italic">
                                            {msg.type === 'proposal' ? 'Analyzing context and shaping the revision...' : 'Preparing a response...'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                components={{
                                    pre: ({ children }) => <div className="not-prose overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/90 p-3">{children}</div>,
                                    code({ inline, className, children, ...props }: MarkdownCodeProps) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isPatch = match && match[1] === 'script-edit';
                                        const content = String(children).replace(/\n$/, '');

                                        if (!inline && isPatch) {
                                            return renderPatchCard(content, msg.id, onApplyProposal);
                                        }

                                        if (inline) {
                                            return <code className="rounded bg-zinc-900 px-1 py-0.5 text-[0.85em] text-zinc-100" {...props}>{children}</code>;
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
                                className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-red-300"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={() => onApplyProposal(msg.id)}
                                className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function AssistantThread({
    messages,
    isGenerating,
    progress = 0,
    mode,
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
    mode: AssistantMode;
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
        <div className="flex flex-col gap-3 px-3 py-3">
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
            {isGenerating && visibleMessages[visibleMessages.length - 1]?.type !== 'thought' && visibleMessages[visibleMessages.length - 1]?.status !== 'streaming' && (
                <div className="inline-flex w-full flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
                    <ProgressBar 
                        progress={progress} 
                        label={statusText(mode, effectiveScope)} 
                    />
                </div>
            )}
        </div>
    );
}
