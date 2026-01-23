import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, Bot, Minimize2, Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
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
        <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700/50 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
                <span className="text-xs font-mono text-gray-400 lowercase">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '1.5rem', fontSize: '0.875rem' }}
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const messageToSend = input;
        setInput('');
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
                        className="w-full max-w-[440px] h-[750px] max-h-[90vh] bg-white dark:bg-[#212121] rounded-2xl shadow-xl border border-gray-200/50 dark:border-white/5 flex flex-col overflow-hidden pointer-events-auto font-sans"
                    >
                        {/* Header */}
                        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-[#212121] backdrop-blur-sm shrink-0">
                            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-100 font-medium">
                                <span className="text-sm">AI Assistant</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">Auto</span>
                            </div>
                            <Link to="/chat" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400" title="Open Full Chat">
                                <MessageSquare size={18} strokeWidth={1.5} />
                            </Link>
                            <button
                                onClick={toggleOpen}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                            >
                                <Minimize2 size={18} strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-0 scroll-smooth">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-fade-in fill-mode-forwards" style={{ animationDelay: '0.1s' }}>
                                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-sm ring-1 ring-black/5">
                                        <Bot size={24} className="text-gray-800 dark:text-gray-100" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">How can I help you today?</h3>
                                </div>
                            ) : (
                                <div className="flex flex-col pb-4">
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`px-5 py-6 w-full group ${msg.role === 'user'
                                                ? 'bg-transparent'
                                                : 'bg-transparent'
                                                }`}
                                        >
                                            <div className="flex gap-4 max-w-3xl mx-auto">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 select-none">
                                                    {msg.role === 'user' ? (
                                                        <div className="w-7 h-7 bg-gray-500 dark:bg-gray-700 text-white rounded-full flex items-center justify-center">
                                                            {/* User Initials or Icon */}
                                                            <span className="text-xs font-medium">YO</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 bg-[#10a37f] rounded-full flex items-center justify-center shadow-sm">
                                                            <Sparkles size={16} className="text-white" strokeWidth={2} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 overflow-hidden space-y-1">
                                                    <div className="font-semibold text-sm text-gray-900 dark:text-white select-none mb-1">
                                                        {msg.role === 'user' ? 'You' : 'Assistant'}
                                                    </div>
                                                    <div className={`prose prose-sm dark:prose-invert max-w-none text-[15px] leading-7 text-gray-800 dark:text-gray-100 ${isLoading && msg.role === 'assistant' && !msg.content ? 'animate-pulse' : ''}`}>
                                                        {msg.role === 'assistant' && !msg.content ? (
                                                            <div className="flex items-center gap-1 h-6">
                                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                                            </div>
                                                        ) : (
                                                            <ReactMarkdown
                                                                components={{
                                                                    code({ node, inline, className, children, ...props }: any) {
                                                                        const match = /language-(\w+)/.exec(className || '');
                                                                        return !inline && match ? (
                                                                            <CodeBlock
                                                                                language={match[1]}
                                                                                value={String(children).replace(/\n$/, '')}
                                                                            />
                                                                        ) : (
                                                                            <code className={`${className} font-mono text-sm bg-black/5 dark:bg-white/15 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200`} {...props}>
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
                        </div>

                        {/* Input Area */}
                        <div className="p-4 pt-2 bg-gradient-to-t from-white via-white to-transparent dark:from-[#212121] dark:via-[#212121] dark:to-transparent shrink-0 z-10 w-full flex justify-center">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="w-full max-w-3xl relative flex items-end bg-[#f4f4f4] dark:bg-[#2f2f2f] rounded-[26px] p-2 ring-1 ring-transparent focus-within:ring-gray-200 dark:focus-within:ring-white/10 transition-all shadow-sm"
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
                                    className="flex-1 max-h-[200px] min-h-[44px] py-3 pl-4 pr-12 bg-transparent border-none outline-none text-[15px] text-gray-900 dark:text-white placeholder:text-gray-500 resize-none overflow-y-auto"
                                    rows={1}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-all duration-200 flex items-center justify-center w-8 h-8 ${input.trim()
                                        ? 'bg-[#10a37f] text-white hover:opacity-90'
                                        : 'bg-black/10 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Send size={18} strokeWidth={2} className={input.trim() ? '' : ''} />
                                </button>
                            </form>
                        </div>

                        <div className="text-[11px] text-center pb-3 text-gray-400 dark:text-gray-500 bg-white dark:bg-[#212121]">
                            AI can make mistakes. Check important info.
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
