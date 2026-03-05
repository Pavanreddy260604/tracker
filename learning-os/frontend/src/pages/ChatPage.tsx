import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ChatSession } from '../services/api';
import { useAI } from '../contexts/AIContext';
import { ArrowUp, Bot, Plus, Trash2, X, AlertTriangle, Edit, Square, Mic, PanelLeftClose, PanelLeftOpen, ArrowDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../lib/utils';
import { useMobile } from '../hooks/useMobile';

const MemoizedMarkdownBlock = memo(({
    content,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId
}: {
    content: string,
    isLoading: boolean,
    isLast: boolean,
    handleCopyCode: (code: string, id: string) => void,
    copiedBlockId: string | null
}) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const syntaxTheme = isDark ? vscDarkPlus : vs;

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

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    if (!inline && match) {
                        const codeId = getCodeId(codeString, match[1]);
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
            {normalizeTables(content) + (isLast && isLoading ? ' |' : '')}
        </ReactMarkdown>
    );
});

/* ── MODULAR SUB-COMPONENTS ── */

const SidebarItem = memo(({
    session,
    isActive,
    renameTargetId,
    deleteTargetId,
    newTitle,
    setNewTitle,
    onSelect,
    onRenameInit,
    onRenameConfirm,
    onRenameCancel,
    onDeleteInit,
    onDeleteConfirm,
    onDeleteCancel
}: any) => {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => {
                if (renameTargetId || deleteTargetId === session._id) return;
                onSelect(session._id);
            }}
            className={cn(
                "chat-session-item w-full text-left px-3 py-3 rounded-xl text-sm flex items-center group relative min-h-[44px] cursor-pointer",
                isActive && "active"
            )}
        >
            {renameTargetId === session._id ? (
                <div className="flex items-center gap-2 flex-1 w-full" onClick={e => e.stopPropagation()}>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onRenameConfirm();
                            if (e.key === 'Escape') onRenameCancel();
                        }}
                        autoFocus
                        className="w-full bg-[color:var(--console-surface-2)] text-[color:var(--text-primary)] rounded-lg px-2.5 py-1.5 outline-none border border-[color:var(--border-subtle)] focus:border-[color:var(--accent-primary)] focus:ring-2 focus:ring-[color:var(--accent-focus)] text-sm transition-all"
                        placeholder="Enter new name..."
                    />
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={onRenameConfirm}
                            className="p-1.5 rounded-lg bg-[color:var(--accent-primary)] text-white hover:opacity-90 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            onClick={onRenameCancel}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-[color:var(--text-secondary)] min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : deleteTargetId === session._id ? (
                <div className="flex items-center justify-between flex-1 w-full gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-red-400 text-xs font-semibold truncate">Delete this chat?</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={onDeleteConfirm}
                            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors min-h-[30px]"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={onDeleteCancel}
                            className="px-3 py-1 rounded-lg bg-white/5 text-[color:var(--text-secondary)] text-xs font-semibold transition-colors min-h-[30px]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <span className="truncate flex-1 pr-2">{session.title}</span>
                    <div className="chat-session-actions flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={(e) => onRenameInit(e, session._id, session.title)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                        >
                            <Edit size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => onDeleteInit(e, session._id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/15 text-[color:var(--text-secondary)] hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
});

const MessageRow = memo(({
    msg,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId
}: any) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
            className={cn(
                "flex flex-col gap-2 group/row w-full",
                msg.role === 'user' ? 'items-end' : 'items-start',
                isLoading && isLast && msg.role === 'assistant' && "is-streaming"
            )}
        >
            {/* Label & Identity */}
            <div className={cn(
                "flex items-center gap-2 mb-1 px-1",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
                <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-console-surface-2" : "chat-avatar"
                )}>
                    {msg.role === 'user' ? (
                        <span className="text-[10px] font-bold">YOU</span>
                    ) : (
                        <Bot size={14} className="text-white" />
                    )}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] opacity-60">
                    {msg.role === 'user' ? "You" : "Assistant"}
                </span>
            </div>

            {/* Bubble */}
            <div
                className={cn(
                    "chat-bubble overflow-hidden break-words relative",
                    msg.role === 'user' ? "chat-bubble-user" : "chat-bubble-assistant flex-1 w-full"
                )}
            >
                <div className="chat-message prose prose-sm dark:prose-invert max-w-none break-words">
                    {!msg.content && isLoading && msg.role === 'assistant' ? (
                        <div className="flex items-center gap-1 h-6">
                            <div className="w-2.5 h-2.5 bg-[color:var(--accent-primary-dark)] rounded-full animate-pulse"></div>
                        </div>
                    ) : (
                        <MemoizedMarkdownBlock
                            content={msg.content}
                            isLoading={isLoading}
                            isLast={isLast}
                            handleCopyCode={handleCopyCode}
                            copiedBlockId={copiedBlockId}
                        />
                    )}
                </div>
            </div>
        </motion.div>
    );
});

