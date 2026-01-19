import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

interface Message {
    role: 'user' | 'model';
    content: string;
}

export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & smart (default)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Low cost, high speed' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Legacy stable' },
];

interface AIContextType {
    isOpen: boolean;
    toggleChat: () => void;
    messages: Message[];
    isLoading: boolean;
    sendMessage: (text: string, image?: File | null) => Promise<void>;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
}

const AIContext = createContext<AIContextType | null>(null);

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) throw new Error('useAI must be used within AIProvider');
    return context;
};

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

    const toggleChat = () => setIsOpen(prev => !prev);

    const sendMessage = async (text: string, image?: File | null) => {
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('message', text);
            formData.append('history', JSON.stringify(messages));
            formData.append('model', selectedModel);
            if (image) {
                formData.append('image', image);
            }

            const token = api.getToken();
            const headers: any = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/ai/chat`, {
                method: 'POST',
                headers,
                body: formData,
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'model', content: data.response }]);
        } catch (error: any) {
            console.error("AI Error", error);
            setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AIContext.Provider value={{ isOpen, toggleChat, messages, isLoading, sendMessage, selectedModel, setSelectedModel }}>
            {children}
        </AIContext.Provider>
    );
};


