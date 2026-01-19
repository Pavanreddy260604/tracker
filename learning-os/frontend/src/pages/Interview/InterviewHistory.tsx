import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, Trophy, ArrowRight, Play } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession } from '../../services/api';

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

    if (isLoading) return <div className="p-10 text-center text-gray-500">Loading History...</div>;

    return (<div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Interview History</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Track your progress and review past performances</p>
            </div>
            <button
                onClick={() => navigate('/interview/setup')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
                <Play size={16} /> New Interview
            </button>
        </div>

        {sessions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#1c2128] rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
                <Trophy size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No interviews taken yet.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {sessions.map((session) => (
                    <motion.div
                        key={session._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl p-5 hover:border-blue-500/30 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 text-xs rounded uppercase font-bold tracking-wide ${session.status === 'completed' ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400' :
                                        session.status === 'aborted' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                                            'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                        }`}>
                                        {session.status}
                                    </span>
                                    <span className="text-gray-500 text-sm flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(session.startedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                                    <span className="flex items-center gap-1">
                                        <Trophy size={14} className="text-yellow-600 dark:text-yellow-500" />
                                        Score: <span className="text-gray-900 dark:text-white font-mono font-bold">{session.totalScore || 0}%</span>
                                    </span>
                                    <span className="h-3 w-px bg-gray-200 dark:bg-white/10" />
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} className="text-blue-500 dark:text-blue-400" />
                                        {session.config.duration}m
                                    </span>
                                    <span className="h-3 w-px bg-gray-200 dark:bg-white/10" />
                                    <span className="capitalize text-purple-600 dark:text-purple-400">{session.config.difficulty}</span>
                                    <span className="h-3 w-px bg-gray-200 dark:bg-white/10" />
                                    <span className="capitalize text-green-600 dark:text-green-400">{session.config.language || 'JS'}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/interview/${session._id}`)}
                                className="p-2 text-gray-400 group-hover:text-blue-500 bg-gray-50 dark:bg-white/5 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-all"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
    </div>
    );
}
