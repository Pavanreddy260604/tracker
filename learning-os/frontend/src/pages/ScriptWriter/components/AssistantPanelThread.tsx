import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight, Check, Copy, Loader2, Pencil, Trash2, Sparkles, Scissors, Search, Compass, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { AssistantMessage, AssistantScope } from '../types';
import { statusText } from './AssistantPanelConfig';
import { EmptyState } from './AssistantPanelShared';
import { ProgressBar } from '../../../components/ui/ProgressBar';

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
    inline?: boolean;
};

function MessageAction({
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
            className={`p-1 rounded text-white/20 hover:text-white/60 transition-colors ${
                danger ? 'hover:text-red-400' : ''
            }`}
        >
            {children}
        </button>
    );
}

function renderPatchCard(
    content: string, 
    messageId: string, 
    onApplyProposal: (messageId: string) => void,
    onDiscardProposal: (messageId: string) => void
) {
    const searchIndex = content.indexOf('<<<SEARCH>>>');
    const replaceIndex = content.indexOf('<<<REPLACE>>>');

    if (searchIndex === -1 || replaceIndex === -1) return null;

    const oldText = content.substring(searchIndex + 12, replaceIndex).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    const newText = content.substring(replaceIndex + 13).replace(/^\r?\n/, '').replace(/\r?\n$/, '');

    return (
        <div className="my-3 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] group/patch">
            <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-2">
                    <Scissors size={11} className="text-white/30" />
                    <span className="text-[10px] text-white/30 font-medium">Patch</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onDiscardProposal(messageId)}
                        className="text-[10px] text-white/30 hover:text-red-400 font-medium transition-all"
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={() => onApplyProposal(`${messageId}|${btoa(encodeURIComponent(content))}`)}
                        className="text-[10px] text-white/60 hover:text-white bg-white/[0.08] hover:bg-white/[0.12] rounded px-2 py-0.5 font-medium transition-all"
                    >
                        Apply
                    </button>
                </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
                <div className="px-3 py-2.5 bg-red-500/[0.03]">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/30 line-through">{oldText}</pre>
                </div>
                <div className="flex items-center justify-center py-1 text-white/10">
                    <ArrowRight size={11} />
                </div>
                <div className="px-3 py-2.5 bg-emerald-500/[0.03]">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/70">{newText}</pre>
                </div>
            </div>
        </div>
    );
}

