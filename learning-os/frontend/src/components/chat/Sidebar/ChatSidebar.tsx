import { motion } from 'framer-motion';
import { Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SidebarItem } from './SidebarItem';
import type { ChatConversation } from '../../../services/api';

interface ChatSidebarProps {
    sidebarOpen: boolean;
    isMobile: boolean;
    isTablet: boolean;
    conversations: ChatConversation[];
    conversationId: string | null;
    memoizedGroups: [string, ChatConversation[]][];
    renameTargetId: string | null;
    deleteTargetId: string | null;
    newTitle: string;
    setNewTitle: (title: string) => void;
    setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    handleNewChat: () => void;
    setConversationId: (id: string | null) => void;
    handleRenameInit: (e: React.MouseEvent, id: string, title: string) => void;
    confirmRename: () => void;
    confirmDelete: (e?: React.MouseEvent) => void;
    handleDelete: (e: React.MouseEvent, id: string) => void;
    setRenameTargetId: (id: string | null) => void;
    setDeleteTargetId: (id: string | null) => void;
}

export const ChatSidebar = ({
    sidebarOpen,
    isMobile,
    isTablet,
    conversations,
    conversationId,
    memoizedGroups,
    renameTargetId,
    deleteTargetId,
    newTitle,
    setNewTitle,
    setSidebarOpen,
    handleNewChat,
    setConversationId,
    handleRenameInit,
    confirmRename,
    confirmDelete,
    handleDelete,
    setRenameTargetId,
    setDeleteTargetId
}: ChatSidebarProps) => {
    return (
        <motion.div
            initial={false}
            animate={{ width: sidebarOpen ? (isMobile ? 280 : (isTablet ? 220 : 260)) : 0 }}
            className={cn(
                "chat-sidebar flex flex-col overflow-hidden shrink-0 relative transition-[width] duration-300 ease-in-out",
                sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
                isMobile && "fixed top-0 left-0 bottom-0 z-[100] h-[100dvh] bg-[color:var(--console-surface)] shadow-2xl"
            )}
        >
            <div className="p-3 mb-2">
                <button onClick={handleNewChat} className="chat-new-button w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors">
                    <Plus size={16} /> <span className="flex-1">New chat</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {memoizedGroups.map(([groupName, groupConversationList]) => (
                    <div key={groupName} className="mb-4 last:mb-2">
                        <div className="text-[11px] font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider px-3 mb-2 mt-4 first:mt-1 select-none">
                            {groupName}
                        </div>
                        <div className="space-y-1">
                            {groupConversationList.map(conversation => (
                                <SidebarItem
                                    key={conversation._id}
                                    conversation={conversation}
                                    isActive={conversationId === conversation._id}
                                    renameTargetId={renameTargetId}
                                    deleteTargetId={deleteTargetId}
                                    newTitle={newTitle}
                                    setNewTitle={setNewTitle}
                                    onSelect={(id: string) => {
                                        setConversationId(id);
                                        if (isMobile) setSidebarOpen(false);
                                    }}
                                    onRenameInit={handleRenameInit}
                                    onRenameConfirm={confirmRename}
                                    onRenameCancel={() => setRenameTargetId(null)}
                                    onDeleteInit={handleDelete}
                                    onDeleteConfirm={confirmDelete}
                                    onDeleteCancel={() => setDeleteTargetId(null)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
