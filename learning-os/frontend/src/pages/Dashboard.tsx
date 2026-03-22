import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Award,
    AlertTriangle,
    Plus,
    AlertCircle,
    Zap,
    Brain,
    Flame,
    Lightbulb,
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { useDataStore } from '../stores/dataStore';
import { QuickLog } from '../components/forms/QuickLog';
import { Modal } from '../components/ui/Modal';
import { CircularProgress } from '../components/ui/CircularProgress';
import { Card } from '../components/ui/Card';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from '../stores/toastStore';
import { LiquidGlass } from '../components/ui/LiquidGlass';

const MotionCard = motion.create(Card);

export function Dashboard() {
    const {
        summary,
        streak,
        insights,
        todayLog,
        isLoading,
        error,
        fetchDashboard,
        fetchStreak,
        fetchWeekly,
        fetchInsights,
        fetchTodayLog,
        clearError,
    } = useDataStore();

    const [showQuickLog, setShowQuickLog] = useState(false);

    // Keyboard shortcuts
    useKeyboardShortcuts([
        { key: 'n', ctrl: true, action: () => setShowQuickLog(true), description: 'Open Quick Log' },
        { key: 'Escape', action: () => setShowQuickLog(false), description: 'Close Quick Log' },
    ]);

    useEffect(() => {
        const loadDashboardData = async () => {
            // Parallelize all fetch requests
            await Promise.all([
                fetchDashboard(),
                fetchStreak(),
                fetchWeekly(),
                fetchInsights(),
                fetchTodayLog()
            ]);
        };
        loadDashboardData();
    }, []);

    const todayProgress = summary?.today;
    const todayHours = todayProgress?.log?.totalHours || 0;

    // Loading state
    if (isLoading && !summary && !streak) {
        return (
            <div className="space-y-6 animate-pulse">
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>

                {/* Metrics Grid Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-4 rounded-xl bg-console-surface border border-border-subtle h-28 sm:h-32 flex flex-col justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 sm:h-10 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    ))}
                </div>

                {/* Progress Rings Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 sm:h-64 rounded-xl bg-console-surface border border-border-subtle flex items-center justify-center">
                            <Skeleton className="h-28 w-28 sm:h-36 sm:w-36 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error && !summary) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] p-4 sm:p-6">
                <div className="max-w-md w-full text-center p-6 sm:p-8 rounded-2xl bg-console-surface border border-border-subtle">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-console-surface-2 border border-border-subtle">
                        <AlertCircle size={32} className="text-text-secondary" />
                    </div>
                    <h2 className="text-xl font-semibold text-text-primary mb-2">Failed to load dashboard</h2>
                    <p className="text-sm text-text-secondary mb-6">{error}</p>
                    <button
                        onClick={() => {
                            clearError();
                            fetchDashboard();
                            fetchStreak();
                            fetchWeekly();
                            fetchInsights();
                        }}
                        className="px-6 py-3 rounded-xl font-medium bg-console-surface-2 text-text-primary hover:bg-console-surface-3 transition-colors border border-border-subtle"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto w-full space-y-3 sm:space-y-5">
                {/* Page Header — compact */}
                <div className="flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Dashboard</h1>
                        <p className="text-[10px] sm:text-xs text-text-secondary font-medium uppercase tracking-widest opacity-70">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </motion.div>
                    
                    <div className="flex items-center gap-2">
                        {streak?.currentStreak && streak.currentStreak >= 3 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-wider"
                            >
                                <Flame size={14} className="animate-pulse" />
                                {streak.currentStreak} Day Heat!
                            </motion.div>
                        )}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowQuickLog(true)}
                            className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all border border-white/10"
                        >
                            <Plus size={16} />
                            Quick Log
                        </motion.button>
                    </div>
                </div>

                {/* Alert Banner — compact */}
                {todayHours === 0 && (
                    <motion.div
                        className="px-3 py-2.5 rounded-xl flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">No activity logged today</p>
                        <button
                            onClick={() => setShowQuickLog(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors whitespace-nowrap"
                        >
                            Log Now
                        </button>
                    </motion.div>
                )}

                {/* Key Metrics Grid */}
                <section>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { label: 'Streak', value: `${streak?.currentStreak || 0}`, sub: streak?.streakAtRisk ? 'At Risk!' : 'Active', icon: Flame, color: streak?.currentStreak && streak.currentStreak > 0 ? 'text-orange-500' : 'text-text-disabled' },
                            { label: 'Today', value: `${todayHours}h`, sub: todayHours >= 2 ? 'Great!' : todayHours >= 0.5 ? 'Active' : 'Missing', icon: Zap, color: todayHours >= 0.5 ? 'text-status-ok' : 'text-accent-primary' },
                            { label: 'Total', value: `${insights?.totalHours || 0}h`, sub: 'all time', icon: Award, color: 'text-text-primary' },
                            { label: 'Focus', value: `${insights?.consistencyPercent || 0}%`, sub: 'consistency', icon: Brain, color: 'text-text-primary' },
                        ].map((metric, i) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.5 }}
                                className="relative group min-w-[140px]"
                            >
                                <LiquidGlass className={`premium-card glow-border relative overflow-hidden h-full ${metric.label === 'Streak' && streak?.currentStreak && streak.currentStreak > 0 ? 'before:absolute before:inset-0 before:bg-orange-500/5 before:opacity-50' : ''}`}>
                                    <div className="p-4 sm:p-5 relative z-10">
                                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5 text-text-secondary opacity-60">{metric.label}</p>
                                        <div className="flex items-baseline gap-1">
                                            <p className="text-2xl sm:text-4xl font-black text-text-primary text-glow tracking-tighter">{metric.value}</p>
                                            {metric.label === 'Streak' && <span className="text-xs font-bold text-text-secondary opacity-40">days</span>}
                                        </div>
                                        <div className={`flex items-center gap-1.5 mt-2 text-[10px] sm:text-xs font-semibold ${metric.color}`}>
                                            <metric.icon size={12} className={metric.label === 'Streak' && streak?.currentStreak ? 'animate-pulse' : ''} />
                                            <span className="truncate opacity-80">{metric.sub}</span>
                                        </div>
                                    </div>
                                </LiquidGlass>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Today's Progress */}
                {todayProgress && (
                    <section>
                        <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-secondary mb-4 opacity-60">Today's Progress</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { color: 'blue', val: todayProgress.targets.dsa.percent, label: 'DSA', sub: `${todayProgress.targets.dsa.current}/${todayProgress.targets.dsa.target}h`, due: summary?.summary.dsaDueCount },
                                { color: 'purple', val: todayProgress.targets.backend.percent, label: 'Backend', sub: `${todayProgress.targets.backend.current}/${todayProgress.targets.backend.target}h`, due: summary?.summary.backendDueCount },
                                { color: 'cyan', val: todayProgress.targets.project.percent, label: 'Project', sub: `${todayProgress.targets.project.current}/${todayProgress.targets.project.target}h`, due: 0 },
                            ].map((ring, i) => (
                                <motion.div
                                    key={ring.label}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
                                >
                                    <LiquidGlass className="premium-card glow-border p-6 flex flex-col items-center justify-center relative shadow-premium min-h-[180px]">
                                        {ring.due > 0 && (
                                            <div className="absolute top-4 right-4 bg-status-error/15 text-status-error px-2 py-0.5 rounded-full text-[10px] font-bold border border-status-error/20 animate-pulse z-10 shadow-lg shadow-status-error/5">
                                                {ring.due} Due
                                            </div>
                                        )}
                                        <CircularProgress
                                            value={ring.val}
                                            size={window.innerWidth < 640 ? 80 : 110}
                                            strokeWidth={window.innerWidth < 640 ? 8 : 11}
                                            color={ring.color as any}
                                            showValue={true}
                                            label={ring.label}
                                            sublabel={ring.sub}
                                        />
                                    </LiquidGlass>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Quick Actions</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Exercise Toggle */}
                        <MotionCard
                            className="relative overflow-hidden group p-3 sm:p-5 bg-console-surface border border-border-subtle shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-text-primary">Exercise Completed</p>
                                    <p className="text-[10px] sm:text-xs text-text-secondary">Did you exercise today?</p>
                                </div>
                                <button
                                    onClick={() => setShowQuickLog(true)}
                                    className={`
                                    relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors duration-200
                                    ${todayLog?.exerciseCompleted ? 'bg-status-ok' : 'bg-console-surface-3'}
                                `}
                                >
                                    <span
                                        className={`
                                        absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-white shadow-md
                                        transition-transform duration-200 ease-in-out
                                        ${todayLog?.exerciseCompleted ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'}
                                    `}
                                    />
                                </button>
                            </div>
                        </MotionCard>

                        {/* DSA Problems Solved */}
                        <MotionCard
                            className="relative overflow-hidden group p-3 sm:p-5 bg-console-surface border border-border-subtle shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-text-primary">DSA Problems Solved</p>
                                    <p className="text-[10px] sm:text-xs text-text-secondary">Today's count</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl sm:text-2xl font-bold text-text-primary">
                                        {todayLog?.dsaProblemsSolved || 0}
                                    </span>
                                    <button
                                        onClick={() => setShowQuickLog(true)}
                                        className="p-1.5 sm:p-2 rounded-lg bg-console-surface-2 text-text-secondary hover:bg-console-surface-3 hover:text-text-primary transition-colors"
                                    >
                                        <Plus size={16} className="w-4 h-4 sm:w-4 sm:h-4" />
                                    </button>
                                </div>
                            </div>
                        </MotionCard>
                    </div>
                </section>

                {/* Insights & Tips */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <section className="lg:col-span-2">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4 opacity-60 italic">Psychology Insights</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {insights?.strongestTopic && (
                                <LiquidGlass key="strong" className="p-4 bg-status-ok/5 border border-status-ok/20 shadow-premium group hover:bg-status-ok/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Award size={14} className="text-status-ok" />
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-status-ok">Mastery Field</p>
                                    </div>
                                    <p className="text-lg font-bold text-text-primary truncate">
                                        {insights.strongestTopic}
                                    </p>
                                    <p className="text-[10px] text-text-secondary mt-1 italic">Highest confidence & accuracy</p>
                                </LiquidGlass>
                            )}
                            {insights?.weakestTopic && (
                                <LiquidGlass key="weak" className="p-4 bg-status-error/5 border border-status-error/20 shadow-premium group hover:bg-status-error/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Brain size={14} className="text-status-error" />
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-status-error">Growth Area</p>
                                    </div>
                                    <p className="text-lg font-bold text-text-primary truncate">
                                        {insights.weakestTopic}
                                    </p>
                                    <p className="text-[10px] text-text-secondary mt-1 italic">Prioritize for next review session</p>
                                </LiquidGlass>
                            )}
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4 opacity-60 italic">Weekly Wisdom</h2>
                        <LiquidGlass className="p-5 border-border-subtle bg-console-surface shadow-premium h-full relative overflow-hidden group">
                            <Lightbulb size={24} className="text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
                            <h3 className="text-sm font-bold text-text-primary mb-2">The Feynman Technique</h3>
                            <p className="text-xs text-text-secondary leading-relaxed italic">
                                "If you can't explain it simply, you don't understand it well enough." Try the 'Simple Explanation' field in your topics!
                            </p>
                            <div className="absolute -bottom-2 -right-2 opacity-5 scale-150 pointer-events-none">
                                <Zap size={80} />
                            </div>
                        </LiquidGlass>
                    </section>
                </div>
            </div >

            {/* Quick Log Modal */}
            <Modal
                isOpen={showQuickLog}
                onClose={() => setShowQuickLog(false)}
                title="Log Today's Progress"
                size="md"
            >
                <QuickLog
                    initialValues={todayLog ? {
                        dsaHours: todayLog.dsaHours,
                        backendHours: todayLog.backendHours,
                        projectHours: todayLog.projectHours,
                        exerciseCompleted: todayLog.exerciseCompleted,
                        sleepHours: todayLog.sleepHours,
                        dsaProblemsSolved: todayLog.dsaProblemsSolved,
                    } : undefined}
                    onSuccess={() => {
                        setShowQuickLog(false);
                        toast.success('Progress logged successfully!');
                        fetchDashboard();
                        fetchStreak();
                        fetchTodayLog();
                    }}
                />
            </Modal>
        </>
    );
}
