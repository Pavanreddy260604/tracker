import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    RefreshCw,
    TrendingUp,
    Calendar,
    Target,
    Award,
    Clock,
    BarChart2
} from 'lucide-react';
import { Heatmap } from '../components/charts/Heatmap';
import { useDataStore } from '../stores/dataStore';
import { api } from '../services/api';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null;
    return (
        <div className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 shadow-lg">
            <p className="text-gray-900 dark:text-white font-medium text-sm mb-1">{label}</p>
            {payload.map((entry, index) => (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                    {entry.name}: {entry.value}h
                </p>
            ))}
        </div>
    );
};

export function Analytics() {
    const { weekly, streak, insights, fetchWeekly, fetchStreak, fetchInsights, fetchHeatmap, heatmap } = useDataStore();
    const [isLoading, setIsLoading] = useState(true);
    const [topicDistribution, setTopicDistribution] = useState<{ name: string; value: number }[]>([]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.all([
                    fetchWeekly(),
                    fetchStreak(),
                    fetchInsights(),
                    fetchHeatmap(new Date().getFullYear()),
                ]);

                // Fetch topic distribution
                const problems = await api.getDSAProblems(1, 100);
                const topicCounts: Record<string, number> = {};
                problems.problems.forEach(p => {
                    topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
                });
                setTopicDistribution(
                    Object.entries(topicCounts)
                        .map(([name, value]) => ({ name: name.replace('-', ' '), value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 6)
                );
            } catch (error) {
                console.error('Failed to load analytics:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw size={32} className="animate-spin text-gray-300" />
            </div>
        );
    }

    // Prepare weekly chart data
    const weeklyChartData = weekly.map(day => ({
        name: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
        DSA: day.dsaHours,
        Backend: day.backendHours,
        Project: day.projectHours,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your learning patterns and progress</p>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Current Streak', value: `${streak?.currentStreak || 0} days`, icon: Award, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/15' },
                    { label: 'Longest Streak', value: `${streak?.longestStreak || 0} days`, icon: Target, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/15' },
                    { label: 'Total Hours', value: `${insights?.totalHours || 0}h`, icon: Clock, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/15' },
                    { label: 'Consistency', value: `${insights?.consistencyPercent || 0}%`, icon: TrendingUp, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/15' },
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        className="p-5 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                            <stat.icon size={20} className={stat.color} />
                        </div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Weekly Activity Chart */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-2 mb-6">
                    <BarChart2 size={20} className="text-gray-500 dark:text-gray-300" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Activity</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="DSA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Backend" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Project" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-4">
                    {[
                        { label: 'DSA', color: '#3b82f6' },
                        { label: 'Backend', color: '#8b5cf6' },
                        { label: 'Project', color: '#06b6d4' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-gray-400">{item.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Topic Distribution */}
                <motion.div
                    className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Topic Distribution</h2>
                    {topicDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={topicDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {topicDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        return (
                                            <div className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2">
                                                <p className="text-gray-900 dark:text-white capitalize">{payload[0].name}</p>
                                                <p className="text-gray-500 dark:text-gray-400">{payload[0].value} problems</p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-500">
                            No problems tracked yet
                        </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                        {topicDistribution.map((topic, index) => (
                            <div key={topic.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-xs text-gray-400 capitalize">{topic.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Insights */}
                <motion.div
                    className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Insights</h2>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/10 border border-gray-200 dark:border-gray-500/20">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Strongest Topic</p>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 capitalize">
                                {insights?.strongestTopic?.replace('-', ' ') || 'Start solving problems!'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-500/10 border border-gray-200 dark:border-gray-500/20">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Needs More Practice</p>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-400 capitalize">
                                {insights?.weakestTopic?.replace('-', ' ') || 'Keep practicing!'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/10 border border-gray-200 dark:border-gray-500/20">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Daily Hours</p>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                {insights?.avgDailyHours || 0}h per day
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/10 border border-gray-200 dark:border-gray-500/20">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Problems Solved</p>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                {insights?.totalProblems || 0} problems
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Contribution Heatmap */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <div className="flex items-center gap-2 mb-6">
                    <Calendar size={20} className="text-gray-500 dark:text-gray-300" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{new Date().getFullYear()} Contribution Heatmap</h2>
                </div>
                <div className="overflow-x-auto">
                    <Heatmap data={heatmap} year={new Date().getFullYear()} />
                </div>
            </motion.div>
        </div>
    );
}
