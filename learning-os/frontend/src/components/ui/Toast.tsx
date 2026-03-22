import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} className="text-status-ok" />,
    error: <XCircle size={18} className="text-status-error" />,
    info: <Info size={18} className="text-accent-primary" />,
    warning: <AlertTriangle size={18} className="text-status-warning" />,
};

const bgMap: Record<ToastType, string> = {
    success: 'bg-status-ok-soft border-status-ok/30',
    error: 'bg-status-error-soft border-status-error/30',
    info: 'bg-accent-soft border-accent-primary/30',
    warning: 'bg-status-warning-soft border-status-warning/30',
};

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl
                            shadow-strong pointer-events-auto text-text-primary
                            ${bgMap[toast.type]}
                        `}
                    >
                        {iconMap[toast.type]}
                        <p className="flex-1 text-sm font-medium text-text-primary">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-lg hover:bg-console-surface-2 text-text-tertiary hover:text-text-primary transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
