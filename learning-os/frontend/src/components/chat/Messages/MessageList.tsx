import { useRef, useEffect, memo } from 'react';
import { ArrowDown, Bot } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { MessageRow } from './MessageRow';

interface MessageListProps {
    messages: any[];
    isLoading: boolean;
    isChatActive: boolean;
    isAtBottom: boolean;
    shouldAutoScroll: boolean;
    copiedBlockId: string | null;
    speakingMessageId: string | null;
    handleMessagesScroll: () => void;
    handleInteraction: () => void;
    handleCopyCode: (code: string, id: string) => void;
    handleSpeak: (text: string, id: string) => void;
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    setShouldAutoScroll: (auto: boolean) => void;
    setInput: (content: string) => void;
    setIsAtBottom: (atBottom: boolean) => void;
}

export const MessageList = memo(({
    messages,
    isLoading,
    isChatActive,
    isAtBottom,
    shouldAutoScroll,
    copiedBlockId,
    speakingMessageId,
    handleMessagesScroll,
    handleInteraction,
    handleCopyCode,
    handleSpeak,
    scrollToBottom,
    setShouldAutoScroll,
    setInput,
    setIsAtBottom
}: MessageListProps) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Sync Virtuoso scroll with auto-scroll state
    useEffect(() => {
        if (shouldAutoScroll && messages.length > 0) {
            virtuosoRef.current?.scrollToIndex({
                index: messages.length - 1,
                behavior: 'smooth'
            });
        }
    }, [messages.length, shouldAutoScroll]);

    if (!isChatActive) {
        return (
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
        );
    }

    return (
        <div className="flex-1 relative min-h-0 flex flex-col">
            <Virtuoso
                ref={virtuosoRef}
                data={messages}
                className="flex-1 custom-scrollbar"
                style={{ height: '100%' }}
                itemContent={(index, msg) => (
                    <div className="px-4 py-6 max-w-5xl mx-auto w-full">
                        <MessageRow
                            msg={msg}
                            idx={index}
                            isLoading={isLoading && index === messages.length - 1}
                            isLast={index === messages.length - 1}
                            handleCopyCode={handleCopyCode}
                            copiedBlockId={copiedBlockId}
                            onSpeak={(text: string) => handleSpeak(text, msg.id || `${index}`)}
                            isSpeakingThis={speakingMessageId === (msg.id || `${index}`)}
                        />
                    </div>
                )}
                followOutput={shouldAutoScroll ? 'smooth' : false}
                atBottomStateChange={setIsAtBottom}
                atBottomThreshold={200}
                onScroll={handleMessagesScroll}
                onWheel={handleInteraction}
                onTouchStart={handleInteraction}
                onMouseDown={handleInteraction}
            />

            {!isAtBottom && (
                <button
                    type="button"
                    onClick={() => {
                        setShouldAutoScroll(true);
                        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
                    }}
                    className="chat-scroll-button shadow-elevation-3 absolute bottom-24 right-8 z-20"
                    aria-label="Scroll to bottom"
                >
                    <ArrowDown size={16} />
                    <span>Scroll to bottom</span>
                </button>
            )}
        </div>
    );
});
