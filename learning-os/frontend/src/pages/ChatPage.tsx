import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ChatSession } from '../services/api';
import { useAI } from '../contexts/AIContext';
import { Send, Bot, Plus, Trash2, X, AlertTriangle, MoreVertical, Edit, Square, Mic, PanelLeftClose, PanelLeftOpen, ArrowDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../lib/utils';

export default function ChatPage() {
    const { sessionId, setSessionId } = useAI();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Modal & Menu States
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);

    // Target States
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        if (sessionId) {
            // Prevent reloading if we already have the correct session (fixes New Chat race condition)
            if (currentSession?._id === sessionId) return;
            loadSession(sessionId);
        } else {
            setCurrentSession(null);
        }
    }, [sessionId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const loadHistory = async () => {
        try {
            const data = await api.getChatHistory();
            setSessions(data);
        } catch (error) {
            console.error('Failed to load history', error);
        }
    };

    const loadSession = async (id: string) => {
        setIsLoading(true);
        try {
            const session = await api.getChatSession(id);
            setCurrentSession(session);
            // Move to top of list if exists
            setSessions(prev => {
                const found = prev.find(s => s._id === id);
                if (found) return [found, ...prev.filter(s => s._id !== id)];
                return prev;
            });
        } catch (error) {
            console.error('Failed to load session', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setSessionId(null);
        setCurrentSession(null);
        setInput('');
        setShouldAutoScroll(true);
    };

    const handleCopyCode = async (code: string, id: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedBlockId(id);
            setTimeout(() => setCopiedBlockId(null), 1500);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };

    const getCodeId = (code: string, lang?: string) => {
        const seed = `${lang || 'text'}:${code.length}:${code.slice(0, 24)}`;
        return seed.replace(/\s+/g, '-');
    };

    const normalizeTables = (text: string) => {
        const lines = text.split('\n');
        const normalized: string[] = [];

        for (const line of lines) {
            const hasTableMarker = /\|\s*:?-{3,}/.test(line);
            const hasRowBreaks = /\|\s+\|/.test(line);
            if (hasTableMarker && hasRowBreaks) {
                const firstPipe = line.indexOf('|');
                if (firstPipe > 0) {
                    const prefix = line.slice(0, firstPipe).trim();
                    if (prefix) normalized.push(prefix);
                }
                let tablePart = firstPipe >= 0 ? line.slice(firstPipe) : line;
                tablePart = tablePart.replace(/\|\s+\|/g, '|\n|');
                normalized.push(tablePart);
            } else {
                normalized.push(line);
            }
        }

        return normalized.join('\n');
    };

    // Rename Handlers
    const handleRenameInit = (e: React.MouseEvent, id: string, currentTitle: string) => {
        e.stopPropagation();
        setRenameTargetId(id);
        setNewTitle(currentTitle);
        setShowRenameModal(true);
        setActiveDropdownId(null);
    };

    const confirmRename = async () => {
        if (!renameTargetId || !newTitle.trim()) return;
        try {
            await api.updateChatSession(renameTargetId, { title: newTitle });
            setSessions(prev => prev.map(s => s._id === renameTargetId ? { ...s, title: newTitle } : s));
        } catch (error) {
            console.error("Failed to rename", error);
        } finally {
            setShowRenameModal(false);
            setRenameTargetId(null);
        }
    };

    // Delete Handlers
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteTargetId(id);
        setShowDeleteConfirm(true);
        setActiveDropdownId(null);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        try {
            await api.deleteChatSession(deleteTargetId);
            setSessions(prev => prev.filter(s => s._id !== deleteTargetId));
            if (sessionId === deleteTargetId) handleNewChat();
        } catch (error) {
            console.error("Failed to delete chat", error);
        } finally {
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
        }
    };

    // Exit Handlers
    const handleExit = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowExitConfirm(true);
    };

    const confirmExit = () => {
        navigate('/');
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const msgContent = input;
        setInput('');
        setShouldAutoScroll(true);
        setIsLoading(true);

        // Abort Controller Setup
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            let targetSessionId = sessionId;

            if (!targetSessionId) {
                // Create New Session (Empty)
                const newSession = await api.createChatSession();
                targetSessionId = newSession._id;
                // Important: Set currentSession BEFORE sessionId to prevent useEffect reload race condition
                setCurrentSession({ ...newSession, messages: [] });
                setSessions(prev => [newSession, ...prev]);
                setSessionId(targetSessionId);
            }

            // Optimistic Update
            const userMsg = { role: 'user' as const, content: msgContent, timestamp: new Date().toISOString() };
            setCurrentSession(prev => prev ? { ...prev, messages: [...prev.messages, userMsg] } : null);

            // Stream Response
            let botMsgContent = '';
            const botMsgDate = new Date().toISOString();

            // Add placeholder bot message
            setCurrentSession(prev => prev ? {
                ...prev,
                messages: [...prev.messages, { role: 'assistant', content: '', timestamp: botMsgDate }]
            } : null);

            await api.sendChatMessage(targetSessionId!, msgContent, (chunk) => {
                botMsgContent += chunk;
                setCurrentSession(prev => {
                    if (!prev) return null;
                    const newMsgs = [...prev.messages];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg.role === 'assistant') {
                        lastMsg.content = botMsgContent;
                    }
                    return { ...prev, messages: newMsgs };
                });
            }, signal);

            // Refresh history title after first message
            if (!sessionId) loadHistory();

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Generation stopped by user');
            } else {
                console.error('Chat error', error);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        setShouldAutoScroll(distanceFromBottom < 120);
    };

    // Auto-scroll only when user is at/near bottom
    useEffect(() => {
        if (!shouldAutoScroll) return;
        messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
    }, [currentSession?.messages[currentSession.messages.length - 1]?.content, shouldAutoScroll, isLoading]);

    return (
        <div className="chat-shell bg-gradient-to-b from-[#0b1020] via-[#0c111d] to-[#0b0f17]">
            {/* Sidebar */}
            <motion.div
                initial={{ width: 260 }}
                animate={{ width: sidebarOpen ? 260 : 0 }}
                className={cn(
                    "chat-sidebar flex flex-col overflow-hidden shrink-0 relative transition-[width] duration-300 ease-in-out",
                    sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            >
                <div className="p-3 mb-2">
                    <button onClick={handleNewChat} className="chat-new-button w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors">
                        <Plus size={16} /> <span className="flex-1">New chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessions.map(session => (
                        <button
                            key={session._id}
                            onClick={() => setSessionId(session._id)}
                            className={cn(
                                "chat-session-item w-full text-left p-3 rounded-xl text-sm flex items-center justify-between group relative",
                                sessionId === session._id && "active"
                            )}
                        >
                            <span className="truncate flex-1 pr-8">{session.title}</span>

                            {/* Dropdown Trigger */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownId(activeDropdownId === session._id ? null : session._id);
                                }}
                                className={cn(
                                    "chat-session-action absolute right-2 p-1 rounded-md transition-colors",
                                    activeDropdownId === session._id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}
                            >
                                <MoreVertical size={16} />
                            </div>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                                {activeDropdownId === session._id && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                        className="chat-dropdown absolute right-0 top-10 w-36 rounded-lg z-50 overflow-hidden py-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div
                                            onClick={(e) => handleRenameInit(e, session._id, session.title)}
                                            className="chat-dropdown-item w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer"
                                        >
                                            <Edit size={12} /> Rename
                                        </div>
                                        <div
                                            onClick={(e) => handleDelete(e, session._id)}
                                            className="chat-dropdown-item chat-dropdown-item-danger w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="chat-main flex-1 flex flex-col relative">
                {/* Header */}
                <div className="chat-header sticky top-0 z-10 px-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen((prev) => !prev)}
                            className="chat-icon-button p-2 rounded-lg"
                            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                        >
                            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        <span className="chat-title">AI Chat</span>
                        <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.15em] bg-white/5 border border-white/10 text-blue-100">
                            Model • Studio Pro
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewChat}
                            className="chat-icon-button p-2 rounded-lg transition-colors"
                            title="New chat"
                        >
                            <Plus size={18} />
                        </button>
                        <button onClick={handleExit} className="chat-icon-button p-2 rounded-lg transition-colors" title="Exit Chat">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleMessagesScroll}
                    className="chat-messages flex-1 overflow-y-auto p-4 custom-scrollbar relative"
                >
                    {!currentSession || currentSession.messages.length === 0 ? (
                        <div className="chat-empty h-full flex flex-col items-center justify-center text-center gap-4 max-w-3xl mx-auto">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[color:var(--console-surface-2)] border border-[color:var(--border-subtle)] shadow-xl shadow-black/30">
                                <Bot size={32} className="text-[color:var(--text-secondary)]" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">How can I help you today?</h2>
                                <p className="text-[color:var(--text-secondary)] text-sm">Ask about code, debugging, or planning. You’ll get streaming replies with copyable code.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                                {["Explain this error", "Draft a REST API spec", "Review my function", "Create a study plan"].map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => setInput(prompt)}
                                        className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-colors text-[color:var(--text-primary)]"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="chat-content max-w-5xl mx-auto space-y-8 pb-16">
                            {currentSession.messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="chat-avatar w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                                            <Bot size={18} className="text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            "chat-bubble",
                                            msg.role === 'user' ? "chat-bubble-user" : "chat-bubble-assistant"
                                        )}
                                    >
                                        <div className="chat-message prose prose-sm dark:prose-invert max-w-none">
                                            {!msg.content && isLoading && msg.role === 'assistant' ? (
                                                <div className="flex items-center gap-1 h-6">
                                                    <div className="w-2.5 h-2.5 bg-[color:var(--accent-primary-dark)] rounded-full animate-pulse"></div>
                                                </div>
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            const codeString = String(children).replace(/\n$/, '');
                                                            if (!inline && match) {
                                                                const codeId = getCodeId(codeString, match[1]);
                                                                const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
                                                                const syntaxTheme = isDark ? vscDarkPlus : vs;
                                                                return (
                                                                    <div className="chat-code-block">
                                                                        <div className="chat-code-toolbar">
                                                                            <span className="chat-code-lang">{match[1]}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCopyCode(codeString, codeId)}
                                                                                className="chat-code-copy"
                                                                            >
                                                                                {copiedBlockId === codeId ? 'Copied' : 'Copy'}
                                                                            </button>
                                                                        </div>
                                                                        <SyntaxHighlighter
                                                                            style={syntaxTheme}
                                                                            language={match[1]}
                                                                            PreTag="div"
                                                                            customStyle={{ margin: 0, borderRadius: '0.75em', padding: '16px' }}
                                                                            showLineNumbers
                                                                            wrapLines
                                                                            lineNumberStyle={{
                                                                                color: isDark ? '#6b7280' : '#9ca3af',
                                                                                opacity: 0.7
                                                                            }}
                                                                            {...props}
                                                                        >
                                                                            {codeString}
                                                                        </SyntaxHighlighter>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <code className={`${className} chat-inline-code`} {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                        ,
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
                                                    {normalizeTables(msg.content) + (msg.role === 'assistant' && isLoading && idx === currentSession.messages.length - 1 ? ' |' : '')}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                    {!shouldAutoScroll && (
                        <button
                            type="button"
                            onClick={() => {
                                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                setShouldAutoScroll(true);
                            }}
                            className="chat-scroll-button shadow-lg shadow-black/40"
                            aria-label="Scroll to bottom"
                        >
                            <ArrowDown size={16} />
                            <span>Scroll to bottom</span>
                        </button>
                    )}
                </div>

                {/* Input */}
                <div className="chat-input-wrap p-4">
                    <div className="chat-input-container max-w-3xl mx-auto">
                        <button type="button" className="chat-input-icon" aria-label="Attach">
                            <Plus size={18} />
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask anything"
                            rows={1}
                            className="chat-input flex-1 resize-none outline-none"
                        />
                        <button type="button" className="chat-input-icon" aria-label="Voice">
                            <Mic size={18} />
                        </button>
                        <button
                            onClick={isLoading ? handleStop : handleSend}
                            disabled={!isLoading && !input.trim()}
                            className={cn(
                                "chat-send-button",
                                isLoading ? "loading animate-pulse" : input.trim() ? "active" : "disabled"
                            )}
                            aria-label={isLoading ? "Stop generating" : "Send message"}
                        >
                            {isLoading ? <Square size={16} fill="currentColor" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="text-center text-xs text-[color:var(--text-disabled)] mt-2">
                        AI Assistant can make mistakes. Check important info.
                    </div>
                </div>
            </div>

            {/* Exit Confirmation Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="chat-modal max-w-sm w-full p-6"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="text-yellow-600 dark:text-yellow-500" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-[color:var(--text-primary)] mb-2">
                                    Exit Chat?
                                </h3>
                                <p className="text-sm text-[color:var(--text-secondary)] mb-6">
                                    Are you sure you want to leave? Your current session is saved, but you'll exit this interface.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="chat-modal-button flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmExit}
                                        className="chat-modal-primary flex-1 px-4 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Exit
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="chat-modal max-w-sm w-full p-6"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                    <Trash2 className="text-red-600 dark:text-red-500" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-[color:var(--text-primary)] mb-2">
                                    Delete Chat?
                                </h3>
                                <p className="text-sm text-[color:var(--text-secondary)] mb-6">
                                    This will permanently delete this conversation. This action cannot be undone.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="chat-modal-button flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="chat-modal-danger flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Rename Modal */}
            <AnimatePresence>
                {showRenameModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="chat-modal max-w-sm w-full p-6"
                        >
                            <h3 className="text-lg font-semibold text-[color:var(--text-primary)] mb-4">
                                Rename Chat
                            </h3>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="chat-input w-full rounded-lg px-4 py-2.5 outline-none mb-6"
                                placeholder="Chat title"
                                autoFocus
                            />
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowRenameModal(false)}
                                    className="chat-modal-button flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRename}
                                    className="chat-modal-primary flex-1 px-4 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                >
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
