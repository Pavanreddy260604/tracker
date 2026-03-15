
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// ============================================
// AI MODELS CONFIGURATION (Ollama + Groq)
// ============================================
// AI MODELS CONFIGURATION
// Categorized by Provider/Capability
// ============================================
export const AI_MODELS = [
    // Groq Direct (Cloud)
    { id: 'groq:llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', category: 'Cloud', description: 'Ultra-fast cloud inference', supportsFiles: true },
    { id: 'groq:llama-3.2-11b-vision-preview', name: 'Llama 3.2 Vision', provider: 'Groq', category: 'Cloud', description: 'Instant image recognition', supportsFiles: true },
    
    // Cloud Proxy (Ollama-Cloud)
    { id: 'deepseek-v3.1:671b-cloud', name: 'DeepSeek V3.1', provider: 'Ollama-Cloud', category: 'Cloud Proxy', description: 'Cloud-proxied reasoning', supportsFiles: true },
    { id: 'gpt-oss:120b-cloud', name: 'GPT OSS 120B', provider: 'Ollama-Cloud', category: 'Cloud Proxy', description: 'Cloud-proxied high capacity', supportsFiles: true },
    { id: 'qwen3-coder:480b-cloud', name: 'Qwen3 Coder', provider: 'Ollama-Cloud', category: 'Cloud Proxy', description: 'Cloud-proxied coding', supportsFiles: true },
    { id: 'glm-4.6:cloud', name: 'GLM 4.6', provider: 'Ollama-Cloud', category: 'Cloud Proxy', description: 'Cloud-proxied balanced', supportsFiles: true },
    { id: 'qwen3-vl:235b-cloud', name: 'Qwen3 VL', provider: 'Ollama-Cloud', category: 'Cloud Proxy', description: 'Cloud-proxied multimodal', supportsFiles: true },
    
    // Local (GPU)
    { id: 'gemma3:4b', name: 'Gemma 3 4B', provider: 'Local', category: 'Local (GPU)', description: 'Lightweight local model', supportsFiles: false },
    { id: 'tinyllama:latest', name: 'TinyLlama', provider: 'Local', category: 'Local (GPU)', description: 'Minimal footprint', supportsFiles: false },
    { id: 'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest', name: 'Llama 3.2 1B', provider: 'Local', category: 'Local (GPU)', description: 'Optimized local model', supportsFiles: false },
];

export interface Attachment {
    localId?: string;
    name: string;
    content?: string;
    type: string;
    file?: File;
    attachmentId?: string;
    status?: 'pending' | 'indexing' | 'completed' | 'failed';
    isImage?: boolean;
    isBinary?: boolean;
    isText?: boolean;
    shouldIndex?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: Attachment[];
    status?: 'pending' | 'indexing' | 'completed' | 'failed';
    loadingLabel?: 'thinking' | 'knowledge';
    resourceSummary?: string[];
}

