
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Clock,
    Calendar,
    CheckCircle2,
    RefreshCw,
    AlertCircle,
    Server,
    BookOpen,
    FileCode,
    Bug,
    ExternalLink,
    BrainCircuit
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { api, type BackendTopic } from '../services/api';
import { useAI } from '../contexts/AIContext';

export function BackendTopicDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [topic, setTopic] = useState<BackendTopic | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { setContext, toggleOpen } = useAI();

    useEffect(() => {
        if (topic) {
            setContext({ type: 'Backend Topic', data: topic });
        }
        return () => {
            setContext(null);
        };
    }, [topic, setContext]);

    useEffect(() => {
        const fetchTopic = async () => {
            if (!id) return;
            try {
                const response = await api.getBackendTopic(id);
                setTopic(response.topic);
            } catch (err) {
                console.error('Failed to fetch topic:', err);
                setError('Topic not found');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTopic();
    }, [id]);

    const handleReview = async () => {
        if (!topic) return;
        const currentStage = topic.reviewStage || 1;
        let nextDate = new Date();
        let nextStage = currentStage + 1;

        if (currentStage < 3) {
            nextDate.setDate(nextDate.getDate() + 3);
        } else {
            nextStage = 4;
        }

        try {
            await api.updateBackendTopic(topic._id, {
                nextReviewDate: nextStage <= 3 ? nextDate.toISOString().split('T')[0] : undefined,
                reviewStage: nextStage
            });
            const response = await api.getBackendTopic(topic._id);
            setTopic(response.topic);
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <RefreshCw size={24} className="animate-spin text-gray-300" />
            </div>
        );
    }

    if (error || !topic) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <AlertCircle size={48} className="text-red-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Topic Not Found</h2>
                <Button onClick={() => navigate('/backend')} leftIcon={<ArrowLeft size={16} />}>
                    Back to List
                </Button>
            </div>
        );
    }

    const completionRate = topic.subTopics && topic.subTopics.length > 0
        ? Math.round((topic.subTopics.filter(t => t.isCompleted).length / topic.subTopics.length) * 100)
        : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header / Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/backend')}
                    leftIcon={<ArrowLeft size={16} />}
                    className="w-fit"
                >
                    Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-text-primary">{topic.topicName}</h1>
                </div>
                <button
                    onClick={toggleOpen}
                    className="p-2 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95"
                    title="Ask AI helper"
                >
                    <BrainCircuit size={22} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Metadata */}
                <div className="md:col-span-1 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-console-surface border border-border-subtle rounded-xl p-6 space-y-4 shadow-premium"
                    >
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
                            <StatusBadge status={topic.status as any} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Category</label>
                            <div className="flex items-center gap-2 text-text-primary">
                                <Server size={18} className="text-text-secondary" />
                                <span className="capitalize">{topic.category}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Added On</label>
                            <div className="flex items-center gap-2 text-text-primary">
                                <Clock size={16} className="text-text-secondary" />
                                <span>{new Date(topic.date).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="border-t border-border-subtle pt-4 flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">SRS Status</label>
                            {topic.nextReviewDate ? (
                                <div className={`flex items-center gap-2 p-3 rounded-lg border ${new Date(topic.nextReviewDate) <= new Date()
                                    ? 'bg-status-warning/10 border-status-warning/20 text-status-warning'
                                    : 'bg-status-ok/10 border-status-ok/20 text-status-ok'
                                    }`}>
                                    <Calendar size={18} />
                                    <div>
                                        <p className="font-semibold">{new Date(topic.nextReviewDate).toLocaleDateString()}</p>
                                        <p className="text-xs opacity-80 font-medium">
                                            {new Date(topic.nextReviewDate) <= new Date() ? 'Review Due Now' : 'Next Review'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <CheckCircle2 size={18} />
                                    <span>Mastered</span>
                                </div>
                            )}
                            {topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() && (
                                <Button
                                    onClick={handleReview}
                                    className="w-full mt-2 bg-status-warning hover:bg-status-warning dark:bg-amber-600 min-h-[44px]"
                                    leftIcon={<RefreshCw size={16} />}
                                >
                                    Complete Review
                                </Button>
                            )}
                        </div>
                    </motion.div>

                    {/* Completion Stats */}
                    {topic.subTopics && topic.subTopics.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                        >
                            <h3 className="font-bold text-text-primary mb-2">Progress</h3>
                            <div className="w-full bg-console-surface-2 border border-border-subtle rounded-full h-2.5 mb-2">
                                <div className="bg-accent-primary h-2.5 rounded-full" style={{ width: `${completionRate}%` }}></div>
                            </div>
                            <p className="text-right text-xs font-semibold text-accent-primary">{completionRate}% Completed</p>
                        </motion.div>
                    )}
                </div>

                {/* Right Column: Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Checklist */}
                    {topic.subTopics && topic.subTopics.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                        >
                            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-status-ok" /> Learning Checklist
                            </h3>
                            <div className="space-y-3">
                                {topic.subTopics.map((sub, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-console-surface-2 border border-border-subtle">
                                        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${sub.isCompleted ? 'bg-status-ok border-status-ok' : 'border-border-strong bg-console-surface'
                                            }`}>
                                            {sub.isCompleted && <CheckCircle2 size={14} className="text-white" />}
                                        </div>
                                        <span className={`text-sm font-medium ${sub.isCompleted ? 'text-text-disabled line-through italic' : 'text-text-primary'}`}>
                                            {sub.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Resources */}
                    {topic.resources && topic.resources.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                        >
                            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                                <BookOpen className="text-accent-primary" /> Resources
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {topic.resources.map((res, idx) => (
                                    <a
                                        key={idx}
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-4 rounded-lg bg-console-surface-2 border border-border-subtle hover:border-accent-primary/50 hover:bg-console-elevated transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Badge variant="purple" className="uppercase text-[10px]">{res.type}</Badge>
                                            <span className="font-semibold text-text-primary group-hover:text-accent-primary transition-colors">{res.title}</span>
                                        </div>
                                        <ExternalLink size={16} className="text-text-secondary group-hover:text-accent-primary" />
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Notes & Bugs */}
                    <div className="grid grid-cols-1 gap-6">
                        {topic.notes && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                            >
                                <h3 className="font-bold text-text-primary mb-2">Notes</h3>
                                <p className="text-text-primary opacity-80 whitespace-pre-wrap italic">{topic.notes}</p>
                            </motion.div>
                        )}
                        {topic.bugsFaced && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-status-error/5 border border-status-error/20 rounded-xl p-6 shadow-premium"
                            >
                                <h3 className="font-bold text-status-error mb-2 flex items-center gap-2">
                                    <Bug size={16} /> Bugs / Issues
                                </h3>
                                <p className="text-status-error opacity-90 font-medium">{topic.bugsFaced}</p>
                            </motion.div>
                        )}
                        {topic.filesModified && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                            >
                                <h3 className="font-bold text-text-secondary mb-2 flex items-center gap-2">
                                    <FileCode size={16} /> Files Modified
                                </h3>
                                <p className="text-text-primary font-mono text-sm bg-console-surface-2 p-3 rounded-lg border border-border-subtle">{topic.filesModified}</p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
