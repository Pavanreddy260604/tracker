import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from '../hooks/useSpeech';
import { useMobile } from '../hooks/useMobile';
import { PanelLeftOpen, PanelLeftClose, Plus, X, AlertTriangle, RotateCcw, Github, Database, Sparkles } from 'lucide-react';

// New Components & Hooks
import { ChatSidebar } from '../components/chat/Sidebar/ChatSidebar';
import { MessageList } from '../components/chat/Messages/MessageList';
import { ChatInput } from '../components/chat/Input/ChatInput';
import { getLoadingVisual, LoadingStatusLabel } from '../components/chat/LoadingStatusLabel';
import { useChatSession } from '../hooks/useChatSession';

export default function ChatPage() {
    const navigate = useNavigate();
    const { isMobile, isTablet } = useMobile();
    const speech = useSpeech();
    
    // Core State Hook
    const chat = useChatSession();
    
    // UI Local State
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile && !isTablet);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

    // Sync sidebar state on mobile
    useEffect(() => {
        if (isMobile || isTablet) setSidebarOpen(false);
        else setSidebarOpen(true);
    }, [isMobile, isTablet]);

    const handleCopyCode = async (code: string, id: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedBlockId(id);
            setTimeout(() => setCopiedBlockId(null), 1500);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };

    const handleSpeak = (text: string, id: string) => {
        if (speakingMessageId === id) {
            speech.stopSpeaking();
            setSpeakingMessageId(null);
        } else {
            speech.speak(text);
            setSpeakingMessageId(id);
        }
    };

    const handleExit = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowExitConfirm(true);
    };

    const confirmExit = () => navigate('/');

    const handleInteraction = useCallback(() => {
        chat.userInteractionRef.current = Date.now();
    }, [chat.userInteractionRef]);

    const handleMessagesScroll = useCallback(() => {
        const container = chat.messagesContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        const currentlyAtBottom = distanceFromBottom < 10;
        const userHasScrolledUpSignificantly = distanceFromBottom > 80;

        chat.setIsAtBottom(currentlyAtBottom);

        if (userHasScrolledUpSignificantly && chat.shouldAutoScroll) {
            chat.setShouldAutoScroll(false);
        } else if (currentlyAtBottom && !chat.shouldAutoScroll) {
            chat.setShouldAutoScroll(true);
        }
    }, [chat]);

    const latestAssistant = [...chat.messages].reverse().find((message: any) => message.role === 'assistant');
    const activeVisual = getLoadingVisual(latestAssistant);
    const activeStatus = chat.isLoading
        ? {
            text: activeVisual.title,
            animation: activeVisual.animation,
            mode: latestAssistant?.loadingLabel || 'thinking'
        }
        : {
            text: 'Reliable streaming ready',
            mode: 'idle'
        };

    const StatusIcon = activeStatus.mode === 'github'
        ? Github
        : activeStatus.mode === 'knowledge'
            ? Database
            : Sparkles;

    return (
        <div className="chat-shell bg-console-bg viewport-keyboard-safe">
            {/* Mobile Sidebar Overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99]"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <ChatSidebar
                sidebarOpen={sidebarOpen}
                isMobile={isMobile}
                isTablet={isTablet}
                conversations={chat.conversations}
                conversationId={chat.conversationId}
                memoizedGroups={chat.memoizedGroups}
                renameTargetId={chat.renameTargetId}
                deleteTargetId={chat.deleteTargetId}
                newTitle={chat.newTitle}
                setNewTitle={chat.setNewTitle}
                setSidebarOpen={setSidebarOpen}
                handleNewChat={chat.handleNewChat}
                setConversationId={chat.setConversationId}
                handleRenameInit={(e, id, title) => { chat.setRenameTargetId(id); chat.setNewTitle(title); }}
                confirmRename={chat.confirmRename}
                confirmDelete={chat.confirmDelete}
                handleDelete={(e, id) => chat.setDeleteTargetId(id)}
                setRenameTargetId={chat.setRenameTargetId}
                setDeleteTargetId={chat.setDeleteTargetId}
            />

            <div className="chat-main flex-1 flex flex-col relative">
                <header className="chat-header sticky top-0 z-10 px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSidebarOpen(prev => !prev)} className="chat-icon-button p-2 rounded-lg">
                            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        <span className="chat-title truncate max-w-[120px] sm:max-w-none max-sm:hidden">AI Chat</span>
                        <span className="chat-pro-badge max-sm:hidden px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.1em] bg-accent-primary/10 border border-accent-primary/20 text-accent-primary">Pro</span>
                        <div className={`chat-status-pill max-sm:hidden ${activeStatus.mode === 'github' ? 'is-github' : ''} ${chat.isLoading ? 'is-live' : ''}`}>
                            <StatusIcon size={13} />
                            {chat.isLoading ? (
                                <LoadingStatusLabel
                                    text={activeStatus.text}
                                    animation={activeVisual.animation}
                                    className="text-[11px] font-semibold"
                                />
                            ) : (
                                <span className="text-[11px] font-semibold">{activeStatus.text}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={chat.handleNewChat} className="chat-icon-button p-2 rounded-lg transition-colors bg-console-surface hover:bg-console-surface-2 border border-border-subtle max-sm:flex items-center gap-2 max-sm:px-3 max-sm:py-1.5 max-sm:rounded-full">
                            <Plus size={16} />
                            <span className="text-[13px] font-medium hidden max-sm:inline-block">New Chat</span>
                        </button>
                        <button
                            onClick={chat.handleRegenerateLastResponse}
                            disabled={chat.isLoading || !chat.conversationId || chat.messages.filter((message: any) => message.role === 'assistant').length === 0}
                            className="chat-icon-button p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Regenerate last response"
                        >
                            <RotateCcw size={18} />
                        </button>
                        <button onClick={handleExit} className="chat-icon-button p-2 rounded-lg transition-colors" title="Exit Chat"><X size={20} /></button>
                    </div>
                </header>

                <MessageList
                    messages={chat.messages}
                    isLoading={chat.isLoading}
                    isChatActive={chat.messages.length > 0}
                    isAtBottom={chat.isAtBottom}
                    shouldAutoScroll={chat.shouldAutoScroll}
                    copiedBlockId={copiedBlockId}
                    speakingMessageId={speakingMessageId}
                    handleMessagesScroll={handleMessagesScroll}
                    handleInteraction={handleInteraction}
                    handleCopyCode={handleCopyCode}
                    handleSpeak={handleSpeak}
                    scrollToBottom={chat.scrollToBottom}
                    setShouldAutoScroll={chat.setShouldAutoScroll}
                    setInput={chat.handleSend}
                    setIsAtBottom={chat.setIsAtBottom}
                />

                <ChatInput
                    isLoading={chat.isLoading}
                    handleSend={chat.handleSend}
                    handleStop={chat.handleStop}
                    speech={speech}
                />
            </div>

            {showExitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="chat-modal max-w-sm w-full p-6 bg-console-surface border border-border-subtle rounded-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-status-warning/10 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="text-status-warning" size={24} /></div>
                            <h3 className="text-lg font-semibold text-text-primary mb-2">Exit Chat?</h3>
                            <p className="text-sm text-text-secondary mb-6">Are you sure you want to leave? Your current session is saved.</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowExitConfirm(false)} className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-console-surface-2 border border-border-subtle text-text-primary hover:bg-console-surface-3 transition-colors">Cancel</button>
                                <button onClick={confirmExit} className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-accent-primary text-console-bg hover:opacity-90 transition-opacity">Exit</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
