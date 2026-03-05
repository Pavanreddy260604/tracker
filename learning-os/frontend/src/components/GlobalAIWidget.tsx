import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { MessageSquare, Send, Sparkles, Bot, X, Check, Copy, ArrowDown, Plus, Mic } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useLocation } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="ai-code-block">
            <div className="ai-code-header">
                <span className="ai-code-lang">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="ai-code-copy"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '1.25rem', fontSize: '0.85rem', background: '#1e1e1e' }}
                wrapLines={true}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
};

const MemoizedMarkdownBlock = memo(({ content }: { content: string }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <CodeBlock
                            language={match[1]}
                            value={String(children).replace(/\n$/, '')}
                        />
                    ) : (
                        <code className={`${className} chat-inline-code`} {...props}>
                            {children}
                        </code>
                    );
                },
                p({ children }) {
                    return <p className="mb-4 last:mb-0">{children}</p>;
                },
                ul({ children }) {
                    return <ul className="list-disc pl-4 mb-4 space-y-1 marker:text-gray-500">{children}</ul>;
                },
                ol({ children }) {
                    return <ol className="list-decimal pl-4 mb-4 space-y-1 marker:text-gray-500">{children}</ol>;
                },
                table({ children }: any) {
                    return (
                        <div className="chat-table-wrap">
                            <table>{children}</table>
                        </div>
                    );
                },
                th({ children }: any) {
                    return <th className="chat-table-th">{children}</th>;
                },
                td({ children }: any) {
                    return <td className="chat-table-td">{children}</td>;
                },
                h1({ children }: any) {
                    return <h1 className="chat-h1">{children}</h1>;
                },
                h2({ children }: any) {
                    return <h2 className="chat-h2">{children}</h2>;
                },
                h3({ children }: any) {
                    return <h3 className="chat-h3">{children}</h3>;
                },
                h4({ children }: any) {
                    return <h4 className="chat-h4">{children}</h4>;
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
});

const AIChatInput = memo(({
    isLoading,
    handleSend
}: {
    isLoading: boolean,
    handleSend: (content: string) => void
}) => {
    const [localInput, setLocalInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-adjust textarea height
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
        }
    }, [localInput]);

    const onSendClick = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!localInput.trim() || isLoading) return;
        handleSend(localInput.trim());
        setLocalInput('');
    };

    return (
        <div className="ai-widget-input-wrap shrink-0 z-10 w-full px-4 pb-4 pt-2">
            <form
                onSubmit={onSendClick}
                className="chat-input-container w-full flex flex-row items-center gap-2"
            >
                <button type="button" className="chat-input-icon hover:bg-black/10 dark:hover:bg-white/10 shrink-0" aria-label="Add attachment">
                    <Plus size={20} className="opacity-80" />
                </button>

                <div className="flex-1 min-w-0 bg-white/5 dark:bg-black/20 rounded-xl px-3 py-1 border border-white/10 focus-within:border-accent-primary/50 transition-colors">
                    <textarea
                        ref={textareaRef}
                        value={localInput}
                        onChange={(e) => setLocalInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSendClick();
                            }
                        }}
                        placeholder="Ask anything..."
                        disabled={isLoading}
                        rows={1}
                        className="chat-input w-full outline-none py-2 bg-transparent text-[14px] resize-none scrollbar-hide max-h-40"
                        autoComplete="off"
                    />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="chat-input-icon hover:bg-black/10 dark:hover:bg-white/10 hidden sm:flex" aria-label="Voice">
                        <Mic size={18} className="opacity-80" />
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || !localInput.trim()}
                        className="chat-send-button hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
});

