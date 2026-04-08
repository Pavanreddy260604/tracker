import { memo } from 'react';
import { Trash2, Edit, Check, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ChatConversation } from '../../../services/api';

interface SidebarItemProps {
    conversation: ChatConversation;
    isActive: boolean;
    renameTargetId: string | null;
    deleteTargetId: string | null;
    newTitle: string;
    setNewTitle: (title: string) => void;
    onSelect: (id: string) => void;
    onRenameInit: (e: React.MouseEvent, id: string, title: string) => void;
    onRenameConfirm: () => void;
    onRenameCancel: () => void;
    onDeleteInit: (e: React.MouseEvent, id: string) => void;
    onDeleteConfirm: () => void;
    onDeleteCancel: () => void;
}

export const SidebarItem = memo(({
    conversation,
    isActive,
    renameTargetId,
    deleteTargetId,
    newTitle,
    setNewTitle,
    onSelect,
    onRenameInit,
    onRenameConfirm,
    onRenameCancel,
    onDeleteInit,
    onDeleteConfirm,
    onDeleteCancel
}: SidebarItemProps) => {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => {
                if (renameTargetId || deleteTargetId === conversation._id) return;
                onSelect(conversation._id);
            }}
            className={cn(
                "chat-session-item w-full text-left px-3 py-3 rounded-xl text-sm flex items-center group relative min-h-[44px] cursor-pointer",
                isActive && "active"
            )}
        >
            {renameTargetId === conversation._id ? (
                <div className="flex items-center gap-2 flex-1 w-full" onClick={e => e.stopPropagation()}>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onRenameConfirm();
                            if (e.key === 'Escape') onRenameCancel();
                        }}
                        autoFocus
                        className="w-full bg-[color:var(--console-surface-2)] text-[color:var(--text-primary)] rounded-lg px-2.5 py-1.5 outline-none border border-[color:var(--border-subtle)] focus:border-[color:var(--accent-primary)] focus:ring-2 focus:ring-[color:var(--accent-focus)] text-sm transition-all"
                        placeholder="Enter new name..."
                    />
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={onRenameConfirm}
                            className="p-1.5 rounded-lg bg-[color:var(--accent-primary)] text-console-bg hover:opacity-90 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            onClick={onRenameCancel}
                            className="p-1.5 rounded-lg hover:bg-console-surface-3/50 text-[color:var(--text-secondary)] min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : deleteTargetId === conversation._id ? (
                <div className="flex items-center justify-between flex-1 w-full gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-status-error text-xs font-semibold truncate">Delete this chat?</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={onDeleteConfirm}
                            className="px-3 py-1 rounded-lg bg-status-error/20 text-status-error hover:bg-status-error/30 text-xs font-semibold transition-colors min-h-[30px]"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={onDeleteCancel}
                            className="px-3 py-1 rounded-lg bg-console-surface text-[color:var(--text-secondary)] text-xs font-semibold transition-colors min-h-[30px]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <span className="truncate flex-1 pr-2">{conversation.title}</span>
                    <div className="chat-session-actions flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={(e) => onRenameInit(e, conversation._id, conversation.title)}
                            className="p-1.5 rounded-lg hover:bg-console-surface-3/50 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                        >
                            <Edit size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => onDeleteInit(e, conversation._id)}
                            className="p-1.5 rounded-lg hover:bg-status-error/20 text-[color:var(--text-secondary)] hover:text-status-error transition-colors"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
});
