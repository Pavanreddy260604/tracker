import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak: number;
    atRisk?: boolean;
    isActiveToday?: boolean;
    className?: string;
}

export function StreakDisplay({
    currentStreak,
    longestStreak,
    atRisk = false,
    isActiveToday = false,
    className,
}: StreakDisplayProps) {
    const isNewRecord = currentStreak > 0 && currentStreak >= longestStreak;

    return (
        <div className={cn('relative', className)}>
            {/* Main streak display */}
            <motion.div
                className={cn(
                    'flex items-center gap-4 p-4 rounded-2xl border',
                    atRisk
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-gray-100 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08]'
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Flame icon */}
                <motion.div
                    className={cn(
                        'relative w-14 h-14 rounded-xl flex items-center justify-center',
                        currentStreak > 0
                            ? 'bg-orange-500'
                            : 'bg-gray-300 dark:bg-gray-800'
                    )}
                    animate={
                        isNewRecord && currentStreak > 0
                            ? { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }
                            : {}
                    }
                    transition={{ duration: 0.6, repeat: isNewRecord ? Infinity : 0, repeatDelay: 2 }}
                >
                    <Flame
                        size={28}
                        className={currentStreak > 0 ? 'text-white' : 'text-gray-500 dark:text-gray-600'}
                    />
                    {isNewRecord && currentStreak > 0 && (
                        <motion.div
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                        >
                            <Trophy size={12} className="text-yellow-900" />
                        </motion.div>
                    )}
                </motion.div>

                {/* Streak info */}
                <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                        <motion.span
                            className="text-3xl font-bold text-gray-900 dark:text-white"
                            key={currentStreak}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {currentStreak}
                        </motion.span>
                        <span className="text-gray-400 text-sm">
                            day{currentStreak !== 1 ? 's' : ''} streak
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                            Longest: {longestStreak} days
                        </span>
                        {isActiveToday && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                                ✓ Today completed
                            </span>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* At risk warning */}
            <AnimatePresence>
                {atRisk && (
                    <motion.div
                        className="flex items-center gap-2 mt-3 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <AlertTriangle size={16} className="text-amber-400" />
                        <span className="text-sm text-amber-300">
                            Your streak is at risk! Log some hours today to keep it going.
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