const ChatInput = memo(({
    isLoading,
    handleSend,
    handleStop,
    initialValue = ""
}: {
    isLoading: boolean,
    handleSend: (content: string) => void,
    handleStop: () => void,
    initialValue?: string
}) => {
    const [localInput, setLocalInput] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync external initial value changes (e.g. from prompt starters)
    useEffect(() => {
        if (initialValue) setLocalInput(initialValue);
    }, [initialValue]);

    // Auto-adjust textarea height
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [localInput]);

    const onSendClick = () => {
        if (!localInput.trim() || isLoading) return;
        handleSend(localInput.trim());
        setLocalInput('');
    };

    return (
        <div className="chat-input-wrap px-4 pb-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            <div className="chat-input-container w-full max-w-3xl mx-auto flex flex-row items-center gap-3">
                <button type="button" className="chat-input-icon hover:bg-black/10 dark:hover:bg-white/10 shrink-0" aria-label="Add attachment">
                    <Plus size={22} className="opacity-80" />
                </button>

                <div className="flex-1 min-w-0">
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
                        placeholder="Ask anything"
                        rows={1}
                        inputMode="text"
                        disabled={isLoading}
                        className="chat-input w-full resize-none outline-none py-2 bg-transparent"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button type="button" className="chat-input-icon hover:bg-black/10 dark:hover:bg-white/10" aria-label="Voice">
                        <Mic size={20} className="opacity-80" />
                    </button>
                    <button
                        onClick={isLoading ? handleStop : onSendClick}
                        disabled={!isLoading && !localInput.trim()}
                        className={cn(
                            "chat-send-button w-[36px] h-[36px]",
                            isLoading ? "loading" : localInput.trim() ? "active" : "disabled"
                        )}
                        aria-label={isLoading ? "Stop generating" : "Send message"}
                    >
                        {isLoading ? <Square size={16} fill="currentColor" /> : <ArrowUp size={20} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>
            <div className="text-center text-[10px] sm:text-xs text-[color:var(--text-disabled)] mt-2 opacity-60">
                AI Assistant can make mistakes. Check important info.
            </div>
        </div>
    );
});

