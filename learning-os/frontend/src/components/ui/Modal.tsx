import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    className?: string;
    headerAction?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', className, headerAction }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Handle escape key + body scroll lock
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const sizeClasses = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '3xl': 'sm:max-w-3xl',
        '4xl': 'sm:max-w-4xl',
        '5xl': 'sm:max-w-5xl',
    };

    // Use Portal to render at document.body — escapes all stacking contexts
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        ref={overlayRef}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal Content — full-screen on mobile, card on desktop */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? "modal-title" : undefined}
                        className={cn(
                            'relative w-full flex flex-col',
                            'h-[100dvh] sm:h-auto',
                            'rounded-none sm:rounded-2xl',
                            'sm:max-h-[90vh]',
                            'gcp-modal overscroll-contain',
                            sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md,
                            className
                        )}
                        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                        /* Mobile: slide up from bottom */
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                    >
                        {/* Sticky Header — acts as mobile app bar */}
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-subtle shrink-0 bg-console-surface sticky top-0 z-10">
                            <h2 id="modal-title" className="text-base sm:text-lg font-semibold text-text-primary truncate pr-4">
                                {title || '\u00A0'}
                            </h2>
                            <div className="flex items-center gap-1">
                                {headerAction}
                                <button
                                    onClick={onClose}
                                    className="p-2.5 -mr-1 rounded-full hover:bg-console-surface-2 text-text-tertiary hover:text-text-primary transition-colors active:scale-95 shrink-0"
                                    aria-label="Close"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Body — scrollable */}
                        <div className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
