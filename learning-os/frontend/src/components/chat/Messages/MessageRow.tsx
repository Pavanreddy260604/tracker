import { memo } from 'react';
import {
    Volume2,
    StopCircle,
    Bot,
    ShieldAlert,
    CircleSlash
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AIChatMarkdown } from '../AIChatRenderer';
import { getLoadingVisual, LoadingStatusLabel } from '../LoadingStatusLabel';

interface MessageRowProps {
    msg: any;
    idx: number;
    isLoading: boolean;
    isLast: boolean;
    handleCopyCode: (code: string, id: string) => void;
    copiedBlockId: string | null;
    onSpeak: (text: string) => void;
    isSpeakingThis: boolean;
}

export const MessageRow = memo(({
    msg,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId,
    onSpeak,
    isSpeakingThis
}: MessageRowProps) => {
    const resourceSummary = Array.isArray(msg.resourceSummary) ? msg.resourceSummary : [];
    const isAssistantStreaming = msg.role === 'assistant' && isLoading;
    const hasPartialContent = typeof msg.content === 'string' && msg.content.trim().length > 0;
    const loadingVisual = getLoadingVisual(msg);

    return (
        <div
            className={cn(
                "flex flex-col gap-2 group/row w-full",
                msg.role === 'user' ? 'items-end' : 'items-start',
                isAssistantStreaming && isLast && "is-streaming"
            )}
        >
            {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1 justify-end">
                    {msg.attachments.map((file: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-console-surface-2 border border-border-subtle text-[10px] font-medium text-text-secondary">
                            <span className="truncate max-w-[120px]">{file.name}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className={cn(
                "flex items-start gap-3 max-w-[92%] sm:max-w-[85%]",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
                <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-sm",
                    msg.role === 'user'
                        ? "bg-accent-primary text-console-bg order-2"
                        : "bg-console-surface-3 text-text-primary border border-border-subtle/50"
                )}>
                    {msg.role === 'user' ? "YOU" : <Bot size={18} className="text-text-primary/70" />}
                </div>

                <div className={cn(
                    "relative flex flex-col group min-w-0",
                    msg.role === 'user' ? "items-end" : "items-start"
                )}>
                    <div className={cn(
                        "message-bubble px-4 py-3 rounded-2xl shadow-sm transition-all duration-200",
                        msg.role === 'user'
                            ? "bg-accent-primary/10 border border-accent-primary/20 text-text-primary rounded-tr-none"
                            : "bg-console-surface-2 border border-border-subtle/50 text-text-primary rounded-tl-none hover:border-border-subtle",
                        msg.status === 'failed' && "border-status-error/40",
                        msg.status === 'cancelled' && "border-status-warning/30"
                    )}>
                        {msg.role === 'assistant' && isAssistantStreaming && !hasPartialContent ? (
                            <div className="chat-thinking-inline">
                                <div className="chat-thinking-copy">
                                    <LoadingStatusLabel
                                        text={loadingVisual.title}
                                        animation={loadingVisual.animation}
                                        className="chat-thinking-label"
                                    />
                                    <div className="chat-thinking-detail truncate max-w-[460px]">
                                        {loadingVisual.detail}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <AIChatMarkdown
                                    content={msg.content}
                                    isLoading={isLoading}
                                    isLast={isLast}
                                    handleCopyCode={handleCopyCode}
                                    copiedBlockId={copiedBlockId}
                                    modelUsed={msg.modelUsed}
                                />
                                {msg.role === 'assistant' && isAssistantStreaming && (
                                    <div className="chat-thinking-footer">
                                        <div className="chat-thinking-copy min-w-0 flex-1">
                                            <LoadingStatusLabel
                                                text={loadingVisual.title}
                                                animation={loadingVisual.animation}
                                                className="chat-thinking-label"
                                            />
                                            <div className="chat-thinking-detail truncate">
                                                {loadingVisual.detail}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {(msg.status === 'failed' || msg.status === 'cancelled') && (
                        <div className={cn(
                            "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                            msg.status === 'failed'
                                ? "border-status-error/30 bg-status-error/10 text-status-error"
                                : "border-status-warning/30 bg-status-warning/10 text-status-warning"
                        )}>
                            {msg.status === 'failed' ? <ShieldAlert size={12} /> : <CircleSlash size={12} />}
                            <span>{msg.status === 'failed' ? 'Delivery interrupted' : 'Response stopped'}</span>
                        </div>
                    )}

                    <div className={cn(
                        "flex items-center gap-3 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                        <span className="text-[10px] text-text-disabled font-medium">
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {msg.role === 'assistant' && msg.content && (
                            <button
                                onClick={() => onSpeak(msg.content)}
                                className={cn(
                                    "p-1 rounded-md transition-colors",
                                    isSpeakingThis ? "bg-accent-primary/20 text-accent-primary" : "hover:bg-console-surface-3 text-text-tertiary"
                                )}
                                title={isSpeakingThis ? "Stop speaking" : "Speak message"}
                            >
                                {isSpeakingThis ? <StopCircle size={10} /> : <Volume2 size={10} />}
                            </button>
                        )}

                        {resourceSummary.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {resourceSummary.map((res: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded-full bg-console-surface-3 border border-border-subtle/30 text-[9px] text-text-tertiary font-bold lowercase">
                                        #{res}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
