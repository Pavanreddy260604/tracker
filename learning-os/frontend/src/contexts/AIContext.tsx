
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// ============================================
// GEMINI MODELS CONFIGURATION
// ============================================
export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & smart (default)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Low cost, high speed' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Legacy stable' },
];

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIContextType {
    isOpen: boolean;
    toggleOpen: () => void;
    sessionId: string | null;
    setSessionId: (id: string | null) => void;
    messages: Message[];
    isLoading: boolean;
    sendMessage: (content: string, onChunk?: (chunk: string) => void) => Promise<void>;
    clearMessages: () => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    context: any;
    setContext: (data: any) => void;
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
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const [context, setContext] = useState<any>({});

    // System Awareness State
    const [systemContext, setSystemContext] = useState('');
    const { token } = useAuthStore();

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

    const _sendMessage = useCallback(async (content: string, onChunk?: (chunk: string) => void) => {
        if (!content.trim() || isLoading) return;

        setIsLoading(true);

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        const botMsgId = (Date.now() + 1).toString();
        // Create placeholder
        setMessages(prev => [...prev, {
            id: botMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        }]);

        try {
            let activeId = sessionId;
            if (!activeId) {
                const newSession = await api.createChatSession();
                setSessionId(newSession._id);
                activeId = newSession._id;
            }

            let botContent = '';
            await api.sendChatMessage(activeId!, content, (chunk) => {
                botContent += chunk;
                setMessages(prev => prev.map(msg =>
                    msg.id === botMsgId
                        ? { ...msg, content: botContent }
                        : msg
                ));
                onChunk?.(chunk);
            });

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
    }, [sessionId, isLoading]);

    // Fetch activity history when widget opens
    useEffect(() => {
        if (isOpen && token) {
            api.getActivityHistory(10)
                .then(activities => {
                    const formattedDetails = activities.map(a =>
                        `- [${new Date(a.timestamp || Date.now()).toLocaleTimeString()}] ${a.description} (${a.type})`
                    ).join('\n');

                    if (formattedDetails) {
                        setSystemContext(`Here is what the user has been doing recently (SYSTEM CONTEXT):\n${formattedDetails}\n\n`);
                    }
                })
                .catch(err => console.warn('Failed to fetch activity context:', err));
        }
    }, [isOpen, token]);

    // Public wrapper to inject context
    const sendMessage = useCallback(async (content: string, onChunk?: (chunk: string) => void) => {
        let fullContent = content;

        if (systemContext) {
            fullContent = `${systemContext}USER QUERY:\n${content}`;
            setSystemContext(''); // Clear it so we don't send it again next msg
        }

        await _sendMessage(fullContent, onChunk);
    }, [_sendMessage, systemContext]);

    const value: AIContextType = {
        isOpen,
        toggleOpen,
        sessionId,
        setSessionId,
        messages,
        isLoading,
        sendMessage,
        clearMessages,
        selectedModel,
        setSelectedModel,
        context,
        setContext,
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