function ThoughtIndicator({ duration, isStreaming }: { duration?: number; isStreaming?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!duration && !isStreaming) return null;
    
    return (
        <div className="mb-3">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/40 transition-colors font-medium"
            >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {isStreaming ? (
                    <span className="flex items-center gap-1.5">
                        <Loader2 size={10} className="animate-spin" />
                        Thinking...
                    </span>
                ) : (
                    <span>Thought for {duration}s</span>
                )}
            </button>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1.5 ml-4 border-l border-white/[0.06] pl-3 py-1"
                    >
                        <p className="text-[11px] text-white/25 leading-relaxed">
                            {isStreaming 
                                ? "Analyzing context and formulating response..." 
                                : "Analyzed the screenplay structure to formulate a precise revision."}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ResearchCard({ research, plan }: { research?: string; plan?: string }) {
    if (!research && !plan) return null;
    
    return (
        <div className="mb-4 space-y-2">
            {research && (
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-[11px] text-white/30 hover:text-white/50 transition-colors font-medium list-none">
                        <Search size={11} />
                        <span>Research</span>
                        <ChevronRight size={11} className="group-open:rotate-90 transition-transform ml-auto" />
                    </summary>
                    <div className="mt-2 ml-4 border-l border-white/[0.06] pl-3 text-[12px] text-white/40 leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{research}</ReactMarkdown>
                    </div>
                </details>
            )}
            {plan && (
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-[11px] text-white/30 hover:text-white/50 transition-colors font-medium list-none">
                        <Compass size={11} />
                        <span>Plan</span>
                        <ChevronRight size={11} className="group-open:rotate-90 transition-transform ml-auto" />
                    </summary>
                    <div className="mt-2 ml-4 border-l border-white/[0.06] pl-3 text-[12px] text-white/40 leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
                    </div>
                </details>
            )}
        </div>
    );
}

function DirectorNote({ content }: { content: string }) {
    if (!content) return null;
    return (
        <div className="mt-4 border-t border-white/[0.04] pt-3">
            <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={11} className="text-white/25" />
                <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Rationale</span>
            </div>
            <div className="text-[12px] text-white/40 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
    const isStreamingPlaceholder = msg.status === 'streaming' && !msg.content.trim();

    return (
        <motion.div 
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={isUser ? 'ml-auto max-w-[85%]' : 'w-full'}
        >
            {/* Message bubble */}
            {msg.type === 'thought' ? (
                <div className="flex items-center gap-2 text-[11px] text-white/25 py-1">
                    <Loader2 size={11} className="animate-spin" />
                    <span>{msg.content}</span>
                </div>
            ) : (
                <div className={`group/msg relative rounded-lg transition-all ${
                    isUser
                        ? 'bg-white/[0.06] border border-white/[0.08] px-4 py-3'
                        : msg.status === 'error'
                            ? 'bg-red-500/[0.05] border border-red-500/[0.1] px-4 py-3'
                            : msg.status === 'applied'
                                ? 'bg-emerald-500/[0.03] border border-emerald-500/[0.08] px-4 py-3 opacity-70'
                                : msg.status === 'discarded'
                                    ? 'border border-white/[0.03] px-4 py-3 opacity-40'
                                    : 'px-4 py-3'
                }`}>
                    {/* Hover actions */}
                    <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10">
                        <MessageAction label="Copy" onClick={() => onCopy(msg.content, msg.id)}>
                            {copiedId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </MessageAction>
                        {isUser && msg.type === 'instruction' && !isEditing && (
                            <MessageAction label="Edit" onClick={() => onStartEdit(msg)}>
                                <Pencil size={11} />
                            </MessageAction>
                        )}
                        <MessageAction label="Delete" onClick={() => onDelete(msg.id)} danger>
                            <Trash2 size={11} />
                        </MessageAction>
                    </div>

                    {isEditing ? (
                        <div className="space-y-2">
                            <textarea
                                className="w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white/80 outline-none focus:border-white/[0.15]"
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
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={onCancelEdit} className="text-[11px] text-white/30 hover:text-white/60 px-2 py-1">Cancel</button>
                                <button type="button" onClick={() => onSaveEdit(msg.id)} className="text-[11px] text-white/80 bg-white/[0.08] hover:bg-white/[0.12] px-2.5 py-1 rounded">Save</button>
                            </div>
                        </div>
                    ) : isUser || msg.type === 'instruction' ? (
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/80 pr-10">{msg.content}</p>
                    ) : (
                        <div className="text-[13px] text-white/60 leading-relaxed">
                            {/* Thought indicator */}
                            <ThoughtIndicator 
                                duration={msg.metadata?.thoughtDuration} 
                                isStreaming={isStreamingPlaceholder} 
                            />

                            {/* Research & Plan (collapsible) */}
                            <ResearchCard research={msg.metadata?.research} plan={msg.metadata?.plan} />

                            {isStreamingPlaceholder ? (
                                msg.type === 'proposal' ? (
                                    <div className="py-2">
                                        <ProgressBar 
                                            progress={progress} 
                                            label="Drafting..." 
                                            showPercentage={true}
                                            className="mb-2"
                                        />
                                        <div className="flex items-center gap-2 text-white/25">
                                            <Loader2 size={10} className="animate-spin" />
                                            <span className="text-[11px]">Writing revision...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 py-1 text-white/25">
                                        <Loader2 size={11} className="animate-spin" />
                                        <span className="text-[11px]">Thinking...</span>
                                    </div>
                                )
                            ) : (
                                <>
                                    <div className="prose prose-invert prose-sm max-w-none 
                                        prose-p:text-white/60 prose-p:leading-relaxed prose-p:my-2
                                        prose-strong:text-white/80 prose-strong:font-semibold
                                        prose-li:text-white/55 prose-li:my-0.5
                                        prose-headings:text-white/75 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                                        prose-code:text-white/70 prose-code:bg-white/[0.05] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em]
                                        prose-a:text-blue-400/70 prose-a:no-underline hover:prose-a:text-blue-400
                                    ">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                pre: ({ children }) => <div className="not-prose overflow-x-auto rounded-md border border-white/[0.06] bg-white/[0.02] p-3 my-3">{children}</div>,
                                                code({ inline, className, children, ...props }: MarkdownCodeProps) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const isPatch = match && match[1] === 'script-edit';
                                                    const content = String(children).replace(/\n$/, '');
                
                                                    if (!inline && isPatch) {
                                                        return renderPatchCard(content, msg.id, onApplyProposal, onDiscardProposal);
                                                    }
                
                                                    if (inline) {
                                                        return <code className="rounded bg-white/[0.05] px-1 py-0.5 text-[0.85em] text-white/70" {...props}>{children}</code>;
                                                    }
    
                                                    return <code className={className} {...props}>{children}</code>;
                                                }
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                    
                                    {/* Director's Note / Rationale */}
                                    {msg.metadata?.explanation && <DirectorNote content={msg.metadata.explanation} />}
                                </>
                            )}
                        </div>
                    )}

                    {/* Proposal actions */}
                    {msg.type === 'proposal' && msg.scope === 'scene' && msg.status === 'pending' && msg.content.trim() && (
                        <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
                            <button
                                type="button"
                                onClick={() => onDiscardProposal(msg.id)}
                                className="text-[11px] text-white/30 hover:text-red-400 font-medium transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={() => onApplyProposal(msg.id)}
                                className="text-[11px] text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-md px-3 py-1 font-medium transition-all"
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    {msg.status === 'applied' && (
                        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-emerald-400/60 font-medium">
                            <Check size={10} /> Applied
                        </div>
                    )}

                    {msg.status === 'discarded' && (
                        <div className="mt-2 text-right text-[10px] text-white/20 font-medium">Discarded</div>
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
        if (message.role === 'user' || message.type === 'thought') return true;
        return message.status === 'streaming' || message.content.trim().length > 0;
    });

    if (visibleMessages.length === 0) {
        return <EmptyState quickActions={quickActions} onPromptPick={onPromptPick} />;
    }

    return (
        <div className="flex flex-col gap-4 px-4 py-4">
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
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <ProgressBar 
                        progress={progress} 
                        label={statusText(effectiveScope)} 
                    />
                </div>
            )}
        </div>
    );
}
