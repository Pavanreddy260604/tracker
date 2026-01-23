import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api } from '../services/api';

// ============================================
// GEMINI MODELS CONFIGURATION
// ============================================
export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & smart (default)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Low cost, high speed' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Legacy stable' },
];

// ============================================
// TYPES
// ============================================
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIContextType {
    // UI State
    isOpen: boolean;
    toggleOpen: () => void;

    // Session State
    sessionId: string | null;
    setSessionId: (id: string | null) => void;

    // Message State
    messages: Message[];
    isLoading: boolean;

    // Actions
    sendMessage: (content: string, onChunk?: (chunk: string) => void) => Promise<void>;
    clearMessages: () => void;

    // Model Selection
    selectedModel: string;
    setSelectedModel: (model: string) => void;

    // Legacy context (for page-specific data)
    context: any;
    setContext: (data: any) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================
export function AIProvider({ children }: { children: ReactNode }) {
    // UI State
    const [isOpen, setIsOpen] = useState(false);

    // Session State
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Message State
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hi! I'm your deeper learning assistant. I have context on what you're working on. How can I help?",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // Model Selection
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

    // Legacy context
    const [context, setContext] = useState<any>({});

    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setSessionId(null);
    }, []);

    /**
     * Send a message to the AI assistant with streaming support.
     * This handles session creation, message saving, and streaming responses.
     */
    const sendMessage = useCallback(async (content: string, onChunk?: (chunk: string) => void) => {
        if (!content.trim() || isLoading) return;

        setIsLoading(true);

        // Add user message immediately
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        // Create placeholder for AI response
        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
            id: botMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        }]);

        try {
            // Ensure we have a session
            let activeId = sessionId;
            if (!activeId) {
                const newSession = await api.createChatSession();
                setSessionId(newSession._id);
                activeId = newSession._id;
            }

            // Stream the response
            let botContent = '';
            await api.sendChatMessage(activeId!, content, (chunk) => {
                botContent += chunk;

                // Update the message content
                setMessages(prev => prev.map(msg =>
                    msg.id === botMsgId
                        ? { ...msg, content: botContent }
                        : msg
                ));

                // Call external chunk handler if provided
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

// ============================================
// HOOK
// ============================================
export function useAI() {
    const context = useContext(AIContext);
    if (context === undefined) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
}
