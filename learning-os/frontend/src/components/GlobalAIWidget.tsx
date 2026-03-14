import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { MessageSquare, Send, Sparkles, Bot, X, Check, ArrowDown, Plus, Mic, ChevronDown, Volume2, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
import { useSpeech } from '../hooks/useSpeech';
import { cn } from '../lib/utils';
import { AIChatMarkdown, getProviderIcon } from './chat/AIChatRenderer';
import { VoiceOverlay } from './chat/VoiceOverlay';

// Local renderer removed in favor of AIChatMarkdown

const AIChatInput = memo(({
    isLoading,
    handleSend,
    speech
}: {
    isLoading: boolean,
    handleSend: (content: string, attachments: any[]) => void,
    speech: any
}) => {
    const [localInput, setLocalInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        volume, 
        isSpeaking,
        error 
    } = speech;
    const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);

    const { selectedModel, setSelectedModel, AI_MODELS } = useAI() as any;
    const currentModel = AI_MODELS.find((m: any) => m.id === selectedModel);
    const supportsFiles = currentModel?.supportsFiles ?? false;

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowModelMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync transcript
    useEffect(() => {
        if (transcript) setLocalInput(transcript);
    }, [transcript]);

    const toggleRecording = () => {
        if (isListening) {
            stopListening();
            setShowVoiceOverlay(false);
        } else {
            setShowVoiceOverlay(true);
            startListening();
        }
    };

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
        if ((!localInput.trim() && attachments.length === 0) || isLoading) return;
        handleSend(localInput.trim(), attachments);
        setLocalInput('');
        setAttachments([]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isDoc = file.type === 'application/pdf' || 
                         file.type === 'application/msword' || 
                         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            const isBinary = isImage || isVideo || isDoc;

            const reader = new FileReader();
            reader.onload = (ev) => {
                setAttachments(prev => [...prev, {
                    name: file.name,
                    type: file.type,
                    content: ev.target?.result as string,
                    isImage,
                    isBinary
                }]);
            };
            
            if (isBinary) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="ai-widget-input-wrap shrink-0 z-10 w-full px-4 pb-4 pt-2">
            <div className="flex flex-col gap-2">
                {/* Categorized Model Selector */}
                <div className="relative flex justify-center mb-1" ref={menuRef}>
                    <button
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setShowModelMenu(!showModelMenu);
                        }}
                        className={cn(
                            "group flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300",
                            showModelMenu && "border-accent-primary/40 bg-accent-primary/5"
                        )}
                    >
                        <div className="flex items-center gap-1.5 min-w-0">
                            {getProviderIcon(currentModel?.provider)}
                            <span className="text-[10px] font-bold text-text-primary truncate max-w-[100px]">
                                {currentModel?.name}
                            </span>
                        </div>
                        <ChevronDown size={10} className={cn("text-text-disabled transition-transform", showModelMenu && "rotate-180 text-accent-primary")} />
                    </button>

                    <AnimatePresence>
                        {showModelMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] rounded-xl border border-white/10 bg-console-header/95 backdrop-blur-xl shadow-2xl p-1.5 z-50 overflow-hidden"
                            >
                                <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                                    {Array.from(new Set(AI_MODELS.map((m: any) => m.provider))).map((provider: any) => {
                                        const providerModels = AI_MODELS.filter((m: any) => m.provider === provider);
                                        if (providerModels.length === 0) return null;
                                        
                                        return (
                                            <div key={provider} className="mb-2 last:mb-0">
                                                <div className="px-2 py-1 flex items-center gap-1.5 border-b border-white/5 mb-1">
                                                    {getProviderIcon(provider)}
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled opacity-40">
                                                        {provider}
                                                    </span>
                                                </div>
                                                <div className="space-y-0.5">
                                                    {providerModels.map((model: any) => (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => {
                                                                setSelectedModel(model.id);
                                                                setShowModelMenu(false);
                                                            }}
                                                            className={cn(
                                                                "w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-all duration-150",
                                                                selectedModel === model.id 
                                                                    ? "bg-accent-primary/10 text-accent-primary" 
                                                                    : "hover:bg-white/5 text-text-secondary hover:text-text-primary"
                                                            )}
                                                        >
                                                            <div className="flex flex-col items-start min-w-0">
                                                                <span className="text-[10px] font-semibold truncate w-full">
                                                                    {model.name}
                                                                </span>
                                                                <span className="text-[8px] opacity-50 truncate w-full text-left">
                                                                    {model.category}
                                                                </span>
                                                            </div>
                                                            {selectedModel === model.id && (
                                                                <Check size={10} className="shrink-0" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <form
                    onSubmit={onSendClick}
                    className="chat-input-container w-full flex flex-row items-center gap-2"
                >
                    <div className="flex-1 flex flex-col min-w-0 min-h-[44px] justify-center bg-white/5 dark:bg-black/20 rounded-xl px-3 border border-white/10 focus-within:border-accent-primary/50 transition-colors">
                        {/* Integrated Attachment Chips */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 py-1.5 border-b border-white/5 mb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[9px] text-text-secondary">
                                        <span className="truncate max-w-[100px]">{file.name}</span>
                                        <button onClick={() => removeAttachment(i)} className="hover:text-red-500">
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <AnimatePresence>
                                {supportsFiles && (
                                    <motion.button 
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        type="button" 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="chat-input-icon hover:bg-black/10 dark:hover:bg-white/10 shrink-0" 
                                        aria-label="Add attachment"
                                    >
                                        <Plus size={18} className="opacity-80" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                multiple 
                                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md,.js,.ts,.tsx,.py,.css,.html,.json"
                                onChange={handleFileSelect}
                            />

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
                                placeholder={isListening ? "Listening..." : "Ask anything..."}
                                disabled={isLoading}
                                rows={1}
                                className={cn(
                                    "chat-input flex-1 outline-none py-2 bg-transparent text-[13px] resize-none scrollbar-hide max-h-32",
                                    isListening && "animate-pulse placeholder:text-accent-primary"
                                )}
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button 
                            type="button" 
                            onClick={toggleRecording}
                            className={cn(
                                "chat-input-icon hover:bg-black/10 dark:hover:bg-white/10 flex",
                                isListening && "text-accent-primary"
                            )} 
                            aria-label="Voice"
                        >
                            <Mic size={18} className={cn("opacity-80", isListening && "animate-pulse")} />
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || (!localInput.trim() && attachments.length === 0)}
                            className="chat-send-button hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
                <VoiceOverlay 
                    isOpen={showVoiceOverlay}
                    onClose={() => {
                        setShowVoiceOverlay(false);
                        stopListening();
                    }}
                    transcript={localInput}
                    volume={volume}
                    isSpeaking={isSpeaking}
                    isListening={isListening}
                    error={error}
                />
            </div>
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

    const { isSpeaking, speak, stopSpeaking, volume, isListening, transcript, startListening, stopListening, error } = useSpeech();
    const speech = { isSpeaking, speak, stopSpeaking, volume, isListening, transcript, startListening, stopListening, error };
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

    const handleSpeak = useCallback((text: string, msgId: string) => {
        if (speakingMessageId === msgId) {
            stopSpeaking();
            setSpeakingMessageId(null);
        } else {
            setSpeakingMessageId(msgId);
            speak(text);
        }
    }, [speakingMessageId, speak, stopSpeaking]);

    // Handle speech end naturally
    useEffect(() => {
        if (!isSpeaking) setSpeakingMessageId(null);
    }, [isSpeaking]);

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

    const handleSend = useCallback(async (content: string, attachments: any[] = []) => {
        if ((!content.trim() && attachments.length === 0) || isLoading) return;
        setShouldAutoScroll(true);
        await sendMessage(content.trim(), attachments, () => {
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
                                                    <div className="ai-widget-name flex items-center justify-between select-none mb-1">
                                                        <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                                                        
                                                        {msg.role === 'assistant' && msg.content && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSpeak(msg.content, msg.id || '');
                                                                }}
                                                                className={cn(
                                                                    "p-1 rounded-md hover:bg-white/10 transition-colors",
                                                                    speakingMessageId === msg.id ? "text-accent-primary" : "text-text-tertiary opacity-40 hover:opacity-100"
                                                                )}
                                                                title={speakingMessageId === msg.id ? "Stop speaking" : "Speak message"}
                                                            >
                                                                {speakingMessageId === msg.id ? <StopCircle size={12} /> : <Volume2 size={12} />}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Attachments Display */}
                                                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                                            {msg.attachments.map((file: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-text-tertiary">
                                                                    <span className="truncate max-w-[100px]">{file.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className={`ai-widget-text prose prose-sm dark:prose-invert max-w-none ${isLoading && msg.role === 'assistant' && !msg.content ? 'animate-pulse' : ''}`}>
                                                        {msg.role === 'assistant' && !msg.content ? (
                                                            <div className="flex items-center gap-1.5 h-6 px-1">
                                                                <motion.div 
                                                                    animate={{ 
                                                                        scale: [1, 1.2, 1],
                                                                        opacity: [0.4, 1, 0.4],
                                                                    }}
                                                                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                                                                    className="w-1.5 h-1.5 bg-accent-primary rounded-full shadow-[0_0_6px_rgba(var(--accent-primary-rgb),0.5)]"
                                                                />
                                                                <motion.div 
                                                                    animate={{ 
                                                                        scale: [1, 1.2, 1],
                                                                        opacity: [0.4, 1, 0.4],
                                                                    }}
                                                                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                                                                    className="w-1.5 h-1.5 bg-accent-primary/80 rounded-full shadow-[0_0_6px_rgba(var(--accent-primary-rgb),0.4)]"
                                                                />
                                                                <motion.div 
                                                                    animate={{ 
                                                                        scale: [1, 1.2, 1],
                                                                        opacity: [0.4, 1, 0.4],
                                                                    }}
                                                                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.4 }}
                                                                    className="w-1.5 h-1.5 bg-accent-primary/60 rounded-full shadow-[0_0_6px_rgba(var(--accent-primary-rgb),0.3)]"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <AIChatMarkdown content={msg.content} isLoading={isLoading} isLast={msg.id === messages[messages.length-1].id} />
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
                            speech={speech}
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
