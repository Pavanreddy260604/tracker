import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Clock,
    Activity,
    Award,
    AlertTriangle,
    Plus,
    AlertCircle,
    X
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { useDataStore } from '../stores/dataStore';
import { QuickLog } from '../components/forms/QuickLog';
import { CircularProgress } from '../components/ui/CircularProgress';
import { Card } from '../components/ui/Card';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from '../stores/toastStore';
import { AnimatedList } from '../components/ui/AnimatedList';
import { LiquidGlass } from '../components/ui/LiquidGlass';

const MotionCard = motion(Card);

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
            <div className="max-w-7xl mx-auto w-full space-y-10">
                {/* Page Header with Quick Log Button */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-accent-primary dark:text-blue-300/80 bg-accent-soft px-3 py-1 rounded-full border border-accent-soft">
                            Pulse • Personalized
                        </p>
                        <h1 className="text-3xl font-black text-text-primary leading-tight">Dashboard</h1>
                        <p className="text-sm text-text-secondary">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowQuickLog(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
                    >
                        <Plus size={18} />
                        Quick Log
                    </button>
                </div>

                {/* Alert Banner when no activity logged */}
                {todayHours === 0 && (
                    <motion.div
                        className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 bg-status-warning/10 border border-status-warning/20 shadow-lg shadow-status-warning/5"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-status-warning/10 border border-status-warning/25">
                                <AlertTriangle size={20} className="text-status-warning" />
                            </div>
                            <div>
                                <p className="font-semibold text-status-warning">No activity logged today</p>
                                <p className="text-sm text-status-warning/80">Log your hours to keep your streak</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowQuickLog(true)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold bg-status-warning/20 text-status-warning border border-status-warning/30 hover:bg-status-warning/30 transition-colors"
                        >
                            Log Now
                        </button>
                    </motion.div>
                )}

                {/* Key Metrics Grid */}
                <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-text-secondary">
                        <Activity size={16} />
                        Key Metrics
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide max-[375px]:flex max-[375px]:flex-nowrap">
                        {/* Current Streak */}
                        <LiquidGlass>
                            <div className="p-4 sm:p-5 min-w-[140px] max-[375px]:shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-text-secondary">Streak</p>
                                <p className="text-3xl sm:text-4xl font-black text-text-primary text-glow">{streak?.currentStreak || 0}</p>
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-text-secondary">
                                    <Award size={12} />
                                    <span>days</span>
                                </div>
                            </div>
                        </LiquidGlass>

                        {/* Today's Hours */}
                        <LiquidGlass>
                            <div className="p-4 sm:p-5 min-w-[140px] max-[375px]:shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-accent-primary">Today</p>
                                <p className="text-3xl sm:text-4xl font-black text-text-primary text-glow">{todayHours}h</p>
                                <div className={`flex items-center gap-1.5 mt-2 text-xs ${todayHours >= 6 ? 'text-status-ok' : 'text-text-secondary'}`}>
                                    {todayHours >= 6 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    <span>{todayHours >= 11 ? 'Great!' : todayHours >= 6 ? 'On track' : 'Below target'}</span>
                                </div>
                            </div>
                        </LiquidGlass>

                        {/* Total Hours */}
                        <LiquidGlass>
                            <div className="p-4 sm:p-5 min-w-[140px] max-[375px]:shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-text-secondary">Total</p>
                                <p className="text-3xl sm:text-4xl font-black text-text-primary text-glow">{insights?.totalHours || 0}h</p>
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-text-secondary">
                                    <Clock size={12} />
                                    <span>all time</span>
                                </div>
                            </div>
                        </LiquidGlass>

                        {/* Consistency */}
                        <LiquidGlass>
                            <div className="p-4 sm:p-5 min-w-[140px] max-[375px]:shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-text-secondary">Consistency</p>
                                <p className="text-3xl sm:text-4xl font-black text-text-primary text-glow">{insights?.consistencyPercent || 0}%</p>
                                <div className={`flex items-center gap-1.5 mt-2 text-xs ${(insights?.consistencyPercent || 0) >= 70 ? 'text-status-ok' : 'text-text-secondary'}`}>
                                    {(insights?.consistencyPercent || 0) >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    <span>active ratio</span>
                                </div>
                            </div>
                        </LiquidGlass>
                    </div>
                </section>

                {/* Today's Progress */}
                {todayProgress && (
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-text-secondary">
                            <Activity size={16} />
                            Today's Progress
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* DSA Ring */}
                            <div className="relative overflow-hidden group p-5 sm:p-6 rounded-2xl bg-console-surface border border-border-subtle flex flex-col items-center justify-center shadow-premium">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                                {(summary?.summary.dsaDueCount || 0) > 0 && (
                                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-status-error/10 text-status-error px-2 py-1 rounded-full text-xs font-bold border border-status-error/20 animate-pulse">
                                        {summary?.summary.dsaDueCount} Due
                                    </div>
                                )}
                                <CircularProgress
                                    value={todayProgress.targets.dsa.percent}
                                    size={120}
                                    strokeWidth={12}
                                    color="blue"
                                    showValue={true}
                                    label="DSA Hours"
                                    sublabel={`${todayProgress.targets.dsa.current} / ${todayProgress.targets.dsa.target}h`}
                                />
                            </div>

                            {/* Backend Ring */}
                            <div className="relative overflow-hidden group p-5 sm:p-6 rounded-2xl bg-console-surface border border-accent-primary/20 flex flex-col items-center justify-center shadow-premium">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_35%)]" />
                                {(summary?.summary.backendDueCount || 0) > 0 && (
                                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-status-error/10 text-status-error px-2 py-1 rounded-full text-xs font-bold border border-status-error/20 animate-pulse">
                                        {summary?.summary.backendDueCount} Due
                                    </div>
                                )}
                                <CircularProgress
                                    value={todayProgress.targets.backend.percent}
                                    size={120}
                                    strokeWidth={12}
                                    color="purple"
                                    showValue={true}
                                    label="Backend Hours"
                                    sublabel={`${todayProgress.targets.backend.current} / ${todayProgress.targets.backend.target}h`}
                                />
                            </div>

                            {/* Project Ring */}
                            <div className="relative overflow-hidden group p-5 sm:p-6 rounded-2xl bg-console-surface border border-accent-primary/20 flex flex-col items-center justify-center shadow-premium">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                                <CircularProgress
                                    value={todayProgress.targets.project.percent}
                                    size={120}
                                    strokeWidth={12}
                                    color="cyan"
                                    showValue={true}
                                    label="Project Hours"
                                    sublabel={`${todayProgress.targets.project.current} / ${todayProgress.targets.project.target}h`}
                                />
                            </div>
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-text-secondary">
                        <Plus size={16} />
                        Quick Actions
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Exercise Toggle */}
                        <MotionCard
                            className="relative overflow-hidden group p-4 sm:p-5 bg-console-surface border border-border-subtle shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-text-primary">Exercise Completed</p>
                                    <p className="text-xs text-text-secondary">Did you exercise today?</p>
                                </div>
                                <button
                                    onClick={() => setShowQuickLog(true)}
                                    className={`
                                    relative w-12 h-6 rounded-full transition-colors duration-200
                                    ${todayLog?.exerciseCompleted ? 'bg-status-ok' : 'bg-console-surface-3'}
                                `}
                                >
                                    <span
                                        className={`
                                        absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                                        transition-transform duration-200 ease-in-out
                                        ${todayLog?.exerciseCompleted ? 'translate-x-6' : 'translate-x-0'}
                                    `}
                                    />
                                </button>
                            </div>
                        </MotionCard>

                        {/* DSA Problems Solved */}
                        <MotionCard
                            className="relative overflow-hidden group p-4 sm:p-5 bg-console-surface border border-border-subtle shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-text-primary">DSA Problems Solved</p>
                                    <p className="text-xs text-text-secondary">Today's count</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-text-primary">
                                        {todayLog?.dsaProblemsSolved || 0}
                                    </span>
                                    <button
                                        onClick={() => setShowQuickLog(true)}
                                        className="p-2 rounded-lg bg-console-surface-2 text-text-secondary hover:bg-console-surface-3 hover:text-text-primary transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        </MotionCard>
                    </div>
                </section>

                {/* Insights */}
                {insights && (insights.strongestTopic || insights.weakestTopic) && (
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-text-secondary">
                            <Activity size={16} />
                            Insights
                        </h2>

                        <AnimatedList
                            showGradients={false}
                            enableArrowNavigation={false}
                            staggerDelay={80}
                            items={[
                                insights.strongestTopic && (
                                    <Card key="strong" className="p-4 bg-status-ok/10 border border-status-ok/20 shadow-premium">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-status-ok">
                                            Strongest Topic
                                        </p>
                                        <p className="text-lg font-semibold text-text-primary">
                                            {insights.strongestTopic}
                                        </p>
                                    </Card>
                                ),
                                insights.weakestTopic && (
                                    <Card key="weak" className="p-4 bg-status-error/10 border border-status-error/20 shadow-premium">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-status-error">
                                            Needs Work
                                        </p>
                                        <p className="text-lg font-semibold text-text-primary">
                                            {insights.weakestTopic}
                                        </p>
                                    </Card>
                                ),
                            ].filter(Boolean) as React.ReactNode[]}
                        />
                    </section>
                )}

            </div>

            {/* Quick Log Modal */}
            {showQuickLog && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-console-bg/60 backdrop-blur-sm">
                    <motion.div
                        className="w-full sm:max-w-md p-5 sm:p-6 rounded-t-2xl sm:rounded-2xl bg-console-surface border border-border-subtle shadow-premium max-h-[85dvh] overflow-y-auto"
                        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-text-primary">Log Today's Progress</h2>
                            <button
                                onClick={() => setShowQuickLog(false)}
                                className="p-2 rounded-lg hover:bg-console-surface-2 text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
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
                    </motion.div>
                </div>
            )}
        </>
    );
}
