import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ChatSession } from '../services/api';
import { useAI } from '../contexts/AIContext';
import { useSpeech } from '../hooks/useSpeech';
import { 
    Plus, X, ArrowDown, 
    PanelLeftOpen, PanelLeftClose, AlertTriangle, 
    Bot, Check,
    Trash2, Edit, Volume2, StopCircle, ArrowUp, Square, Mic
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useMobile } from '../hooks/useMobile';
import { AIChatMarkdown, getProviderIcon } from '../components/chat/AIChatRenderer';

// Local renderer removed in favor of AIChatMarkdown from shared components

const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss', '.sass',
    '.html', '.htm', '.xml', '.csv', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log', '.env',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r'
]);

const TEXT_MIME_TYPES = new Set([
    'application/json',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/xml',
    'text/xml',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'application/csv',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'application/x-sh',
    'text/x-shellscript',
]);

const isTextLikeFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    const dotIndex = name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
    return type.startsWith('text/') || TEXT_MIME_TYPES.has(type) || (ext && TEXT_EXTENSIONS.has(ext));
};

const isDocFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    return (
        type === 'application/pdf' ||
        type === 'application/msword' ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
};

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
                            className="p-1.5 rounded-lg bg-[color:var(--accent-primary)] text-console-bg hover:opacity-90 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            onClick={onRenameCancel}
                            className="p-1.5 rounded-lg hover:bg-console-surface-3/50 text-[color:var(--text-secondary)] min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : deleteTargetId === session._id ? (
                <div className="flex items-center justify-between flex-1 w-full gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-status-error text-xs font-semibold truncate">Delete this chat?</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={onDeleteConfirm}
                            className="px-3 py-1 rounded-lg bg-status-error/20 text-status-error hover:bg-status-error/30 text-xs font-semibold transition-colors min-h-[30px]"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={onDeleteCancel}
                            className="px-3 py-1 rounded-lg bg-console-surface text-[color:var(--text-secondary)] text-xs font-semibold transition-colors min-h-[30px]"
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
                            className="p-1.5 rounded-lg hover:bg-console-surface-3/50 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                        >
                            <Edit size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => onDeleteInit(e, session._id)}
                            className="p-1.5 rounded-lg hover:bg-status-error/20 text-[color:var(--text-secondary)] hover:text-status-error transition-colors"
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
    copiedBlockId,
    onSpeak,
    isSpeakingThis
}: any) => {
    const loadingLabel = msg.loadingLabel === 'knowledge' ? 'Searching knowledge base...' : 'Thinking...';
    const resourceSummary = Array.isArray(msg.resourceSummary) ? msg.resourceSummary : [];

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
            {/* Attachments (User Only) */}
            {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1 justify-end">
                    {msg.attachments.map((file: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-console-surface-2 border border-border-subtle text-[10px] font-medium text-text-secondary">
                            <span className="truncate max-w-[120px]">{file.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Label & Identity */}
            <div className={cn(
                "flex items-center gap-2 mb-1 px-1",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
                <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-console-bg/50 border border-border-subtle/30" : "chat-avatar"
                )}>
                    {msg.role === 'user' ? (
                        <span className="text-[10px] font-bold">YOU</span>
                    ) : (
                        <Bot size={14} className="text-console-bg" />
                    )}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] opacity-60">
                    {msg.role === 'user' ? "You" : "Assistant"}
                </span>
                
                {msg.role === 'assistant' && msg.content && (
                    <button
                        onClick={() => onSpeak(msg.content)}
                        className={cn(
                            "p-1 rounded-md hover:bg-console-surface-3/50 transition-colors",
                            isSpeakingThis ? "text-accent-primary" : "text-text-tertiary opacity-40 hover:opacity-100"
                        )}
                        title={isSpeakingThis ? "Stop speaking" : "Speak message"}
                    >
                        {isSpeakingThis ? <StopCircle size={14} /> : <Volume2 size={14} />}
                    </button>
                )}
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
                        <div className="flex items-center gap-2 h-8 px-1">
                            <motion.div 
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [0.4, 1, 0.4],
                                    y: [0, -4, 0]
                                }}
                                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                                className="w-2.5 h-2.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.5)]"
                            />
                            <motion.div 
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [0.4, 1, 0.4],
                                    y: [0, -4, 0]
                                }}
                                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                                className="w-2.5 h-2.5 bg-accent-primary/80 rounded-full shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.4)]"
                            />
                            <motion.div 
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [0.4, 1, 0.4],
                                    y: [0, -4, 0]
                                }}
                                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.4 }}
                                className="w-2.5 h-2.5 bg-accent-primary/60 rounded-full shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.3)]"
                            />
                            <div className="ml-2 flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent-primary/50 animate-pulse">
                                    {loadingLabel}
                                </span>
                                {msg.loadingLabel === 'knowledge' && resourceSummary.length > 0 && (
                                    <span className="text-[9px] uppercase tracking-wider text-text-tertiary/70">
                                        Resources: {resourceSummary.join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <AIChatMarkdown
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
    initialValue = "",
    speech
}: {
    isLoading: boolean,
    handleSend: (content: string, attachments: any[]) => void,
    handleStop: () => void,
    initialValue?: string,
    speech: any
}) => {
    const [localInput, setLocalInput] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        isSpeaking, 
        speak, 
        stopSpeaking,
        volume,
        error
    } = speech;

    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { selectedModel, setSelectedModel, AI_MODELS, uploadAttachment } = useAI() as any;
    const currentModel = AI_MODELS.find((m: any) => m.id === selectedModel);
    const supportsImages = currentModel?.supportsFiles ?? false;
    const isIndexing = attachments.some((att: any) => att.status === 'indexing');


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

    const [baseInputBeforeVoice, setBaseInputBeforeVoice] = useState('');

    // Sync transcript to local input (non-destructively)
    useEffect(() => {
        if (isListening && transcript) {
            setLocalInput(baseInputBeforeVoice + transcript);
        }
    }, [transcript, isListening, baseInputBeforeVoice]);

    const toggleRecording = () => {
        if (isListening) {
            stopListening();
        } else {
            setBaseInputBeforeVoice(localInput.trim() ? localInput.trim() + ' ' : '');
            startListening();
        }
    };

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
        if ((!localInput.trim() && attachments.length === 0) || isLoading || isIndexing) return;
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
            const isDoc = isDocFile(file);
            const isText = isTextLikeFile(file);
            const shouldIndex = !isImage && (isDoc || isText);
            const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            if (isImage && !supportsImages) {
                console.warn(`[AI Chat] Skipping image attachment (model does not support images): ${file.name}`);
                return;
            }
            if (isVideo) {
                console.warn(`[AI Chat] Video attachments are not supported yet: ${file.name}`);
                return;
            }
            if (!isImage && !isDoc && !isText) {
                console.warn(`[AI Chat] Unsupported attachment type: ${file.name}`);
                return;
            }

            setAttachments(prev => [...prev, {
                localId,
                name: file.name,
                type: file.type,
                file,
                isImage,
                isBinary: isDoc,
                isText,
                shouldIndex,
                status: shouldIndex ? 'indexing' : 'completed'
            }]);

            if (isImage || isText) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setAttachments(prev => prev.map(att => att.localId === localId
                        ? { ...att, content: ev.target?.result as string }
                        : att
                    ));
                };

                if (isImage) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            }

            if (shouldIndex) {
                uploadAttachment(file).then((attachmentId: string | null) => {
                    setAttachments(prev => prev.map(att => att.localId === localId
                        ? { ...att, attachmentId: attachmentId ?? undefined, status: attachmentId ? 'completed' : 'failed' }
                        : att
                    ));
                });
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="chat-input-wrap px-4 pb-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            <div className="flex flex-col max-w-3xl mx-auto gap-2">
                <div className="chat-input-container w-full flex flex-row items-center gap-3">
                    {/* Categorized Model Selector Moved Inside */}
                    <div className="relative shrink-0" ref={menuRef}>
                        <button
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setShowModelMenu(!showModelMenu);
                            }}
                            className={cn(
                                "group flex items-center justify-center w-9 h-9 rounded-xl border border-border-subtle/40 bg-console-surface-2/40 hover:bg-console-surface-3/60 transition-all duration-300",
                                showModelMenu && "border-accent-primary/50 bg-accent-primary/5 shadow-sm"
                            )}
                            title={currentModel?.name}
                        >
                            {getProviderIcon(currentModel?.provider, 18)}
                        </button>

                        <AnimatePresence>
                            {showModelMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="absolute bottom-full left-0 mb-3 w-[260px] max-w-[calc(100vw-32px)] rounded-2xl border border-border-subtle/50 bg-console-header/95 backdrop-blur-xl shadow-2xl p-2 z-[100]"
                                >
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {Array.from(new Set(AI_MODELS.map((m: any) => m.provider))).map((provider: any) => {
                                            const providerModels = AI_MODELS.filter((m: any) => m.provider === provider);
                                            if (providerModels.length === 0) return null;
                                            
                                            return (
<div key={provider} className="mb-2 last:mb-0">
                                                    <div className="px-2 py-1 flex items-center gap-2 border-b border-border-subtle/30 mb-1">
                                                        {getProviderIcon(provider, 12)}
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-disabled opacity-40">
                                                            {provider}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {providerModels.map((model: any) => (
                                                            <button
                                                                key={model.id}
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedModel(model.id);
                                                                    setShowModelMenu(false);
                                                                }}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between px-2 py-2 rounded-xl transition-all duration-150 group/item",
                                                                    selectedModel === model.id 
                                                                        ? "bg-accent-primary/[0.08] text-accent-primary" 
                                                                        : "hover:bg-console-surface-3/50 text-text-secondary hover:text-text-primary"
                                                                )}
                                                            >
                                                                <div className="flex flex-col items-start min-w-0">
                                                                    <span className="text-[11px] font-semibold truncate w-full flex items-center gap-1.5">
                                                                        {model.name}
                                                                        {model.supportsFiles && (
                                                                            <Plus size={8} className="text-accent-primary opacity-50" />
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[8px] opacity-50 truncate w-full text-left">
                                                                        {model.category}
                                                                    </span>
                                                                </div>
                                                                {selectedModel === model.id && (
                                                                    <Check size={12} className="shrink-0" />
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

                    <div className="flex-1 flex flex-col min-w-0 min-h-[44px] justify-center ml-1">
                        {/* Integrated Attachment Chips */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 py-1.5 border-b border-border-subtle/30 mb-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-console-bg/50 border border-border-subtle/30 text-[10px] text-text-secondary group/chip">
                                        <span className="truncate max-w-[120px]">{file.name}</span>
                                        <button 
                                            onClick={() => removeAttachment(i)}
                                            className="p-0.5 rounded-md hover:bg-status-error/10 hover:text-status-error transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isIndexing && (
                            <div className="text-[10px] text-text-secondary px-1 mb-1">
                                Indexing attachments...
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={localInput}
                            onChange={(e) => setLocalInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!isIndexing) onSendClick();
                                }
                            }}
                            placeholder={isListening ? "Listening..." : "Ask anything"}
                            rows={1}
                            inputMode="text"
                            disabled={isLoading || isIndexing}
                            className={cn(
                                "chat-input w-full resize-none outline-none py-2 bg-transparent transition-all",
                                isListening && "placeholder:text-accent-primary animate-pulse"
                            )}
                        />
                        {error && (
                            <div className="mt-1 px-1 text-[10px] text-status-error">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end mb-1">
                        <AnimatePresence>
                            <motion.button 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="chat-input-icon hover:bg-console-surface-3/50 shrink-0" 
                                aria-label="Add attachment"
                            >
                                <Plus size={22} className="opacity-80" />
                            </motion.button>
                        </AnimatePresence>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            multiple 
                            accept={`${supportsImages ? 'image/*,' : ''}.pdf,.doc,.docx,.txt,.md,.markdown,.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.htm,.json,.yml,.yaml,.toml,.csv,.xml,.sql,.sh,.bash,.zsh,.ps1,.bat,.cmd,.java,.kt,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.lua`}
                            onChange={handleFileSelect}
                        />
                        <button 
                            type="button" 
                            onClick={toggleRecording}
                            className={cn(
                                "chat-input-icon hover:bg-console-surface-3/50 relative overflow-hidden transition-all duration-300",
                                isListening && "bg-accent-primary/20 text-accent-primary scale-110 shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.3)]"
                            )} 
                            aria-label="Voice"
                        >
                            <Mic size={20} className={cn("opacity-80 z-10", isListening && "animate-pulse")} />
                            {isListening && (
                                <>
                                    <motion.div
                                        className="absolute inset-0 bg-accent-primary/30 rounded-full"
                                        animate={{
                                            scale: [1, 1 + (volume / 50)],
                                            opacity: [0.3, 0]
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            repeat: Infinity,
                                            ease: "easeOut"
                                        }}
                                    />
                                    <motion.div
                                        className="absolute inset-0 bg-accent-primary/20 rounded-full"
                                        animate={{
                                            scale: [1, 1.2 + (volume / 40)],
                                            opacity: [0.2, 0]
                                        }}
                                        transition={{
                                            duration: 0.8,
                                            repeat: Infinity,
                                            delay: 0.2,
                                            ease: "easeOut"
                                        }}
                                    />
                                </>
                            )}
                        </button>
                        <button
                            onClick={isLoading ? handleStop : onSendClick}
                            disabled={isIndexing || (!isLoading && !localInput.trim() && attachments.length === 0)}
                            className={cn(
                                "chat-send-button w-[36px] h-[36px]",
                                isLoading ? "loading" : (localInput.trim() || attachments.length > 0) && !isIndexing ? "active" : "disabled"
                            )}
                            aria-label={isLoading ? "Stop generating" : "Send message"}
                        >
                            {isLoading ? <Square size={16} fill="currentColor" /> : <ArrowUp size={20} strokeWidth={2.5} />}
                        </button>
                    </div>
                </div>
            </div>
            <div className="text-center text-[10px] sm:text-xs text-[color:var(--text-disabled)] mt-2 opacity-60">
                AI Assistant can make mistakes. Check important info.
            </div>
        </div>
    );
});

export default function ChatPage() {
    const {
        sessionId,
        setSessionId,
        messages,
        setMessages,
        clearMessages,
        setIsLoading: setGlobalLoading,
        setSelectedModel
    } = useAI();
    const { isMobile, isTablet } = useMobile();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [input, setInput] = useState(''); // Only used for prompt starter seeding
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);

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
    const userInteractionRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();
    const speech = useSpeech();
    const { isSpeaking, speak, stopSpeaking } = speech;
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
    const isInitialSessionCreation = useRef(false);


    const visibleMessages = messages.filter(msg => msg.id !== 'welcome');
    const isChatActive = sessionId || visibleMessages.length > 0;

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

            // If this is the initial creation from handleSend, we don't want to load full history
            // because it will overwrite the local message we just added
            if (isInitialSessionCreation.current) {
                api.getChatSession(sessionId).then(session => {
                    setCurrentSession(session);
                    isInitialSessionCreation.current = false;
                }).catch(err => {
                    console.error("Failed to load session metadata", err);
                    isInitialSessionCreation.current = false;
                });
                return;
            }

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
        setGlobalLoading(true);
        try {
            const session = await api.getChatSession(id);
            setCurrentSession(session);
            // Sync with global context
            const mappedMessages = (session.messages || []).map((m: any, idx: number) => ({
                id: (m as any).id || `hist-${idx}-${Date.now()}`,
                role: m.role === 'system' ? 'assistant' : m.role, // Fallback system to assistant for UI
                content: m.content,
                timestamp: new Date(m.timestamp)
            }));
            setMessages(mappedMessages as any);
            if (session.metadata?.model) {
                setSelectedModel(session.metadata.model);
            }
            
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
            setGlobalLoading(false);
        }
    };

    const handleNewChat = () => {
        clearMessages();
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

    const { sendMessage: contextSendMessage } = useAI();

    const handleSend = useCallback(async (content: string, attachments: any[] = []) => {
        if (!content.trim() && attachments.length === 0 || isLoading) return;

        if (!sessionId) {
            isInitialSessionCreation.current = true;
        }

        const msgContent = content;

        setInput('');
        setShouldAutoScroll(true);
        setIsLoading(true);

        try {
            await contextSendMessage(msgContent, attachments, () => {
                if (shouldAutoScroll) {
                    requestAnimationFrame(() => scrollToBottom('auto'));
                }
            });
            
            if (!sessionId) loadHistory();

        } catch (error: any) {
            console.error('Chat error', error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, isLoading, contextSendMessage, loadHistory, shouldAutoScroll, scrollToBottom]);

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
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99]"
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
                        <span className="chat-pro-badge max-sm:hidden px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] bg-accent-primary/10 border border-accent-primary/20 text-accent-primary shrink-0">
                            Pro
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleNewChat}
                            className="chat-icon-button p-2 rounded-lg transition-colors bg-console-surface hover:bg-console-surface-2 border border-border-subtle max-sm:flex items-center gap-2 max-sm:px-3 max-sm:py-1.5 max-sm:rounded-full max-sm:shrink-0"
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
                    {!isChatActive ? (
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
                            {visibleMessages.map((msg, idx) => (
                                <MessageRow
                                    key={idx}
                                    msg={msg}
                                    idx={idx}
                                    isLoading={isLoading}
                                    isLast={idx === visibleMessages.length - 1}
                                    handleCopyCode={handleCopyCode}
                                    copiedBlockId={copiedBlockId}
                                    onSpeak={(text: string) => handleSpeak(text, msg.id || `${idx}`)}
                                    isSpeakingThis={speakingMessageId === (msg.id || `${idx}`)}
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
                            className="chat-scroll-button shadow-elevation-3"
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
                    speech={speech}
                />
            </div>

            {/* Exit Confirmation Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                                        className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-accent-primary text-console-bg hover:opacity-90 transition-opacity"
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
