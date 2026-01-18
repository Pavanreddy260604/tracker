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
            {/* Page Header with Quick Log Button */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <button
                    onClick={() => setShowQuickLog(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-900 dark:bg-gray-700 text-white hover:bg-black dark:hover:bg-gray-800 transition-colors"
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Quick Log</span>
                </button>
            </div>

            {/* Alert Banner when no activity logged */}
            {todayHours === 0 && (
                <motion.div
                    className="mb-5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-500/10 border border-amber-500/30"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-500/20">
                            <AlertTriangle size={20} className="text-gray-300" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-300">No activity logged today</p>
                            <p className="text-sm text-blue-300/70">Log your hours to keep your streak</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowQuickLog(true)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30 transition-colors"
                    >
                        Log Now
                    </button>
                </motion.div>
            )}

            {/* Key Metrics Grid */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-gray-400">
                    <Activity size={16} />
                    Key Metrics
                </h2>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    {/* Current Streak */}
                    <MotionCard
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <p className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-500">Streak</p>
                        <p className="text-3xl font-bold text-white text-glow">{streak?.currentStreak || 0}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                            <Award size={12} />
                            <span>days</span>
                        </div>
                    </MotionCard>

                    {/* Today's Hours */}
                    <MotionCard
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <p className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-500">Today</p>
                        <p className="text-3xl font-bold text-white text-glow">{todayHours}h</p>
                        <div className={`flex items-center gap-1.5 mt-2 text-xs ${todayHours >= 6 ? 'text-green-400' : 'text-gray-400'}`}>
                            {todayHours >= 6 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span>{todayHours >= 11 ? 'Great!' : todayHours >= 6 ? 'On track' : 'Below target'}</span>
                        </div>
                    </MotionCard>

                    {/* Total Hours */}
                    <MotionCard
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <p className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-500">Total</p>
                        <p className="text-3xl font-bold text-white text-glow">{insights?.totalHours || 0}h</p>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>all time</span>
                        </div>
                    </MotionCard>

                    {/* Consistency */}
                    <MotionCard
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                    >
                        <p className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-500">Consistency</p>
                        <p className="text-3xl font-bold text-white text-glow">{insights?.consistencyPercent || 0}%</p>
                        <div className={`flex items-center gap-1.5 mt-2 text-xs ${(insights?.consistencyPercent || 0) >= 70 ? 'text-green-400' : 'text-gray-400'}`}>
                            {(insights?.consistencyPercent || 0) >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span>active ratio</span>
                        </div>
                    </MotionCard>
                </div>
            </section>

            {/* Today's Progress */}
            {todayProgress && (
                <section className="mb-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-gray-400">
                        <Activity size={16} />
                        Today's Progress
                    </h2>

                    <div className="flex flex-col md:flex-row gap-4">
                        {/* DSA Ring */}
                        <div className="flex-1 p-6 rounded-2xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center relative">
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
                        <div className="flex-1 p-6 rounded-2xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center relative">
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
                        <div className="flex-1 p-6 rounded-2xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center">
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
            <section className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-gray-400">
                    <Plus size={16} />
                    Quick Actions
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exercise Toggle */}
                    <MotionCard
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
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
                        className="p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
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
                <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-gray-400">
                        <Activity size={16} />
                        Insights
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.strongestTopic && (
                            <Card className="p-4 bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10">
                                <p className="text-xs font-medium uppercase tracking-wide mb-2 text-green-400">
                                    Strongest Topic
                                </p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {insights.strongestTopic}
                                </p>
                            </Card>
                        )}

                        {insights.weakestTopic && (
                            <Card className="p-4 bg-gradient-to-br from-red-500/5 to-transparent border-red-500/10">
                                <p className="text-xs font-medium uppercase tracking-wide mb-2 text-red-400">
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