export function GlobalAIWidget() {
    // Use centralized context instead of local state
    const { isOpen, toggleOpen, messages, isLoading, sendMessage } = useAI();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const userInteractionRef = useRef<number>(0);

    const location = useLocation();

    // Determine if the current route has a bottom nav rendered
    const hasBottomNav = !['/login', '/register', '/chat', '/script-writer'].some(p => location.pathname.startsWith(p));
    const navOffset = hasBottomNav ? 'var(--bottom-nav-height, 72px)' : '0px';

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesContainerRef.current) {
            const isUserInteracting = Date.now() - userInteractionRef.current < 1500;
            if (isUserInteracting && !isAtBottom) return;

            const { scrollHeight, clientHeight } = messagesContainerRef.current;
            messagesContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior
            });
        }
    }, [isAtBottom]);

    const handleInteraction = useCallback(() => {
        userInteractionRef.current = Date.now();
    }, []);

    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Refined thresholds for the widget
        const currentlyAtBottom = distanceFromBottom < 10;
        const userHasScrolledUpSignificantly = distanceFromBottom > 60;

        setIsAtBottom(currentlyAtBottom);
        if (userHasScrolledUpSignificantly && shouldAutoScroll) {
            setShouldAutoScroll(false);
        } else if (currentlyAtBottom && !shouldAutoScroll) {
            setShouldAutoScroll(true);
        }
    }, [shouldAutoScroll]);

    // Simplified Auto-scroll: Only performs a single adjustment when dependencies change
    // High-frequency auto-scroll is now handled by requestAnimationFrame in handleSend via the onChunk callback
    useEffect(() => {
        if (isLoading && shouldAutoScroll) {
            scrollToBottom('auto');
        }
    }, [isLoading, shouldAutoScroll, scrollToBottom]);

    const handleSend = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;
        setShouldAutoScroll(true);
        await sendMessage(content.trim(), () => {
            if (shouldAutoScroll) {
                requestAnimationFrame(() => scrollToBottom('auto'));
            }
        });
    }, [isLoading, sendMessage, shouldAutoScroll, scrollToBottom]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="ai-widget-modal-container fixed inset-0 z-[10000] flex items-center justify-center sm:items-end sm:justify-end sm:p-6 pointer-events-none"
                    style={{ '--current-nav-offset': navOffset } as React.CSSProperties}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300,
                            mass: 0.8
                        }}
                        className="ai-widget w-full sm:max-w-[440px] h-full sm:h-[750px] max-h-screen sm:max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto sm:rounded-2xl bg-console-elevated shadow-premium"
                    >
                        {/* Header */}
                        <div className="ai-widget-header shrink-0 px-3">
                            <div className="ai-widget-title flex items-center gap-2 overflow-hidden">
                                <span className="truncate">AI Assistant</span>
                            </div>
                            <div className="ai-widget-actions">
                                <Link to="/chat" className="ai-widget-icon" title="Open Full Chat" onClick={toggleOpen}>
                                    <MessageSquare size={18} strokeWidth={1.5} />
                                </Link>
                                <button
                                    onClick={toggleOpen}
                                    className="ai-widget-icon"
                                    aria-label="Close"
                                >
                                    <X size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            onWheel={handleInteraction}
                            onTouchStart={handleInteraction}
                            onTouchMove={handleInteraction}
                            onMouseDown={handleInteraction}
                            className="ai-widget-body flex-1 overflow-y-auto p-0 scroll-smooth relative"
                            style={{ overflowAnchor: 'auto', scrollBehavior: 'auto' } as any}
                        >
                            {messages.length === 0 ? (
                                <div className="ai-widget-empty h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-fade-in fill-mode-forwards" style={{ animationDelay: '0.1s' }}>
                                    <div className="ai-widget-avatar">
                                        <Bot size={24} className="text-[color:var(--text-primary)]" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="ai-widget-empty-title">How can I help you today?</h3>
                                </div>
                            ) : (
                                <div className="ai-widget-thread flex flex-col pb-4">
                                    {messages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`ai-widget-row px-5 py-6 w-full contain-layout ${isLoading && msg.role === 'assistant' && !msg.content ? 'is-streaming' : ''}`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="ai-widget-avatar-sm select-none">
                                                    {msg.role === 'user' ? (
                                                        <div className="ai-widget-user-avatar">YO</div>
                                                    ) : (
                                                        <div className="ai-widget-assistant-avatar">
                                                            <Sparkles size={16} className="text-white" strokeWidth={2} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="ai-widget-content flex-1 min-w-0 overflow-hidden space-y-1">
                                                    <div className="ai-widget-name select-none mb-1">
                                                        {msg.role === 'user' ? 'You' : 'Assistant'}
                                                    </div>
                                                    <div className={`ai-widget-text prose prose-sm dark:prose-invert max-w-none ${isLoading && msg.role === 'assistant' && !msg.content ? 'animate-pulse' : ''}`}>
                                                        {msg.role === 'assistant' && !msg.content ? (
                                                            <div className="flex items-center gap-1 h-6">
                                                                <span className="w-2 h-2 bg-[color:var(--text-secondary)] rounded-full animate-bounce" />
                                                            </div>
                                                        ) : (
                                                            <MemoizedMarkdownBlock content={msg.content} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    <div ref={messagesEndRef} className="h-4 shrink-0" />
                                </div>
                            )}
                            {!isAtBottom && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                    type="button"
                                    onClick={() => {
                                        scrollToBottom('smooth');
                                        setShouldAutoScroll(true);
                                    }}
                                    className="chat-widget-scroll absolute right-6 bottom-24 flex items-center justify-center bg-accent-primary text-white p-2 rounded-full shadow-lg z-50 hover:bg-accent-primary-dark transition-colors"
                                    aria-label="Scroll to bottom"
                                >
                                    <ArrowDown size={16} strokeWidth={2.5} />
                                </motion.button>
                            )}
                        </div>

                        {/* Input Area */}
                        <AIChatInput
                            isLoading={isLoading}
                            handleSend={handleSend}
                        />

                        <div className="ai-widget-footer text-[11px] text-center pb-3">
                            AI can make mistakes. Check important info.
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
