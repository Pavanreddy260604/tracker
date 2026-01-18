import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} className="text-gray-300" />,
    error: <XCircle size={18} className="text-gray-400" />,
    info: <Info size={18} className="text-gray-300" />,
    warning: <AlertTriangle size={18} className="text-gray-400" />,
};

const bgMap: Record<ToastType, string> = {
    success: 'bg-green-500/10 border-green-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    info: 'bg-gray-700/10 border-gray-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
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
                            flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm
                            shadow-lg pointer-events-auto
                            ${bgMap[toast.type]}
                        `}
                    >
                        {iconMap[toast.type]}
                        <p className="flex-1 text-sm text-white">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
