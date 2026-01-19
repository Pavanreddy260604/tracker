import React, { useRef, useEffect } from 'react';
import { useAI, GEMINI_MODELS } from '../../context/AIContext';
import { X, Send, Bot, Sparkles, MonitorSmartphone, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';

export const AIChatWidget: React.FC = () => {
    const { isOpen, toggleChat, messages, sendMessage, isLoading, selectedModel, setSelectedModel } = useAI();
    const [input, setInput] = React.useState('');
    const [screenshot, setScreenshot] = React.useState<File | null>(null);
    const [showModelPicker, setShowModelPicker] = React.useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() && !screenshot) return;
        const text = input;
        const img = screenshot;
        setInput('');
        setScreenshot(null);
        await sendMessage(text, img);
    };

    const handleScreenshot = async () => {
        try {
            const canvas = await html2canvas(document.body);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "screenshot.png", { type: "image/png" });
                    setScreenshot(file);
                }
            });
        } catch (err) {
            console.error("Screenshot failed", err);
        }
    };

    if (!isOpen) {
        return (
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleChat}
                className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl z-50 flex items-center justify-center transition-all"
            >
                <Sparkles size={24} />
            </motion.button>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-6 right-6 w-96 h-[600px] bg-[#0f1115] border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
            >
                {/* Header */}
                <div className="p-3 bg-[#1a1d24] border-b border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Bot className="text-indigo-400" size={18} />
                        <div className="relative">
                            <button
                                onClick={() => setShowModelPicker(!showModelPicker)}
                                className="flex items-center gap-1 text-sm text-gray-200 hover:text-white transition-colors"
                            >
                                {GEMINI_MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}
                                <ChevronDown size={14} className={`transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                            </button>
                            {showModelPicker && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1d24] border border-gray-700 rounded-lg shadow-xl z-10">
                                    {GEMINI_MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => { setSelectedModel(model.id); setShowModelPicker(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#2a2d35] ${selectedModel === model.id ? 'text-indigo-400' : 'text-gray-300'}`}
                                        >
                                            <div className="font-medium">{model.name}</div>
                                            <div className="text-xs text-gray-500">{model.description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={toggleChat} className="text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 mt-10">
                            <Sparkles className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">How can I help you learn today?</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-[#2a2d35] text-gray-200'
                                }`}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-[#2a2d35] p-3 rounded-lg text-gray-400 text-sm animate-pulse">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#1a1d24] border-t border-gray-700">
                    {screenshot && (
                        <div className="mb-2 flex items-center gap-2 bg-[#0b0f14] p-2 rounded text-xs text-gray-300">
                            <MonitorSmartphone size={14} className="text-green-400" />
                            <span>Screenshot attached</span>
                            <button onClick={() => setScreenshot(null)} className="ml-auto hover:text-red-400"><X size={14} /></button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleScreenshot}
                            title="Capture Screen"
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <MonitorSmartphone size={20} />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask anything..."
                            className="flex-1 bg-[#0b0f14] border-none rounded-lg p-2 text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || (!input && !screenshot)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

