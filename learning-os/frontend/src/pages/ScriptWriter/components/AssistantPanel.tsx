import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Check, X, Loader2, Trash2, RotateCcw, Copy, User, Bot, ChevronDown, Plus } from 'lucide-react';
import type { AssistantMessage } from '../types';
import type { Bible } from '../../../services/project.api';

interface AssistantPanelProps {
    activeProject: Bible | null;
    messages: AssistantMessage[];
    isGenerating: boolean;
    activeSceneName?: string;
    onSendMessage: (content: string) => void;
    onApplyProposal: (messageId: string) => void;
    onDiscardProposal: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    onUpdateMessage: (messageId: string, content: string) => void;
    onClearChat: () => void;
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

export function AssistantPanel({
    activeProject,
    messages,
    isGenerating,
    activeSceneName,
    onSendMessage,
    onApplyProposal,
    onDiscardProposal,
    onDeleteMessage,
    onUpdateMessage,
    onClearChat
}: AssistantPanelProps) {
    const [inputValue, setInputValue] = useState('');
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current;
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (isNearBottom || isGenerating) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages, isGenerating]);

    // Track scroll position for "scroll down" button
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleScroll = () => {
            setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
        };
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSend = () => {
        if (!inputValue.trim() || isGenerating) return;
        onSendMessage(inputValue);
        setInputValue('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const startEditing = (msg: AssistantMessage) => {
        setEditingMsgId(msg.id);
        setEditValue(msg.content);
    };

    const saveEdit = (messageId: string) => {
        if (editValue.trim()) {
            onUpdateMessage(messageId, editValue);
        }
        setEditingMsgId(null);
    };

    const scrollToBottom = () => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    };

    // Group consecutive messages by role for visual grouping
    const groupedMessages = messages.reduce<{ role: string; msgs: AssistantMessage[] }[]>((acc, msg) => {
        const last = acc[acc.length - 1];
        if (last && last.role === msg.role && msg.type !== 'thought') {
            last.msgs.push(msg);
        } else {
            acc.push({ role: msg.role, msgs: [msg] });
        }
        return acc;
    }, []);

    if (!activeProject) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-zinc-700/50">
                    <Sparkles size={28} className="text-zinc-600" />
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-400">No Project Selected</p>
                    <p className="text-xs text-zinc-600 max-w-[220px]">Open a project and select a scene to start working with the Script Assistant.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-zinc-800/60 shadow-sm z-10">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                        {activeSceneName ? (
                            <p className="text-xs text-zinc-400 truncate font-medium">{activeSceneName}</p>
                        ) : (
                            <p className="text-xs text-zinc-600 truncate font-medium">Select a scene</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        onClick={onClearChat}
                        title="New conversation"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
                {messages.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center space-y-6">
                        <div className="space-y-3 flex flex-col items-center select-none">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shadow-sm">
                                <Sparkles size={20} className="text-zinc-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] text-zinc-500 max-w-[220px] leading-relaxed">
                                    I can write, rewrite, translate, or transform your scenes. Just tell me what you need.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                            {[
                                'Write this scene from scratch',
                                'Make the dialogue more emotional',
                                'Translate to Telugu in English letters',
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setInputValue(suggestion);
                                        inputRef.current?.focus();
                                    }}
                                    className="px-3 py-2 bg-transparent border border-zinc-800/60 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all text-left group"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="pb-4">
                        {/* Conversation thread */}
                        {groupedMessages.map((group, gi) => (
                            <div key={gi} className={`py-4 px-4 ${group.role === 'assistant' ? 'bg-[#111]/50' : ''}`}>
                                <div className="flex gap-3 max-w-full">
                                    {/* Avatar */}
                                    <div className="flex-shrink-0 mt-0.5">
                                        {group.role === 'user' ? (
                                            <div className="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center">
                                                <User size={12} className="text-zinc-300" />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm shadow-blue-900/20">
                                                <Bot size={12} className="text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2">
                                        {/* Role label */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-zinc-300">
                                                {group.role === 'user' ? 'You' : 'Assistant'}
                                            </span>
                                            {group.msgs[0]?.timestamp && (
                                                <span className="text-[10px] text-zinc-600">{timeAgo(group.msgs[0].timestamp)}</span>
                                            )}
                                        </div>

                                        {group.msgs.map((msg) => (
                                            <div key={msg.id} className="group/msg relative">
                                                {/* User Instruction */}
                                                {msg.type === 'instruction' && (
                                                    <>
                                                        {editingMsgId === msg.id ? (
                                                            <div className="space-y-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                                                                <textarea
                                                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 resize-none"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    rows={3}
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Escape') setEditingMsgId(null);
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            saveEdit(msg.id);
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setEditingMsgId(null)} className="px-3 py-1 text-[10px] font-bold uppercase text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                                                                    <button onClick={() => saveEdit(msg.id)} className="px-3 py-1 bg-blue-600 rounded text-[10px] font-bold uppercase text-white hover:bg-blue-500 transition-colors">Save</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                                {/* Hover actions */}
                                                                <div className="absolute -right-1 -top-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-md p-0.5 shadow-xl z-10">
                                                                    <button onClick={() => startEditing(msg)} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors" title="Edit">
                                                                        <RotateCcw size={11} />
                                                                    </button>
                                                                    <button onClick={() => onDeleteMessage(msg.id)} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors" title="Delete">
                                                                        <Trash2 size={11} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {/* Thought/Status */}
                                                {msg.type === 'thought' && (
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 py-1">
                                                        <Loader2 size={10} className="animate-spin" />
                                                        <span className="italic">{msg.content}</span>
                                                    </div>
                                                )}

                                                {/* Proposal */}
                                                {msg.type === 'proposal' && (
                                                    <div className="space-y-2">
                                                        {/* Script content block */}
                                                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-lg overflow-hidden">
                                                            {/* Code block header */}
                                                            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
                                                                <span className="text-[10px] text-zinc-500 font-mono">screenplay</span>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleCopy(msg.content, msg.id)}
                                                                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                                        title="Copy"
                                                                    >
                                                                        {copiedId === msg.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {/* Content */}
                                                            <div className="p-3 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar leading-relaxed">
                                                                {msg.content}
                                                                {isGenerating && msg.id === messages[messages.length - 1]?.id && (
                                                                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle rounded-sm" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Action buttons */}
                                                        {msg.status === 'pending' && (
                                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                                                <button
                                                                    onClick={() => onApplyProposal(msg.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-md transition-all shadow-sm shadow-blue-900/20"
                                                                >
                                                                    <Check size={12} /> Apply Changes
                                                                </button>
                                                                <button
                                                                    onClick={() => onDiscardProposal(msg.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold rounded-md transition-all border border-zinc-700"
                                                                >
                                                                    <X size={12} /> Discard
                                                                </button>
                                                            </div>
                                                        )}
                                                        {msg.status === 'applied' && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-green-400/80 font-medium">
                                                                <Check size={12} /> Changes applied to editor
                                                            </div>
                                                        )}
                                                        {msg.status === 'discarded' && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                                                                <X size={12} /> Changes discarded
                                                            </div>
                                                        )}

                                                        {/* Hover delete for proposal */}
                                                        <div className="absolute right-0 -top-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                            <button onClick={() => onDeleteMessage(msg.id)} className="p-1 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors shadow-lg" title="Delete">
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Generating indicator */}
                        {isGenerating && messages[messages.length - 1]?.type !== 'proposal' && (
                            <div className="py-4 px-4 bg-[#111]/50">
                                <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0">
                                        <Bot size={12} className="text-white" />
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Scroll to bottom button */}
                {showScrollDown && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-all shadow-xl z-20 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                        <ChevronDown size={16} />
                    </button>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#0a0a0a] relative z-10 border-t border-zinc-800/60">
                <div className="relative bg-[#111] border border-zinc-800/80 rounded-xl shadow-sm focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all overflow-hidden group">
                    <textarea
                        ref={inputRef}
                        className="w-full bg-transparent px-3 pt-3 pb-10 text-[13px] text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none custom-scrollbar leading-relaxed"
                        rows={1}
                        style={{ minHeight: '44px' }}
                        placeholder={activeSceneName ? `Ask about "${activeSceneName}"...` : 'Ask anything...'}
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating}
                    />
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-2">
                        {isGenerating ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-indigo-400 text-[11px] font-semibold bg-indigo-500/10">
                                <Loader2 size={12} className="animate-spin" /> Generating...
                            </div>
                        ) : (
                            <button
                                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${inputValue.trim()
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-900/20 hover:scale-105 active:scale-95'
                                    : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                                    }`}
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                            >
                                <Send size={14} className={inputValue.trim() ? "translate-x-px -translate-y-px" : ""} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between px-2 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium tracking-wide">
                        <span className="flex items-center gap-1"><kbd className="font-sans px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↵</kbd> Send</span>
                        <span className="flex items-center gap-1"><kbd className="font-sans px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">⇧</kbd> <kbd className="font-sans px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↵</kbd> New line</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium tracking-wide">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}
