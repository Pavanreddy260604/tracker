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
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>

                {/* Metrics Grid Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-4 rounded-xl bg-[#1c2128] border border-white/5 h-32 flex flex-col justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    ))}
                </div>

                {/* Progress Rings Skeleton */}
                <div className="flex flex-col md:flex-row gap-4 h-64">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-1 rounded-xl bg-[#1c2128] border border-white/5 flex items-center justify-center">
                            <Skeleton className="h-36 w-36 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error && !summary) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] p-6">
                <div className="max-w-md w-full text-center p-8 rounded-2xl bg-[#1c2128] border border-white/10">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-gray-500/15">
                        <AlertCircle size={32} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Failed to load dashboard</h2>
                    <p className="text-sm text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => {
                            clearError();
                            fetchDashboard();
                            fetchStreak();
                            fetchWeekly();
                            fetchInsights();
                        }}
                        className="px-6 py-3 rounded-xl font-medium bg-gray-700 text-white hover:bg-gray-800 transition-colors"
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
                        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-blue-300/80 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                            Pulse • Personalized
                        </p>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">Dashboard</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
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
                        className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-500/25 shadow-lg shadow-amber-500/10"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/15 border border-amber-500/30">
                                <AlertTriangle size={20} className="text-amber-200" />
                            </div>
                            <div>
                                <p className="font-semibold text-amber-100">No activity logged today</p>
                                <p className="text-sm text-amber-200/70">Log your hours to keep your streak</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowQuickLog(true)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-400/20 text-amber-50 border border-amber-400/30 hover:bg-amber-400/30 transition-colors"
                        >
                            Log Now
                        </button>
                    </motion.div>
                )}

                {/* Key Metrics Grid */}
                <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-gray-400">
                        <Activity size={16} />
                        Key Metrics
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* Current Streak */}
                        <MotionCard
                            className="relative overflow-hidden group p-5 bg-gradient-to-br from-white/6 via-white/3 to-transparent border border-white/10 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-gray-400">Streak</p>
                            <p className="text-4xl font-black text-white text-glow">{streak?.currentStreak || 0}</p>
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                                <Award size={12} />
                                <span>days</span>
                            </div>
                        </MotionCard>

                        {/* Today's Hours */}
                        <MotionCard
                            className="relative overflow-hidden group p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_35%)]" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-blue-200/80">Today</p>
                            <p className="text-4xl font-black text-white text-glow">{todayHours}h</p>
                            <div className={`flex items-center gap-1.5 mt-2 text-xs ${todayHours >= 6 ? 'text-green-400' : 'text-gray-200'}`}>
                                {todayHours >= 6 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span>{todayHours >= 11 ? 'Great!' : todayHours >= 6 ? 'On track' : 'Below target'}</span>
                            </div>
                        </MotionCard>

                        {/* Total Hours */}
                        <MotionCard
                            className="relative overflow-hidden group p-5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-purple-200/80">Total</p>
                            <p className="text-4xl font-black text-white text-glow">{insights?.totalHours || 0}h</p>
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-200">
                                <Clock size={12} />
                                <span>all time</span>
                            </div>
                        </MotionCard>

                        {/* Consistency */}
                        <MotionCard
                            className="relative overflow-hidden group p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-emerald-200/80">Consistency</p>
                            <p className="text-4xl font-black text-white text-glow">{insights?.consistencyPercent || 0}%</p>
                            <div className={`flex items-center gap-1.5 mt-2 text-xs ${(insights?.consistencyPercent || 0) >= 70 ? 'text-green-400' : 'text-gray-200'}`}>
                                {(insights?.consistencyPercent || 0) >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span>active ratio</span>
                        </div>
                    </MotionCard>
                    </div>
                </section>

                {/* Today's Progress */}
                {todayProgress && (
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-gray-400">
                            <Activity size={16} />
                            Today's Progress
                        </h2>

                        <div className="flex flex-col md:flex-row gap-4">
                            {/* DSA Ring */}
                            <div className="relative overflow-hidden group flex-1 p-6 rounded-2xl bg-gradient-to-br from-white/8 via-white/3 to-transparent border border-white/10 flex flex-col items-center justify-center shadow-lg shadow-blue-500/5">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                                {(summary?.summary.dsaDueCount || 0) > 0 && (
                                    <div className="absolute top-4 right-4 bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-xs font-bold border border-red-500/20 animate-pulse">
                                        {summary?.summary.dsaDueCount} Due
                                    </div>
                                )}
                                <CircularProgress
                                    value={todayProgress.targets.dsa.percent}
                                    size={140}
                                    strokeWidth={12}
                                    color="blue"
                                    showValue={true}
                                    label="DSA Hours"
                                    sublabel={`${todayProgress.targets.dsa.current} / ${todayProgress.targets.dsa.target}h`}
                                />
                            </div>

                            {/* Backend Ring */}
                            <div className="relative overflow-hidden group flex-1 p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/4 to-transparent border border-purple-500/15 flex flex-col items-center justify-center shadow-lg shadow-purple-500/10">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_35%)]" />
                                {(summary?.summary.backendDueCount || 0) > 0 && (
                                    <div className="absolute top-4 right-4 bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-xs font-bold border border-red-500/20 animate-pulse">
                                        {summary?.summary.backendDueCount} Due
                                    </div>
                                )}
                                <CircularProgress
                                    value={todayProgress.targets.backend.percent}
                                    size={140}
                                    strokeWidth={12}
                                    color="purple"
                                    showValue={true}
                                    label="Backend Hours"
                                    sublabel={`${todayProgress.targets.backend.current} / ${todayProgress.targets.backend.target}h`}
                                />
                            </div>

                            {/* Project Ring */}
                            <div className="relative overflow-hidden group flex-1 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/4 to-transparent border border-cyan-500/15 flex flex-col items-center justify-center shadow-lg shadow-cyan-500/10">
                                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                                <CircularProgress
                                    value={todayProgress.targets.project.percent}
                                    size={140}
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
                    <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-gray-400">
                        <Plus size={16} />
                        Quick Actions
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exercise Toggle */}
                    <MotionCard
                        className="relative overflow-hidden group p-5 bg-gradient-to-r from-white/6 via-white/2 to-transparent border border-white/10 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">Exercise Completed</p>
                                <p className="text-xs text-gray-500">Did you exercise today?</p>
                            </div>
                            <button
                                onClick={() => setShowQuickLog(true)}
                                className={`
                                    relative w-12 h-6 rounded-full transition-colors duration-200
                                    ${todayLog?.exerciseCompleted ? 'bg-green-500' : 'bg-gray-700'}
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
                        className="relative overflow-hidden group p-5 bg-gradient-to-r from-white/6 via-white/2 to-transparent border border-white/10 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">DSA Problems Solved</p>
                                <p className="text-xs text-gray-500">Today's count</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-300">
                                    {todayLog?.dsaProblemsSolved || 0}
                                </span>
                                <button
                                    onClick={() => setShowQuickLog(true)}
                                    className="p-2 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
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
                        <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-gray-400">
                            <Activity size={16} />
                            Insights
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights.strongestTopic && (
                                <Card className="p-4 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 shadow-lg">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-green-200">
                                        Strongest Topic
                                    </p>
                                    <p className="text-lg font-semibold text-gray-200">
                                        {insights.strongestTopic}
                                    </p>
                                </Card>
                            )}

                            {insights.weakestTopic && (
                                <Card className="p-4 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 shadow-lg">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 text-red-200">
                                        Needs Work
                                    </p>
                                    <p className="text-lg font-semibold text-gray-200">
                                        {insights.weakestTopic}
                                    </p>
                                </Card>
                            )}
                        </div>
                    </section>
                )}

            </div>

            {/* Quick Log Modal */}
            {showQuickLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 dark:bg-black/50 backdrop-blur-sm">
                    <motion.div
                        className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 shadow-2xl"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Log Today's Progress</h2>
                            <button
                                onClick={() => setShowQuickLog(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 transition-colors"
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
