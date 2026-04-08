import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent } from 'react';
import { api, type ChatConversation } from '../services/api';
import { useAI } from '../contexts/AIContext';

export function useChatSession() {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [globalLoading, setGlobalLoading] = useState(true);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const {
        messages,
        setMessages,
        clearMessages,
        sendMessage: contextSendMessage,
        stopStreaming,
        regenerateLastResponse: contextRegenerateLastResponse,
        isLoading,
        conversationId,
        setConversationId
    } = useAI() as any;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const userInteractionRef = useRef<number>(0);

    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');

    const loadConversations = useCallback(async () => {
        try {
            const data = await api.getChatHistory();
            setConversations(data);
        } catch (error) {
            console.error('Failed to load history', error);
        } finally {
            setGlobalLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async (id: string) => {
        if (!id) return;
        try {
            const conversation = await api.getChatConversation(id);
            setMessages(
                (conversation.messages || []).map((message) => ({
                    ...message,
                    timestamp: new Date(message.timestamp)
                }))
            );
        } catch (error) {
            console.error('Failed to load conversation', error);
        }
    }, [setMessages]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (conversationId) {
            if (isLoading) return;
            void loadHistory(conversationId);
            return;
        }

        setMessages((prev: any[]) => {
            if (prev.length === 1 && prev[0]?.id === 'welcome') {
                return [];
            }
            return prev;
        });
    }, [conversationId, isLoading, loadHistory, setMessages]);

    const handleNewChat = useCallback(() => {
        clearMessages();
    }, [clearMessages]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (!messagesContainerRef.current) return;

        const isUserInteracting = Date.now() - userInteractionRef.current < 1500;
        if (isUserInteracting && !isAtBottom) return;

        const { scrollHeight, clientHeight } = messagesContainerRef.current;
        messagesContainerRef.current.scrollTo({
            top: scrollHeight - clientHeight,
            behavior
        });
    }, [isAtBottom]);

    const handleSend = useCallback(async (content: string, attachments: any[] = []) => {
        if ((!content.trim() && attachments.length === 0)) return;

        setShouldAutoScroll(true);
        try {
            await contextSendMessage(content, attachments, () => {
                if (shouldAutoScroll) {
                    requestAnimationFrame(() => scrollToBottom('auto'));
                }
            });

            if (!conversationId) {
                await loadConversations();
            }
        } catch (error) {
            console.error('Chat error', error);
        }
    }, [contextSendMessage, conversationId, loadConversations, scrollToBottom, shouldAutoScroll]);

    const handleStop = useCallback(() => {
        stopStreaming();
    }, [stopStreaming]);

    const handleRegenerateLastResponse = useCallback(async () => {
        setShouldAutoScroll(true);
        await contextRegenerateLastResponse(() => {
            if (shouldAutoScroll) {
                requestAnimationFrame(() => scrollToBottom('auto'));
            }
        });
        await loadConversations();
    }, [contextRegenerateLastResponse, loadConversations, scrollToBottom, shouldAutoScroll]);

    const confirmRename = useCallback(async () => {
        if (!renameTargetId || !newTitle.trim()) {
            setRenameTargetId(null);
            return;
        }
        try {
            await api.updateChatConversation(renameTargetId, { title: newTitle });
            setConversations((prev) => prev.map((conversation) => (
                conversation._id === renameTargetId
                    ? { ...conversation, title: newTitle }
                    : conversation
            )));
        } catch (error) {
            console.error('Failed to rename', error);
        } finally {
            setRenameTargetId(null);
        }
    }, [newTitle, renameTargetId]);

    const confirmDelete = useCallback(async (e?: MouseEvent) => {
        if (e) e.stopPropagation();
        if (!deleteTargetId) return;

        try {
            await api.deleteChatConversation(deleteTargetId);
            setConversations((prev) => prev.filter((conversation) => conversation._id !== deleteTargetId));
            if (conversationId === deleteTargetId) handleNewChat();
        } catch (error) {
            console.error('Failed to delete', error);
        } finally {
            setDeleteTargetId(null);
        }
    }, [conversationId, deleteTargetId, handleNewChat]);

    const memoizedGroups = useMemo(() => {
        const groups: { [key: string]: ChatConversation[] } = {
            Today: [],
            Yesterday: [],
            'Previous 7 Days': [],
            'Previous 30 Days': [],
            Older: []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const sevenDaysAgo = today - 7 * 86400000;
        const thirtyDaysAgo = today - 30 * 86400000;

        conversations.forEach((conversation) => {
            const date = new Date(conversation.updatedAt || conversation.createdAt).getTime();
            if (date >= today) groups.Today.push(conversation);
            else if (date >= yesterday) groups.Yesterday.push(conversation);
            else if (date >= sevenDaysAgo) groups['Previous 7 Days'].push(conversation);
            else if (date >= thirtyDaysAgo) groups['Previous 30 Days'].push(conversation);
            else groups.Older.push(conversation);
        });

        return Object.entries(groups).filter(([, list]) => list.length > 0);
    }, [conversations]);

    return {
        conversationId,
        setConversationId,
        conversations,
        setConversations,
        messages,
        isLoading,
        globalLoading,
        shouldAutoScroll,
        setShouldAutoScroll,
        isAtBottom,
        setIsAtBottom,
        messagesEndRef,
        messagesContainerRef,
        userInteractionRef,
        renameTargetId,
        setRenameTargetId,
        deleteTargetId,
        setDeleteTargetId,
        newTitle,
        setNewTitle,
        loadConversations,
        handleNewChat,
        scrollToBottom,
        handleSend,
        handleStop,
        handleRegenerateLastResponse,
        confirmRename,
        confirmDelete,
        memoizedGroups
    };
}
