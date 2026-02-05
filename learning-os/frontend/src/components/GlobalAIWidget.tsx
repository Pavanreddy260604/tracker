import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, Bot, Minimize2, Check, Copy, ArrowDown } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
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

export function GlobalAIWidget() {
    // Use centralized context instead of local state
    const { isOpen, toggleOpen, messages, isLoading, sendMessage } = useAI();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        setShouldAutoScroll(distanceFromBottom < 120);
    };

    useEffect(() => {
        if (!shouldAutoScroll) return;
        scrollToBottom(isLoading ? 'auto' : 'smooth');
    }, [messages, isOpen, shouldAutoScroll, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const messageToSend = input;
        setInput('');
        setShouldAutoScroll(true);
        await sendMessage(messageToSend);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:items-end sm:justify-end sm:p-6 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} // Apple-like spring/ease
                        className="ai-widget w-full max-w-[440px] h-[750px] max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto"
                    >
                        {/* Header */}
                        <div className="ai-widget-header shrink-0">
                            <div className="ai-widget-title">
                                <span>AI Assistant</span>
                                <span className="ai-widget-sub">Auto</span>
                            </div>
                            <div className="ai-widget-actions">
                                <Link to="/chat" className="ai-widget-icon" title="Open Full Chat">
                                    <MessageSquare size={18} strokeWidth={1.5} />
                                </Link>
                                <button
                                    onClick={toggleOpen}
                                    className="ai-widget-icon"
                                >
                                    <Minimize2 size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            className="ai-widget-body flex-1 overflow-y-auto p-0 scroll-smooth relative"
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
                                        <div
                                            key={msg.id}
                                            className="ai-widget-row px-5 py-6 w-full"
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
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} className="h-4" />
                                </div>
                            )}
                            {!shouldAutoScroll && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                        setShouldAutoScroll(true);
                                    }}
                                    className="chat-widget-scroll"
                                    aria-label="Scroll to bottom"
                                >
                                    <ArrowDown size={14} />
                                </button>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="ai-widget-input-wrap shrink-0 z-10 w-full">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="ai-widget-input"
                            >
                                <textarea
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        // Auto-resize could go here
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Message Assistant..."
                                    className="ai-widget-textarea"
                                    rows={1}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className={`ai-widget-send ${input.trim()
                                        ? 'is-active'
                                        : 'is-disabled'
                                        }`}
                                >
                                    <Send size={18} strokeWidth={2} className={input.trim() ? '' : ''} />
                                </button>
                            </form>
                        </div>

                        <div className="ai-widget-footer text-[11px] text-center pb-3">
                            AI can make mistakes. Check important info.
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
