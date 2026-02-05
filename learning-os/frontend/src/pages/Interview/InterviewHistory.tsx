import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, Trophy, ArrowRight, Play } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession } from '../../services/api';

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
        const completed = sessions.filter(s => s.status === 'completed').length;
        const avgScore = Math.round(
            sessions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / total
        );
        const avgDuration = Math.round(
            sessions.reduce((acc, s) => acc + (s.config?.duration || 0), 0) / total
        );
        return { completed, avgScore, avgDuration };
    }, [sessions]);

    const activeSession = sessions.find(s => s.status === 'in-progress');

    if (isLoading) return <div className="sw-page text-center sw-muted">Loading your interviews…</div>;

    return (
        <div className="sw-page max-w-6xl mx-auto space-y-8">
            <div className="interview-hero">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="space-y-3">
                        <span className="interview-chip is-info">Cinematic AI Interview Lab</span>
                        <h1 className="text-3xl md:text-4xl font-semibold text-[color:var(--text-primary)]">
                            Interview History
                        </h1>
                        <p className="text-base text-[color:var(--text-secondary)] max-w-2xl">
                            Review every mock, track your growth curve, and jump back in with a studio-grade experience.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => navigate('/interview/setup')}
                                className="sw-btn sw-btn-primary interview-cta"
                            >
                                <Play size={16} /> Start New Interview
                            </button>
                            {activeSession && (
                                <button
                                    onClick={() => navigate(`/interview/${activeSession._id}`)}
                                    className="sw-btn sw-btn-ghost"
                                >
                                    Resume Last Session
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px] w-full sm:w-auto">
                        <div className="interview-stat-card">
                            <p className="interview-stat-label">Completed</p>
                            <p className="interview-stat-value">{stats.completed}</p>
                        </div>
                        <div className="interview-stat-card">
                            <p className="interview-stat-label">Avg Score</p>
                            <p className="interview-stat-value">{stats.avgScore}%</p>
                        </div>
                        <div className="interview-stat-card">
                            <p className="interview-stat-label">Avg Duration</p>
                            <p className="interview-stat-value">{stats.avgDuration}m</p>
                        </div>
                    </div>
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="interview-card text-center py-16">
                    <div className="inline-flex items-center justify-center mx-auto h-14 w-14 rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent-primary)] shadow-lg shadow-[color:var(--accent-focus)]/40 mb-4">
                        <Trophy size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">No interviews yet</h3>
                    <p className="text-[color:var(--text-secondary)] mt-2">
                        Kick off your first AI-powered mock and your progress will appear here.
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={() => navigate('/interview/setup')}
                            className="sw-btn sw-btn-primary interview-cta"
                        >
                            <Play size={16} /> Start Now
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {sessions.map((session) => {
                        const statusClass =
                            session.status === 'completed'
                                ? 'is-success'
                                : session.status === 'aborted'
                                ? 'is-danger'
                                : 'is-info';
                        const score = Math.max(0, session.totalScore || 0);
                        return (
                            <motion.div
                                key={session._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="interview-card"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`interview-chip ${statusClass}`}>{session.status}</span>
                                            <span className="interview-meta flex items-center gap-1">
                                                <Calendar size={14} />
                                                {formatDate(session.startedAt)}
                                            </span>
                                            <span className="interview-meta flex items-center gap-1">
                                                <Clock size={14} />
                                                {session.config.duration}m
                                            </span>
                                            <span className="interview-meta">Q{session.config.questionCount}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="interview-pill">{session.config.difficulty} level</span>
                                            <span className="interview-pill">
                                                {session.config.language ? session.config.language : 'Language: JS'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="interview-meta uppercase tracking-[0.12em] text-[11px]">Score</p>
                                        <p className="text-3xl font-semibold text-[color:var(--text-primary)]">
                                            {score}
                                            <span className="text-base text-[color:var(--text-secondary)]">%</span>
                                        </p>
                                        <button
                                            onClick={() => navigate(`/interview/${session._id}`)}
                                            className="sw-icon-button"
                                            aria-label="Open session"
                                        >
                                            <ArrowRight size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="interview-progress mt-4">
                                    <div
                                        className="interview-progress-bar"
                                        style={{ width: `${Math.min(score, 100)}%` }}
                                    />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