export default function ChatPage() {
    const { sessionId, setSessionId } = useAI();
    const { isMobile, isTablet } = useMobile();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [input, setInput] = useState(''); // Only used for prompt starter seeding
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

    // Modal & Menu States
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Target States
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const userInteractionRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setSidebarOpen(!isMobile);
    }, [isMobile]);

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

    const memoizedGroupsFunc = useCallback((sessionList: ChatSession[]) => {
        const groups: { [key: string]: ChatSession[] } = {
            'Today': [],
            'Yesterday': [],
            'Previous 7 Days': [],
            'Previous 30 Days': [],
            'Older': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const sevenDaysAgo = today - 7 * 86400000;
        const thirtyDaysAgo = today - 30 * 86400000;

        sessionList.forEach(session => {
            const sessionDate = new Date(session.updatedAt || session.createdAt).getTime();
            if (sessionDate >= today) {
                groups['Today'].push(session);
            } else if (sessionDate >= yesterday) {
                groups['Yesterday'].push(session);
            } else if (sessionDate >= sevenDaysAgo) {
                groups['Previous 7 Days'].push(session);
            } else if (sessionDate >= thirtyDaysAgo) {
                groups['Previous 30 Days'].push(session);
            } else {
                groups['Older'].push(session);
            }
        });

        return Object.entries(groups).filter(([_, groupAuth]) => groupAuth.length > 0);
    }, []);

    const memoizedGroups = useMemo(() => memoizedGroupsFunc(sessions), [sessions, memoizedGroupsFunc]);

    const handleCopyCode = async (code: string, id: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedBlockId(id);
            setTimeout(() => setCopiedBlockId(null), 1500);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };



    // Rename Handlers
    const handleRenameInit = (e: React.MouseEvent, id: string, currentTitle: string) => {
        e.stopPropagation();
        setRenameTargetId(id);
        setNewTitle(currentTitle);
        setDeleteTargetId(null);
    };

    const confirmRename = async () => {
        if (!renameTargetId || !newTitle.trim()) {
            setRenameTargetId(null);
            return;
        }
        try {
            await api.updateChatSession(renameTargetId, { title: newTitle });
            setSessions(prev => prev.map(s => s._id === renameTargetId ? { ...s, title: newTitle } : s));
        } catch (error) {
            console.error("Failed to rename", error);
        } finally {
            setRenameTargetId(null);
        }
    };

    // Delete Handlers
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteTargetId(id);
        setRenameTargetId(null);
    };

    const confirmDelete = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!deleteTargetId) return;

        try {
            await api.deleteChatSession(deleteTargetId);
            setSessions(prev => prev.filter(s => s._id !== deleteTargetId));
            if (sessionId === deleteTargetId) handleNewChat();
        } catch (error) {
            console.error("Failed to delete chat", error);
        } finally {
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

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const handleSend = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const msgContent = content;
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
            let lastUpdate = Date.now();
            let pendingChunk = '';

            // Add placeholder bot message
            setCurrentSession(prev => prev ? {
                ...prev,
                messages: [...prev.messages, { role: 'assistant', content: '', timestamp: botMsgDate }]
            } : null);

            await api.sendChatMessage(targetSessionId!, msgContent, (chunk) => {
                botMsgContent += chunk;
                pendingChunk += chunk;

                const now = Date.now();
                if (now - lastUpdate > 90) { // Bumped to 90ms for better perf
                    lastUpdate = now;
                    const currentBotContent = botMsgContent;
                    setCurrentSession(prev => {
                        if (!prev) return null;
                        const newMsgs = [...prev.messages];
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = currentBotContent;
                        }
                        return { ...prev, messages: newMsgs };
                    });

                    // Synchronized scroll trigger
                    if (shouldAutoScroll) {
                        requestAnimationFrame(() => scrollToBottom('auto'));
                    }
                    pendingChunk = '';
                }
            }, signal);

            // Final update and final scroll
            if (pendingChunk) {
                setCurrentSession(prev => {
                    if (!prev) return null;
                    const newMsgs = [...prev.messages];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        lastMsg.content = botMsgContent;
                    }
                    return { ...prev, messages: newMsgs };
                });
                if (shouldAutoScroll) {
                    requestAnimationFrame(() => scrollToBottom('auto'));
                }
            }

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
    }, [sessionId, isLoading, setSessions, loadHistory, loadSession, currentSession]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesContainerRef.current) {
            // If user is interacting (scrolled/touched in last 1.5s), don't force scroll unless they are at the bottom
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

        // Use a small precision threshold (5px) for "at bottom"
        // But a larger threshold (80px) for "stopping" auto-scroll
        const currentlyAtBottom = distanceFromBottom < 10;
        const userHasScrolledUpSignificantly = distanceFromBottom > 80;

        setIsAtBottom(currentlyAtBottom);

        if (userHasScrolledUpSignificantly && shouldAutoScroll) {
            setShouldAutoScroll(false);
        } else if (currentlyAtBottom && !shouldAutoScroll) {
            setShouldAutoScroll(true);
        }
    }, [shouldAutoScroll]);

    // Simplified Auto-scroll: Only performs a single adjustment when dependencies change
    // High-frequency auto-scroll is now handled by requestAnimationFrame inside handleSend chunks
    useEffect(() => {
        if (isLoading && shouldAutoScroll) {
            scrollToBottom('auto');
        }
    }, [isLoading, shouldAutoScroll, scrollToBottom]);

    // Auto-adjust textarea height
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [input]);

    return (
        <div className="chat-shell bg-console-bg viewport-keyboard-safe">
            {/* Mobile Sidebar Overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[99]"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            {/* Sidebar */}
            <motion.div
                initial={false}
                animate={{ width: sidebarOpen ? (isMobile ? 280 : (isTablet ? 220 : 260)) : 0 }}
                className={cn(
                    "chat-sidebar flex flex-col overflow-hidden shrink-0 relative transition-[width] duration-300 ease-in-out",
                    sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
                    isMobile && "fixed top-0 left-0 bottom-0 z-[100] h-[100dvh] bg-[color:var(--console-surface)] shadow-2xl"
                )}
            >
                <div className="p-3 mb-2">
                    <button onClick={handleNewChat} className="chat-new-button w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors">
                        <Plus size={16} /> <span className="flex-1">New chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {memoizedGroups.map(([groupName, groupSessionList]) => (
                        <div key={groupName} className="mb-4 last:mb-2">
                            <div className="text-[11px] font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider px-3 mb-2 mt-4 first:mt-1 select-none">
                                {groupName}
                            </div>
                            <div className="space-y-1">
                                {groupSessionList.map(session => (
                                    <SidebarItem
                                        key={session._id}
                                        session={session}
                                        isActive={sessionId === session._id}
                                        renameTargetId={renameTargetId}
                                        deleteTargetId={deleteTargetId}
                                        newTitle={newTitle}
                                        setNewTitle={setNewTitle}
                                        onSelect={(id: string) => {
                                            setSessionId(id);
                                            if (isMobile) setSidebarOpen(false);
                                        }}
                                        onRenameInit={handleRenameInit}
                                        onRenameConfirm={confirmRename}
                                        onRenameCancel={() => setRenameTargetId(null)}
                                        onDeleteInit={handleDelete}
                                        onDeleteConfirm={confirmDelete}
                                        onDeleteCancel={() => setDeleteTargetId(null)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="chat-main flex-1 flex flex-col relative">
                {/* Header */}
                <div className="chat-header sticky top-0 z-10 px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSidebarOpen((prev) => !prev)}
                            className="chat-icon-button p-2 rounded-lg"
                            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                        >
                            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        <span className="chat-title truncate max-w-[120px] sm:max-w-none max-sm:hidden">AI Chat</span>
                        <span className="max-sm:hidden px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] bg-accent-primary/10 border border-accent-primary/20 text-accent-primary shrink-0">
                            Pro
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleNewChat}
                            className="chat-icon-button p-2 rounded-lg transition-colors bg-white hover:bg-gray-100 dark:bg-[#1f2937] dark:hover:bg-[#374151] border border-gray-200 dark:border-gray-700 max-sm:flex items-center gap-2 max-sm:px-3 max-sm:py-1.5 max-sm:rounded-full max-sm:shrink-0"
                            title="New chat"
                        >
                            <Plus size={16} />
                            <span className="text-[13px] font-medium hidden max-sm:inline-block">New Chat</span>
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
                    onWheel={handleInteraction}
                    onTouchStart={handleInteraction}
                    onTouchMove={handleInteraction}
                    onMouseDown={handleInteraction}
                    className="chat-messages flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar relative"
                    style={{ overflowAnchor: 'auto', scrollBehavior: 'auto' } as any}
                >
                    {!currentSession || currentSession.messages.length === 0 ? (
                        <div className="chat-empty h-full flex flex-col items-center justify-center text-center gap-4 max-w-3xl mx-auto">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-transparent">
                                <Bot size={40} className="text-[color:var(--text-primary)] opacity-80" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-3xl font-bold text-[color:var(--text-primary)] tracking-tight">How can I help you today?</h1>
                                <p className="text-[color:var(--text-secondary)] text-sm max-w-[480px] mx-auto opacity-70">Empowering your workflow with intelligent code analysis, debugging, and strategic planning.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-6">
                                {["Explain this error", "Draft a REST API spec", "Review my function", "Create a study plan"].map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => setInput(prompt)}
                                        className="chat-prompt-starter text-left px-5 py-4 rounded-3xl transition-all duration-200"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[15px] font-medium text-[color:var(--text-primary)]">{prompt}</span>
                                            <span className="text-xs text-[color:var(--text-secondary)] opacity-60">
                                                {prompt === "Explain this error" ? "Debug your code snapshots" :
                                                    prompt === "Draft a REST API spec" ? "Plan your backend architecture" :
                                                        prompt === "Review my function" ? "Improve performance and security" :
                                                            "Structured learning roadmap"}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="chat-content max-w-5xl mx-auto space-y-12 pb-36 px-4">
                            {currentSession.messages.map((msg, idx) => (
                                <MessageRow
                                    key={idx}
                                    msg={msg}
                                    idx={idx}
                                    isLoading={isLoading}
                                    isLast={idx === currentSession.messages.length - 1}
                                    handleCopyCode={handleCopyCode}
                                    copiedBlockId={copiedBlockId}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                    {!isAtBottom && (
                        <button
                            type="button"
                            onClick={() => {
                                scrollToBottom('smooth');
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
                <ChatInput
                    isLoading={isLoading}
                    handleSend={handleSend}
                    handleStop={handleStop}
                    initialValue={input}
                />
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
                                <div className="w-12 h-12 bg-status-warning/10 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="text-status-warning" size={24} />
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
                                        className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-console-surface-2 border border-border-subtle text-text-primary hover:bg-console-surface-3 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmExit}
                                        className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-accent-primary text-white hover:opacity-90 transition-opacity"
                                    >
                                        Exit
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


        </div>
    );
}
