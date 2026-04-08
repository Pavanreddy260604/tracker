import { useState, useRef, useEffect, memo } from 'react';
import { Plus, X, Mic, Check, ArrowUp, Square, FileText, Image as ImageIcon, Wrench, Gauge, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useAI, type AIModelOption } from '../../../contexts/AIContext';
import { getProviderIcon } from '../ChatUtils';
import { isDocFile, isTextLikeFile } from '../../../lib/chatUtils';

interface ChatInputProps {
    isLoading: boolean;
    handleSend: (content: string, attachments: any[]) => void;
    handleStop: () => void;
    initialValue?: string;
    speech: any;
}

export const ChatInput = memo(({
    isLoading,
    handleSend,
    handleStop,
    initialValue = "",
    speech
}: ChatInputProps) => {
    const [localInput, setLocalInput] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        error: speechError
    } = speech;

    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { selectedModel, setSelectedModel, AI_MODELS, indexAttachment, ensureChatConversation } = useAI();
    const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
    const isIndexing = attachments.some((att: any) => att.status === 'indexing' || att.status === 'pending');
    const supportsImages = currentModel?.supportsImages ?? false;

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

    // Sync transcript to local input
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

    // Sync external initial value
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles = Array.from(files).map(file => {
            const isImage = file.type.startsWith('image/');
            const isDoc = isDocFile(file);
            const isText = isTextLikeFile(file);
            const shouldIndex = !isImage && (isDoc || isText);
            const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            if (isImage && !supportsImages) return null;
            if (!isImage && !isDoc && !isText) return null;

            return {
                localId,
                file,
                name: file.name,
                type: file.type,
                isImage,
                isBinary: isDoc,
                isText,
                shouldIndex,
                status: shouldIndex ? 'pending' : 'completed',
                preview: isImage ? URL.createObjectURL(file) : null
            };
        }).filter(Boolean) as any[];

        setAttachments(prev => [...prev, ...newFiles]);

        // Start uploads immediately
        for (const att of newFiles) {
            if (att.isImage || att.isText) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setAttachments(prev => prev.map(a =>
                        a.localId === att.localId
                            ? { ...a, content: event.target?.result as string }
                            : a
                    ));
                };
                if (att.isImage) reader.readAsDataURL(att.file);
                else reader.readAsText(att.file);
            }

            if (att.shouldIndex) {
                try {
                    const activeConvId = await ensureChatConversation();
                    await indexAttachment(activeConvId, att, (patch) => {
                        setAttachments(prev => prev.map(a =>
                            a.localId === att.localId ? { ...a, ...patch } : a
                        ));
                    });
                } catch (err) {
                    console.error('Immediate indexing failed', err);
                }
            }
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const renderCapabilityBadge = (model: AIModelOption) => {
        const speedTone = model.speedTier === 'fast'
            ? 'text-status-ok'
            : model.speedTier === 'deep'
                ? 'text-status-warning'
                : 'text-accent-primary';

        return (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className={cn("inline-flex items-center gap-1 rounded-full border border-border-subtle/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", speedTone)}>
                    <Gauge size={9} />
                    {model.speedTier}
                </span>
                {model.supportsFiles && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                        <FileText size={9} />
                        Files
                    </span>
                )}
                {model.supportsImages && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                        <ImageIcon size={9} />
                        Vision
                    </span>
                )}
                {model.supportsTools && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                        <Wrench size={9} />
                        Tools
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="chat-input-wrap px-4 pb-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            <div className="flex flex-col max-w-3xl mx-auto gap-2">
                <div className="chat-input-container w-full flex flex-row items-center gap-3">
                    <div className="relative shrink-0 hidden" ref={menuRef}>
                        <button
                            onClick={() => setShowModelMenu(!showModelMenu)}
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
                                    className="absolute bottom-full left-0 mb-3 w-[260px] max-w-[calc(100vw-32px)] rounded-2xl border border-border-subtle/50 bg-console-header/95 backdrop-blur-xl shadow-2xl p-2 z-[100]"
                                >
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {Array.from(new Set(AI_MODELS.map((m) => m.provider))).map((provider) => {
                                            const providerModels = AI_MODELS.filter((m) => m.provider === provider);
                                            return (
                                                <div key={provider} className="mb-2 last:mb-0">
                                                    <div className="px-2 py-1 flex items-center gap-2 border-b border-border-subtle/30 mb-1">
                                                        {getProviderIcon(provider, 12)}
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-disabled opacity-40">
                                                            {provider}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {providerModels.map((model) => (
                                                            <button
                                                                key={model.id}
                                                                onClick={() => {
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
                                                                        </span>
                                                                        <span className="text-[8px] opacity-50 truncate w-full text-left">
                                                                            {model.category}
                                                                        </span>
                                                                        {renderCapabilityBadge(model)}
                                                                    </div>
                                                                {selectedModel === model.id && <Check size={12} className="shrink-0" />}
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
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 py-1.5 border-b border-border-subtle/30 mb-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                {attachments.map((file, i) => (
                                    <div key={file.localId || i} className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] transition-all duration-300 group/chip relative overflow-hidden",
                                        file.status === 'indexing' || file.status === 'pending'
                                            ? "bg-accent-primary/5 border-accent-primary/20 text-accent-primary"
                                            : file.status === 'failed'
                                                ? "bg-status-error/5 border-status-error/20 text-status-error"
                                                : "bg-console-bg/50 border-border-subtle/30 text-text-secondary"
                                    )}>
                                        {/* Premium Scanning Effect */}
                                        {(file.status === 'indexing' || file.status === 'pending') && (
                                            <motion.div
                                                initial={{ x: '-100%' }}
                                                animate={{ x: '100%' }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary/10 to-transparent pointer-events-none"
                                            />
                                        )}

                                        <div className="shrink-0">
                                            {file.status === 'indexing' || file.status === 'pending' ? (
                                                <div className="w-3 h-3 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                                            ) : file.status === 'completed' ? (
                                                <Check size={12} className="text-status-ok" />
                                            ) : file.status === 'failed' ? (
                                                <AlertTriangle size={12} />
                                            ) : (
                                                <FileText size={12} />
                                            )}
                                        </div>

                                        <span className="truncate max-w-[120px] font-medium z-10">{file.name}</span>
                                        
                                        {(file.status === 'indexing' || file.status === 'pending') && (
                                            <span className="text-[9px] opacity-70 italic animate-pulse">Indexing...</span>
                                        )}

                                        <button onClick={() => removeAttachment(i)} className="p-0.5 rounded-md hover:bg-status-error/10 hover:text-status-error transition-colors z-10">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isIndexing && <div className="text-[10px] text-text-secondary px-1 mb-1">Indexing attachments...</div>}

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
                            disabled={isLoading || isIndexing}
                            className={cn(
                                "chat-input w-full resize-none outline-none py-2 bg-transparent transition-all",
                                isListening && "placeholder:text-accent-primary animate-pulse"
                            )}
                        />
                        {speechError && <div className="mt-1 px-1 text-[10px] text-status-error">{speechError}</div>}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end mb-1">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            className="hidden"
                            accept={`${supportsImages ? 'image/*,' : ''}.pdf,.doc,.docx,.txt,.md,.markdown,.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.htm,.json,.yml,.yaml,.toml,.csv,.xml,.sql,.sh,.bash,.zsh,.ps1,.bat,.cmd,.java,.kt,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.lua,.xlsx,.xls`}
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="chat-input-icon hover:bg-console-surface-3/50 shrink-0"><Plus size={18} /></button>
                        <button onClick={toggleRecording} className={cn("chat-input-icon shrink-0 transition-colors", isListening ? "text-accent-primary bg-accent-primary/10" : "hover:bg-console-surface-3")}><Mic size={18} /></button>
                        
                        {isLoading ? (
                            <button onClick={handleStop} className="w-9 h-9 flex items-center justify-center rounded-xl bg-status-error/10 text-status-error hover:bg-status-error/20 transition-all"><Square size={16} fill="currentColor" /></button>
                        ) : (
                            <button onClick={onSendClick} disabled={(!localInput.trim() && attachments.length === 0) || isIndexing} className={cn("w-9 h-9 flex items-center justify-center rounded-xl transition-all", (!localInput.trim() && attachments.length === 0) || isIndexing ? "bg-console-surface-3 text-text-disabled cursor-not-allowed" : "bg-accent-primary text-console-bg hover:opacity-90 shadow-lg shadow-accent-primary/20")}><ArrowUp size={20} strokeWidth={2.5} /></button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
