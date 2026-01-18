import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ZeroDayWarningProps {
    daysSinceActivity: number;
    onDismiss?: () => void;
    className?: string;
}

export function ZeroDayWarning({ daysSinceActivity, onDismiss, className }: ZeroDayWarningProps) {
    if (daysSinceActivity < 1) return null;

    const severity = daysSinceActivity >= 3 ? 'high' : daysSinceActivity >= 1 ? 'medium' : 'low';

    return (
        <motion.div
            className={cn(
                'flex items-center gap-3 p-4 rounded-xl border',
                severity === 'high' && 'bg-red-500/10 border-red-500/30',
                severity === 'medium' && 'bg-amber-500/10 border-amber-500/30',
                className
            )}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
        >
            <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                severity === 'high' ? 'bg-red-500/20' : 'bg-amber-500/20'
            )}>
                <AlertTriangle
                    size={20}
                    className={severity === 'high' ? 'text-red-400' : 'text-amber-400'}
                />
            </div>

            <div className="flex-1">
                <p className={cn(
                    'font-medium',
                    severity === 'high' ? 'text-red-300' : 'text-amber-300'
                )}>
                    {severity === 'high' ? 'Extended inactivity detected' : 'No activity logged yet'}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                    {daysSinceActivity === 1
                        ? "You haven't logged any hours today."
                        : `${daysSinceActivity} days since your last study session.`
                    }
                    {' '}Get back on track!
                </p>
            </div>

            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                >
                    <X size={18} />
                </button>
            )}
        </motion.div>
    );
}