interface AIContextType {
    isOpen: boolean;
    toggleOpen: () => void;
    sessionId: string | null;
    setSessionId: (id: string | null) => void;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    sendMessage: (content: string, attachments?: Attachment[], onChunk?: (chunk: string) => void) => Promise<void>;
    clearMessages: () => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    AI_MODELS: typeof AI_MODELS;
    context: any;
    setContext: (data: any) => void;
    ensureChatSession: () => Promise<string>;
    uploadAttachment: (file: File) => Promise<string | null>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hi! I'm your deeper learning assistant. I have context on what you're working on. How can I help?",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('learning-os-ai-model') || 'deepseek-v3.1:671b-cloud';
        }
        return 'deepseek-v3.1:671b-cloud';
    });
    const lastSyncedModelRef = useRef<string | null>(null);
    const [context, setContext] = useState<any>({});
    const sessionInitPromiseRef = useRef<Promise<string> | null>(null);
    const messagesRef = useRef<Message[]>([]);

    // Persist model selection
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('learning-os-ai-model', selectedModel);
        }
    }, [selectedModel]);

    // Sync model selection to active chat session metadata
    useEffect(() => {
        if (!sessionId) {
            lastSyncedModelRef.current = null;
            return;
        }
        if (!selectedModel || selectedModel === lastSyncedModelRef.current) return;

        api.updateChatSession(sessionId, { model: selectedModel })
            .then(() => {
                lastSyncedModelRef.current = selectedModel;
            })
            .catch(() => {
                // Non-blocking: keep UI responsive even if the update fails
            });
    }, [sessionId, selectedModel]);

    // System Awareness State
    const [systemContext, setSystemContext] = useState('');
    const { token } = useAuthStore();

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const isSpecificChatQuery = useCallback((value: string) => {
        const text = value.trim().toLowerCase();
        if (!text) return false;

        const genericGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|test|ping|yo|sup)\b/;
        if (genericGreeting.test(text)) return false;

        const resourceHints = /\b(file|files|document|doc|pdf|attachment|attachments|upload|uploaded|notes|notebook|kb|knowledge base|source|sources|cite|citation|context|from my|in my|from the doc|from the file|in the file|in the doc|in the pdf)\b/;
        const taskHints = /\b(summarize|summary|explain|extract|find|search|compare|analyze|list|quote|show|give me|based on|according to|what does it say)\b/;

        if (resourceHints.test(text) || taskHints.test(text)) return true;
        if (text.length >= 80) return true;
        if (text.includes('?') && text.length >= 20) return true;

        return false;
    }, []);

    const isResourceAttachment = useCallback((att: Attachment) => {
        return Boolean(att.shouldIndex || att.isText || (!att.isImage && !att.isBinary));
    }, []);

    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    // Update welcome message based on context when opening
    useEffect(() => {
        if (isOpen && messages.length <= 1) {
            const path = window.location.pathname;
            let contextMsg = "Hi! I'm your deeper learning assistant. I have context on what you're working on. How can I help?";

            if (path.includes('script-writer')) {
                contextMsg = "I see you're in the Script Writer. Need help developing a scene or character?";
            } else if (path.includes('dsa')) {
                contextMsg = "Ready to solve some DSA problems? I can help you optimize your code.";
            } else if (path.includes('interview')) {
                contextMsg = "Preparing for an interview? Let's practice some mock questions.";
            } else if (path.includes('backend')) {
                contextMsg = "Working on backend architecture? I can help with system design.";
            }

            setMessages(prev => {
                // Only update if it's the initial welcome message
                if (prev.length === 0 || (prev.length === 1 && prev[0].id === 'welcome')) {
                    return [{
                        id: 'welcome',
                        role: 'assistant',
                        content: contextMsg,
                        timestamp: new Date()
                    }];
                }
                return prev;
            });
        }
    }, [isOpen]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setSessionId(null);
    }, []);

    const ensureChatSession = useCallback(async () => {
        if (sessionId) return sessionId;
        if (sessionInitPromiseRef.current) return sessionInitPromiseRef.current;

        const createPromise = (async () => {
            const newSession = await api.createChatSession(undefined, selectedModel);
            setSessionId(newSession._id);
            lastSyncedModelRef.current = selectedModel;
            return newSession._id;
        })();

        sessionInitPromiseRef.current = createPromise;
        try {
            return await createPromise;
        } finally {
            sessionInitPromiseRef.current = null;
        }
    }, [sessionId, selectedModel]);

    const uploadAttachment = useCallback(async (file: File): Promise<string | null> => {
        try {
            const activeId = await ensureChatSession();
            const formData = new FormData();
            formData.append('file', file, file.name);
            const uploadRes = await api.post(`/chat/${activeId}/attachments`, formData);
            if (uploadRes?.success && uploadRes?.data?.attachmentId) {
                return uploadRes.data.attachmentId as string;
            }
            return null;
        } catch (error) {
            console.error('[AIContext] Attachment upload failed:', error);
            return null;
        }
    }, [ensureChatSession]);

    const _sendMessage = useCallback(async (displayContent: string, attachments: Attachment[] = [], hiddenPayload: string, onChunk?: (chunk: string) => void) => {
        if (!displayContent.trim() && attachments.length === 0 || isLoading) return;

        const priorResources = messagesRef.current
            .flatMap((msg) => msg.attachments || [])
            .filter(isResourceAttachment)
            .map((att) => att.name);
        const currentResources = attachments
            .filter(isResourceAttachment)
            .map((att) => att.name);
        const resourceSummary = Array.from(new Set([...priorResources, ...currentResources]));
        const isSpecific = isSpecificChatQuery(displayContent);
        const loadingLabel: Message['loadingLabel'] = resourceSummary.length > 0 && isSpecific
            ? 'knowledge'
            : 'thinking';

        setIsLoading(true);

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: displayContent.trim(),
            timestamp: new Date(),
            attachments: attachments.length > 0 ? attachments : undefined,
            status: attachments.some(a => a.shouldIndex && !a.isImage && !a.attachmentId) ? 'indexing' : undefined
        };
        setMessages(prev => [...prev, userMsg]);

        const botMsgId = (Date.now() + 1).toString();
        // Create placeholder
        setMessages(prev => [...prev, {
            id: botMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            loadingLabel,
            resourceSummary: resourceSummary.slice(0, 6)
        }]);

        try {
            let activeId = sessionId;
            if (!activeId) {
                // Ensure model is set when creating session
                const newSession = await api.createChatSession(undefined, selectedModel);
                setSessionId(newSession._id);
                activeId = newSession._id;
                lastSyncedModelRef.current = selectedModel; // Avoid double sync on new session
            }

            let botContent = '';
            let apiPayload = hiddenPayload ? `${hiddenPayload}\n${displayContent}` : displayContent;
            const images: string[] = [];

            // Handle RAG Indexing for non-image files (docs + text/code)
            const collectedAttachmentIds: string[] = attachments
                .filter(a => a.attachmentId)
                .map(a => a.attachmentId as string);
            const indexedAttachmentNames: string[] = attachments
                .filter(a => a.attachmentId)
                .map(a => a.name);
            const indexableAttachments = attachments.filter(a => a.shouldIndex && !a.isImage && !a.attachmentId);
            const failedTextAttachments: Attachment[] = [];
            
            if (indexableAttachments.length > 0) {
                // We need to upload them to the backend for indexing
                for (const att of indexableAttachments) {
                    try {
                        const uploadRes = att.file
                            ? await (async () => {
                                const formData = new FormData();
                                formData.append('file', att.file as File, att.name);
                                return api.post(`/chat/${activeId}/attachments`, formData);
                            })()
                            : await (async () => {
                                if (!att.content) throw new Error('Missing attachment content');
                                let blob: Blob;
                                if (att.content.startsWith('data:')) {
                                    // Extract binary from dataURL
                                    const res = await fetch(att.content);
                                    blob = await res.blob();
                                } else {
                                    blob = new Blob([att.content], { type: att.type || 'text/plain' });
                                }
                                const formData = new FormData();
                                formData.append('file', blob, att.name);
                                return api.post(`/chat/${activeId}/attachments`, formData);
                            })();
                        if (uploadRes.success && uploadRes.data?.attachmentId) {
                            collectedAttachmentIds.push(uploadRes.data.attachmentId);
                            indexedAttachmentNames.push(att.name);
                        } else if (att.isText) {
                            failedTextAttachments.push(att);
                        }
                    } catch (uploadError) {
                        console.error(`[AIContext] Failed to upload ${att.name}:`, uploadError);
                        if (att.isText) failedTextAttachments.push(att);
                    }
                }
            }

            // Separate text attachments from image attachments
            if (attachments.length > 0) {
                const textAttachments = attachments.filter(a => a.isText && !a.isImage);
                const imageAttachments = attachments.filter(a => a.isImage);
                
                const fallbackTextAttachments = textAttachments
                    .filter(a => !a.shouldIndex || (!a.attachmentId && !indexedAttachmentNames.includes(a.name)))
                    .concat(failedTextAttachments);
                const indexedNotice = indexedAttachmentNames.length > 0
                    ? `ATTACHED FILES INDEXED FOR RETRIEVAL:\n- ${indexedAttachmentNames.join('\n- ')}\n\n`
                    : '';

                if (fallbackTextAttachments.length > 0) {
                    const fileContext = fallbackTextAttachments.map(a => {
                        const rawContent = typeof a.content === 'string' ? a.content : '';
                        const safeContent = rawContent.length > 6000 ? `${rawContent.slice(0, 6000)}...` : rawContent;
                        return `[File Attachment: ${a.name}]\n${safeContent}`;
                    }).join('\n\n');
                    apiPayload = `${indexedNotice}CONTEXT FROM ATTACHED FILES (upload skipped or failed):\n${fileContext}\n\nUSER MESSAGE: ${apiPayload}`;
                } else if (indexedNotice) {
                    apiPayload = `${indexedNotice}USER MESSAGE: ${apiPayload}`;
                }

                imageAttachments.forEach(a => {
                    const base64 = typeof a.content === 'string' ? a.content.split(',')[1] : '';
                    if (base64) images.push(base64);
                });
            }

            let lastUpdate = Date.now();
            let pendingChunk = '';

            await api.sendChatMessage(activeId!, apiPayload, (chunk) => {
                botContent += chunk;
                pendingChunk += chunk;

                const now = Date.now();
                if (now - lastUpdate > 32) {
                    lastUpdate = now;
                    const throttledContent = botContent;
                    setMessages(prev => prev.map(msg =>
                        msg.id === botMsgId
                            ? { ...msg, content: throttledContent }
                            : msg
                    ));
                    onChunk?.(pendingChunk);
                    pendingChunk = '';
                }
            }, undefined, 'learning-os', undefined, images, collectedAttachmentIds);

            // Final update
            if (pendingChunk) {
                setMessages(prev => prev.map(msg =>
                    msg.id === botMsgId
                        ? { ...msg, content: botContent }
                        : msg
                ));
                onChunk?.(pendingChunk);
            }

        } catch (error) {
            console.error('[AIContext] Chat failed:', error);
            setMessages(prev => prev.map(msg =>
                msg.id === botMsgId
                    ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
                    : msg
            ));
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, isLoading, selectedModel, isSpecificChatQuery, isResourceAttachment]);

    // Fetch activity history when widget opens
    useEffect(() => {
        if (isOpen && token) {
            api.getActivityHistory(10)
                .then(activities => {
                    // Limit to last 5 activities to keep context lean and fast
                    const topActivities = activities.slice(0, 5);
                    const formattedDetails = topActivities.map(a =>
                        `- [${new Date(a.timestamp || Date.now()).toLocaleTimeString()}] ${a.description} (${a.type})`
                    ).join('\n');

                    if (formattedDetails) {
                        setSystemContext(`USER ACTIVITY CONTEXT:\n${formattedDetails}\n\n`);
                    }
                })
                .catch(err => console.warn('Failed to fetch activity context:', err));
        }
    }, [isOpen, token]);

    // Public wrapper to inject context
    const sendMessage = useCallback(async (content: string, attachments: Attachment[] = [], onChunk?: (chunk: string) => void) => {
        let injectedContext = '';

        if (systemContext && systemContext.trim()) {
            injectedContext += systemContext.trim() + '\n\n';
            setSystemContext(''); // Clear it so we don't send it again next msg
        }

        // Inject real-time UI context if the user has a specific modal or card open
        if (context && Object.keys(context).length > 0) {
            const contextStr = JSON.stringify(context, null, 2);
            // Limit UI context to 4000 chars to avoid overwhelming the payload
            const safeContext = contextStr.length > 4000 ? contextStr.slice(0, 4000) + '...' : contextStr;
            injectedContext += `[Current Data Context: ${safeContext}]\n\n`;
        }

        await _sendMessage(content, attachments, injectedContext, onChunk);
    }, [_sendMessage, systemContext, context]);

    const value: AIContextType = {
        isOpen,
        toggleOpen,
        sessionId,
        setSessionId,
        messages,
        setMessages,
        isLoading,
        setIsLoading,
        sendMessage,
        clearMessages,
        selectedModel,
        setSelectedModel,
        AI_MODELS,
        context,
        setContext,
        ensureChatSession,
        uploadAttachment,
    };

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI() {
    const context = useContext(AIContext);
    if (context === undefined) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
}
