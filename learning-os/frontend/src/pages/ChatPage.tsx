import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ChatSession } from '../services/api';
import { useAI } from '../contexts/AIContext';
import { Send, Bot, Plus, Trash2, Menu, ArrowLeft, X, AlertTriangle, MoreVertical, Edit, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
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

    // Auto-scroll on every content change (streaming)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentSession?.messages[currentSession.messages.length - 1]?.content]);

    return (
        <div className="flex h-screen bg-[#f9f9f9] dark:bg-[#121212] font-sans">
            {/* Sidebar */}
            <motion.div
                initial={{ width: 260 }}
                animate={{ width: sidebarOpen ? 260 : 0 }}
                className="bg-[#171717] flex flex-col overflow-hidden shrink-0 relative transition-[width] duration-300 ease-in-out"
            >
                <div className="p-3 mb-2">
                    <button onClick={handleNewChat} className="w-full flex items-center gap-3 bg-white hover:bg-gray-200 dark:bg-[#212121] dark:hover:bg-[#2f2f2f] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 transition-colors text-sm font-normal text-left shadow-sm">
                        <Plus size={16} /> <span className="flex-1">New chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessions.map(session => (
                        <button
                            key={session._id}
                            onClick={() => setSessionId(session._id)}
                            className={`w-full text-left p-3 rounded-lg text-sm flex items-center justify-between group relative ${sessionId === session._id
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="truncate flex-1 pr-8">{session.title}</span>

                            {/* Dropdown Trigger */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownId(activeDropdownId === session._id ? null : session._id);
                                }}
                                className={`absolute right-2 p-1 rounded-md hover:bg-white/10 transition-colors ${activeDropdownId === session._id ? 'opacity-100 bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
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
                                        className="absolute right-0 top-10 w-32 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden py-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div
                                            onClick={(e) => handleRenameInit(e, session._id, session.title)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                                        >
                                            <Edit size={12} /> Rename
                                        </div>
                                        <div
                                            onClick={(e) => handleDelete(e, session._id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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
            <div className="flex-1 flex flex-col relative bg-white dark:bg-[#212121]">
                {/* Header */}
                <div className="h-14 flex items-center px-4 justify-between bg-white dark:bg-[#212121] z-10 sticky top-0">
                    <div className="flex items-center gap-2">
                        {!sidebarOpen && (
                            <>
                                <button onClick={handleExit} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg text-gray-500" title="Back to Dashboard">
                                    <ArrowLeft size={20} />
                                </button>
                                <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg text-gray-500">
                                    <Menu size={20} />
                                </button>
                            </>
                        )}
                        {sidebarOpen && (
                            <button onClick={handleExit} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg text-gray-500" title="Back to Dashboard">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <span className="font-medium text-gray-700 dark:text-gray-200 ml-2">
                            Learning OS
                        </span>
                    </div>

                    <button onClick={handleExit} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg text-gray-500 transition-colors" title="Exit Chat">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {!currentSession || currentSession.messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <Bot size={32} className="text-gray-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">How can I help you today?</h2>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6 pb-12">
                            {currentSession.messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 mt-1">
                                            <Bot size={18} className="text-white" />
                                        </div>
                                    )}
                                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-gray-100 dark:bg-white/10 rounded-2xl rounded-tr-sm px-4 py-3' : ''}`}>
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-100 leading-7">
                                            {!msg.content && isLoading && msg.role === 'assistant' ? (
                                                <div className="flex items-center gap-1 h-6">
                                                    <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full animate-pulse"></div>
                                                </div>
                                            ) : (
                                                <ReactMarkdown
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    customStyle={{ margin: '1em 0', borderRadius: '0.5em', background: '#1e1e1e' }}
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className={`${className} bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-sm`} {...props}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {msg.content + (msg.role === 'assistant' && isLoading && idx === currentSession.messages.length - 1 ? ' ▍' : '')}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 bg-gradient-to-t from-white via-white to-transparent dark:from-[#212121] dark:via-[#212121] dark:to-transparent">
                    <div className="max-w-3xl mx-auto relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Message AI Assistant..."
                            rows={1}
                            className="w-full bg-[#f4f4f4] dark:bg-[#2f2f2f] rounded-2xl py-3.5 pl-4 pr-12 resize-none border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-h-[52px] max-h-[200px]"
                        />
                        <button
                            onClick={isLoading ? handleStop : handleSend}
                            disabled={!isLoading && !input.trim()}
                            className={`absolute bottom-2.5 right-2.5 p-2 rounded-full transition-all ${isLoading
                                ? 'bg-black dark:bg-white text-white dark:text-black animate-pulse'
                                : input.trim() ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-transparent text-gray-400'
                                }`}
                        >
                            {isLoading ? <Square size={16} fill="currentColor" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-2">
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
                            className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-white/10"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="text-yellow-600 dark:text-yellow-500" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Exit Chat?
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    Are you sure you want to leave? Your current session is saved, but you'll exit this interface.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmExit}
                                        className="flex-1 px-4 py-2.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-opacity"
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
                            className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-white/10"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                    <Trash2 className="text-red-600 dark:text-red-500" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Delete Chat?
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    This will permanently delete this conversation. This action cannot be undone.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
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
                            className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-white/10"
                        >
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Rename Chat
                            </h3>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white/20 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white outline-none mb-6"
                                placeholder="Chat title"
                                autoFocus
                            />
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowRenameModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRename}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-opacity"
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
