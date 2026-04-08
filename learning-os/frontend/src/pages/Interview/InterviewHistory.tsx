import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, Trophy, Play, History, TrendingUp, Target, Timer } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export function InterviewHistory() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<InterviewSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.getInterviewHistory()
            .then(data => setSessions(data))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    const stats = useMemo(() => {
        const total = sessions.length || 1;
        const submitted = sessions.filter(s => s.status === 'submitted').length;
        const avgScore = Math.round(
            sessions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / total
        );
        const avgDuration = Math.round(
            sessions.reduce((acc, s) => acc + (s.config?.duration || 0), 0) / total
        );
        return { submitted, avgScore, avgDuration };
    }, [sessions]);

    if (isLoading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest animate-pulse">Retrieving Archives...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 py-8 px-6">
            <div className="relative p-10 rounded-[3rem] bg-console-surface/40 border border-white/5 overflow-hidden group">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent-primary/5 to-transparent pointer-events-none" />
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-12">
                    <div className="space-y-6 max-w-2xl">
                        <div className="flex items-center gap-3">
                             <Badge variant="info" className="bg-accent-primary/10 text-accent-primary border-accent-primary/20 font-black uppercase tracking-[0.2em] text-[9px] px-3">
                                Mission Log
                             </Badge>
                             <div className="h-px w-12 bg-white/10" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-5xl font-black text-text-primary tracking-tighter">
                                Interview <span className="text-accent-primary">Vault</span>
                            </h1>
                            <p className="text-lg text-text-muted font-medium leading-relaxed">
                                Decrypt your past performance metrics, analyze the growth trajectory, and re-engage with the core simulation protocols.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4 pt-2">
                            <Button
                                onClick={() => navigate('/interview/setup')}
                                className="h-12 px-8 bg-accent-primary text-white shadow-xl shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest rounded-2xl"
                            >
                                <Play className="w-4 h-4 mr-2" fill="currentColor" /> Initialize Session
                            </Button>
                            <Button
                                onClick={() => navigate('/interview/history')}
                                variant="secondary"
                                className="h-12 px-8 bg-white/5 border-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest rounded-2xl"
                            >
                                <History className="w-4 h-4 mr-2" /> Global Archives
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:w-[450px]">
                        {[
                            { label: 'Completed', value: stats.submitted, icon: Target, color: 'text-status-ok' },
                            { label: 'Avg Efficiency', value: `${stats.avgScore}%`, icon: TrendingUp, color: 'text-accent-primary' },
                            { label: 'Air Time', value: `${stats.avgDuration}m`, icon: Timer, color: 'text-amber-500' }
                        ].map((stat, i) => (
                            <div key={i} className="p-6 rounded-3xl bg-console-bg/60 border border-white/5 backdrop-blur-sm group-hover:border-white/10 transition-colors">
                                <stat.icon className={cn("w-5 h-5 mb-4", stat.color)} />
                                <div className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</div>
                                <div className="text-2xl font-black text-text-primary tracking-tighter">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="p-20 rounded-[3rem] bg-console-surface/20 border-2 border-dashed border-white/5 text-center space-y-8">
                    <div className="w-24 h-24 mx-auto rounded-3xl bg-accent-primary/5 flex items-center justify-center border border-accent-primary/10">
                        <Trophy className="w-12 h-12 text-accent-primary opacity-40" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-2xl font-black text-text-primary tracking-tight">Archives Empty</h3>
                        <p className="text-text-muted font-medium max-w-sm mx-auto leading-relaxed">
                            No logs found in the secure vault. Initialize your first simulation protocol to begin tracking performance data.
                        </p>
                    </div>
                    <div className="flex justify-center gap-4">
                        <Button
                            onClick={() => navigate('/interview/setup')}
                            className="h-12 px-10 bg-accent-primary text-white shadow-xl shadow-accent-primary/20 text-xs font-black uppercase tracking-widest rounded-2xl"
                        >
                            <Play className="w-4 h-4 mr-2" fill="currentColor" /> Launch Simulation
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {sessions.map((session) => {
                        const score = Math.max(0, session.totalScore || 0);
                        const isHighPerformance = score >= 80;
                        const isMediumPerformance = score >= 50 && score < 80;

                        return (
                            <motion.div
                                key={session._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => navigate(
                                session.status === 'submitted' 
                                    ? `/interview/${session._id}/analytics`
                                    : `/interview/room/${session._id}`
                            )}
                                className="p-8 rounded-[2.5rem] bg-console-surface border border-white/5 hover:border-accent-primary/30 hover:bg-console-surface-2 transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex items-start justify-between gap-6 relative z-10">
                                    <div className="space-y-6">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Badge 
                                                className={cn(
                                                    "font-black uppercase tracking-[0.2em] text-[9px] px-3",
                                                    session.status === 'submitted' ? 'bg-status-ok/10 text-status-ok border-status-ok/20' : 'bg-accent-primary/10 text-accent-primary border-accent-primary/20'
                                                )}
                                            >
                                                {session.status}
                                            </Badge>
                                            <div className="flex items-center gap-4 text-text-muted/60">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                                                    <Calendar size={12} className="text-text-muted" />
                                                    {formatDate(session.startedAt)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                                                    <Clock size={12} className="text-text-muted" />
                                                    {session.config.duration}m
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-white/5 border-white/5 text-[9px] font-black uppercase tracking-widest">{session.config.difficulty}</Badge>
                                                <Badge variant="secondary" className="bg-white/5 border-white/5 text-[9px] font-black uppercase tracking-widest">{session.config.language || 'JAVASCRIPT'}</Badge>
                                            </div>
                                            <div className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Deployment Protocol v1.4</div>
                                        </div>
                                    </div>

                                    <div className="text-right space-y-1">
                                        <div className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40">System Score</div>
                                        <div className={cn(
                                            "text-4xl font-black tracking-tighter",
                                            isHighPerformance ? "text-status-ok" : isMediumPerformance ? "text-amber-500" : "text-status-error"
                                        )}>
                                            {score}<span className="text-lg opacity-40 ml-0.5">%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 relative pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Efficiency Coefficient</span>
                                        <span className="text-[9px] font-black text-text-primary mb-1">{score}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(score, 100)}%` }}
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                isHighPerformance ? "bg-status-ok" : isMediumPerformance ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "bg-status-error shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                                            )}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
