import { useEffect, useRef } from 'react';
import { activityTracker } from '../services/activity.tracker';

type ProtectedAction =
    | 'context_menu'
    | 'text_selection'
    | 'clipboard_copy'
    | 'clipboard_cut'
    | 'clipboard_paste'
    | 'shortcut_copy'
    | 'shortcut_cut'
    | 'shortcut_paste'
    | 'drag_start'
    | 'drop';

interface UseInterviewContentProtectionOptions {
    enabled: boolean;
    sessionId?: string;
    cooldownMs?: number;
    onBlocked?: (message: string, action: ProtectedAction) => void;
    warningOnce?: boolean;
}

const PROTECTED_CONTENT_SELECTOR = '[data-protected-content="true"]';

const getProtectedContainer = (node: Node | null): Element | null => {
    if (!node) return null;
    if (node instanceof Element) {
        return node.closest(PROTECTED_CONTENT_SELECTOR);
    }
    return node.parentElement?.closest(PROTECTED_CONTENT_SELECTOR) || null;
};

const selectionTouchesProtectedContent = (): boolean => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return false;
    }

    const anchorProtected = getProtectedContainer(selection.anchorNode);
    const focusProtected = getProtectedContainer(selection.focusNode);
    if (anchorProtected || focusProtected) {
        return true;
    }

    const range = selection.getRangeAt(0);
    return Boolean(getProtectedContainer(range.commonAncestorContainer));
};

export const useInterviewContentProtection = ({
    enabled,
    sessionId,
    cooldownMs = 10000,
    onBlocked,
    warningOnce = true,
}: UseInterviewContentProtectionOptions) => {
    const actionTimestampRef = useRef<Record<ProtectedAction, number>>({
        context_menu: 0,
        text_selection: 0,
        clipboard_copy: 0,
        clipboard_cut: 0,
        clipboard_paste: 0,
        shortcut_copy: 0,
        shortcut_cut: 0,
        shortcut_paste: 0,
        drag_start: 0,
        drop: 0,
    });
    const warningShownRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            warningShownRef.current = false;
        }
    }, [enabled, sessionId]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const reportBlockedAction = (action: ProtectedAction) => {
            const now = Date.now();
            const lastLogged = actionTimestampRef.current[action] || 0;
            if (now - lastLogged < cooldownMs) {
                return;
            }

            actionTimestampRef.current[action] = now;
            activityTracker.log(
                'command',
                `Blocked protected interview content action: ${action}`,
                {
                    component: 'InterviewContentProtection',
                    targetId: sessionId,
                    details: { action },
                }
            );

            if (!warningOnce || !warningShownRef.current) {
                warningShownRef.current = true;
                onBlocked?.(
                    'Interview content is protected. Sharing or bypass attempts may lead to account termination.',
                    action
                );
            }
        };

        const isTargetProtected = (target: EventTarget | null) =>
            target instanceof Node && Boolean(getProtectedContainer(target));

        const handleContextMenu = (event: MouseEvent) => {
            if (!isTargetProtected(event.target)) return;
            event.preventDefault();
            reportBlockedAction('context_menu');
        };

        const handleSelectStart = (event: Event) => {
            if (!isTargetProtected(event.target)) return;
            event.preventDefault();
            reportBlockedAction('text_selection');
        };

        const handleClipboardEvent = (event: ClipboardEvent) => {
            const selectionProtected = selectionTouchesProtectedContent();
            if (!isTargetProtected(event.target) && !selectionProtected) return;

            event.preventDefault();
            if (event.type === 'copy') reportBlockedAction('clipboard_copy');
            if (event.type === 'cut') reportBlockedAction('clipboard_cut');
            if (event.type === 'paste') reportBlockedAction('clipboard_paste');
        };

        const handleShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;

            const key = event.key.toLowerCase();
            if (key !== 'c' && key !== 'x' && key !== 'v') return;

            const selectionProtected = selectionTouchesProtectedContent();
            if (!isTargetProtected(event.target) && !selectionProtected) return;

            event.preventDefault();
            event.stopPropagation();

            if (key === 'c') reportBlockedAction('shortcut_copy');
            if (key === 'x') reportBlockedAction('shortcut_cut');
            if (key === 'v') reportBlockedAction('shortcut_paste');
        };

        const handleDragStart = (event: DragEvent) => {
            if (!isTargetProtected(event.target)) return;
            event.preventDefault();
            reportBlockedAction('drag_start');
        };

        const handleDrop = (event: DragEvent) => {
            if (!isTargetProtected(event.target)) return;
            event.preventDefault();
            reportBlockedAction('drop');
        };

        document.addEventListener('contextmenu', handleContextMenu, true);
        document.addEventListener('selectstart', handleSelectStart, true);
        document.addEventListener('copy', handleClipboardEvent, true);
        document.addEventListener('cut', handleClipboardEvent, true);
        document.addEventListener('paste', handleClipboardEvent, true);
        document.addEventListener('keydown', handleShortcut, true);
        document.addEventListener('dragstart', handleDragStart, true);
        document.addEventListener('drop', handleDrop, true);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
            document.removeEventListener('selectstart', handleSelectStart, true);
            document.removeEventListener('copy', handleClipboardEvent, true);
            document.removeEventListener('cut', handleClipboardEvent, true);
            document.removeEventListener('paste', handleClipboardEvent, true);
            document.removeEventListener('keydown', handleShortcut, true);
            document.removeEventListener('dragstart', handleDragStart, true);
            document.removeEventListener('drop', handleDrop, true);
        };
    }, [cooldownMs, enabled, onBlocked, sessionId, warningOnce]);
};
