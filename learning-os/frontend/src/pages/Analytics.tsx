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
import { useMobile } from '../hooks/useMobile';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null;
    return (
        <div className="bg-console-surface border border-border-subtle rounded-lg px-3 py-2 shadow-premium backdrop-blur-md">
            <p className="text-text-primary font-bold text-sm mb-1">{label}</p>
            {payload.map((entry, index) => (
                <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                    {entry.name}: {entry.value}h
                </p>
            ))}
        </div>
    );
};

export function Analytics() {
    const { weekly, streak, insights, fetchWeekly, fetchStreak, fetchInsights, fetchHeatmap, heatmap } = useDataStore();
    const { isMobile } = useMobile();
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
                <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
                <p className="text-sm text-text-secondary mt-1">Track your learning patterns and progress</p>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Current Streak', value: `${streak?.currentStreak || 0} days`, icon: Award, color: 'text-accent-primary', bg: 'bg-accent-soft' },
                    { label: 'Longest Streak', value: `${streak?.longestStreak || 0} days`, icon: Target, color: 'text-accent-secondary', bg: 'bg-accent-soft' },
                    { label: 'Total Hours', value: `${insights?.totalHours || 0}h`, icon: Clock, color: 'text-status-ok', bg: 'bg-accent-soft' },
                    { label: 'Consistency', value: `${insights?.consistencyPercent || 0}%`, icon: TrendingUp, color: 'text-status-warning', bg: 'bg-accent-soft' },
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        className="p-5 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <div className={`w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center mb-3 shadow-inner ${stat.color}`}>
                            <stat.icon size={20} />
                        </div>
                        <p className="text-[10px] text-text-secondary uppercase tracking-[0.1em] font-bold mb-1 opacity-60">{stat.label}</p>
                        <p className={`text-2xl font-black text-text-primary text-glow`}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Weekly Activity Chart */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-2 mb-6 opacity-60">
                    <BarChart2 size={16} className="text-accent-primary" />
                    <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">Weekly Activity</h2>
                </div>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
                    <BarChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border-subtle opacity-30" vertical={false} />
                        <XAxis dataKey="name" stroke="currentColor" className="text-text-secondary" fontSize={12} axisLine={false} tickLine={false} />
                        <YAxis stroke="currentColor" className="text-text-secondary" fontSize={12} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--console-surface-2)', opacity: 0.5 }} />
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
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{item.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Topic Distribution */}
                <motion.div
                    className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-2 mb-6 opacity-60">
                        <TrendingUp size={16} className="text-accent-secondary" />
                        <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">Topic Distribution</h2>
                    </div>
                    {topicDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                            <PieChart>
                                <Pie
                                    data={topicDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={isMobile ? 45 : 60}
                                    outerRadius={isMobile ? 70 : 90}
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
                                            <div className="bg-console-surface border border-border-subtle rounded-lg px-3 py-2 shadow-premium">
                                                <p className="text-text-primary font-bold capitalize">{payload[0].name}</p>
                                                <p className="text-text-secondary text-sm">{payload[0].value} problems</p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-text-disabled italic">
                            No problems tracked yet
                        </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                        {topicDistribution.map((topic, index) => (
                            <div key={topic.name} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-[10px] text-text-secondary uppercase tracking-tight font-bold">{topic.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Insights */}
                <motion.div
                    className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="flex items-center gap-2 mb-6 opacity-60">
                        <Target size={16} className="text-status-ok" />
                        <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">Strategic Insights</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-console-surface-2 border border-border-subtle">
                            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Strongest Topic</p>
                            <p className="text-lg font-bold text-text-primary capitalize">
                                {insights?.strongestTopic?.replace('-', ' ') || 'Start solving problems!'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-console-surface-2 border border-border-subtle">
                            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Needs More Practice</p>
                            <p className="text-lg font-bold text-text-primary capitalize">
                                {insights?.weakestTopic?.replace('-', ' ') || 'Keep practicing!'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-console-surface-2 border border-border-subtle">
                            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Average Daily Hours</p>
                            <p className="text-lg font-bold text-text-primary">
                                {insights?.avgDailyHours || 0}h per day
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-console-surface-2 border border-border-subtle">
                            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Total Problems Solved</p>
                            <p className="text-lg font-bold text-text-primary">
                                {insights?.totalProblems || 0} problems
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Contribution Heatmap */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <div className="flex items-center gap-2 mb-6 opacity-60">
                    <Calendar size={16} className="text-accent-primary" />
                    <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">{new Date().getFullYear()} Contribution Heatmap</h2>
                </div>
                <div className="overflow-x-auto">
                    <Heatmap data={heatmap} year={new Date().getFullYear()} />
                </div>
            </motion.div>
        </div>
    );
}
