import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
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
    Brain
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge, StatusBadge } from './Badge';
import { api, type BackendTopic } from '../../services/api';
import { useAI } from '../../contexts/AIContext';

interface BackendTopicViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    topicId: string | null;
}

export function BackendTopicViewModal({ isOpen, onClose, topicId }: BackendTopicViewModalProps) {
    const [topic, setTopic] = useState<BackendTopic | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { toggleOpen, setContext } = useAI();

    useEffect(() => {
        if (isOpen && topic) {
            setContext({ type: 'Backend Topic', data: topic });
        }
        return () => setContext(null);
    }, [isOpen, topic, setContext]);

    useEffect(() => {
        if (!isOpen || !topicId) return;

        const fetchTopic = async () => {
            setIsLoading(true);
            setError('');
            try {
                const response = await api.getBackendTopic(topicId);
                setTopic(response.topic);
            } catch (err) {
                console.error('Failed to fetch topic:', err);
                setError('Topic not found or failed to load.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTopic();
    }, [isOpen, topicId]);

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
            // Refresh to get updated state
            const response = await api.getBackendTopic(topic._id);
            setTopic(response.topic);
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

    // Derived states
    const completionRate = topic?.subTopics && topic.subTopics.length > 0
        ? Math.round((topic.subTopics.filter(t => t.isCompleted).length / topic.subTopics.length) * 100)
        : 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            title={topic?.topicName || 'Topic Details'}
            headerAction={
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleOpen();
                    }}
                    className="p-2 sm:p-2.5 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95 shrink-0"
                    title="Ask AI"
                >
                    <Brain size={20} className="sm:w-[22px] sm:h-[22px]" />
                </button>
            }
        >
            <div className="min-h-[300px] max-h-[80vh] overflow-y-auto px-1 pb-6 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full min-h-[300px]">
                        <RefreshCw size={24} className="animate-spin text-text-disabled" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
                        <AlertCircle size={48} className="text-status-error" />
                        <h3 className="text-xl font-semibold text-text-primary">{error}</h3>
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                    </div>
                ) : !topic ? null : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
                        {/* Left Column: Metadata */}
                        <div className="md:col-span-1 space-y-6">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 space-y-4 shadow-sm"
                            >
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Status</label>
                                    <StatusBadge status={topic.status as any} />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Category</label>
                                    <div className="flex items-center gap-2 text-text-primary text-sm font-medium">
                                        <Server size={16} className="text-text-secondary" />
                                        <span className="capitalize">{topic.category}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Added On</label>
                                    <div className="flex items-center gap-2 text-text-primary text-sm font-medium">
                                        <Clock size={16} className="text-text-secondary" />
                                        <span>{new Date(topic.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    </div>
                                </div>

                                <div className="border-t border-border-subtle pt-4 flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">SRS Status</label>
                                    {topic.nextReviewDate ? (
                                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${new Date(topic.nextReviewDate) <= new Date()
                                            ? 'bg-status-warning/10 border-status-warning/20 text-status-warning'
                                            : 'bg-status-ok/10 border-status-ok/20 text-status-ok'
                                            }`}>
                                            <Calendar size={18} />
                                            <div>
                                                <p className="font-semibold text-sm">{new Date(topic.nextReviewDate).toLocaleDateString()}</p>
                                                <p className="text-[11px] opacity-80 font-medium tracking-wide">
                                                    {new Date(topic.nextReviewDate) <= new Date() ? 'REVIEW DUE NOW' : 'NEXT REVIEW'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-text-disabled text-sm">
                                            <CheckCircle2 size={16} />
                                            <span className="font-medium">Mastered</span>
                                        </div>
                                    )}
                                    {topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() && (
                                        <Button
                                            onClick={handleReview}
                                            className="w-full mt-2 bg-status-warning hover:bg-status-warning/90 dark:bg-amber-600 dark:hover:bg-amber-700 text-white min-h-[40px]"
                                            leftIcon={<RefreshCw size={14} />}
                                        >
                                            Mark Reviewed
                                        </Button>
                                    )}
                                </div>
                            </motion.div>

                            {/* Completion Stats */}
                            {topic.subTopics && topic.subTopics.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 shadow-sm"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-text-primary text-sm">Topic Progress</h3>
                                        <span className="text-xs font-bold text-accent-primary">{completionRate}%</span>
                                    </div>
                                    <div className="w-full bg-console-surface-2 border border-border-strong rounded-full h-2 overflow-hidden">
                                        <div className="bg-accent-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${completionRate}%` }}></div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Right Column: Content */}
                        <div className="md:col-span-2 space-y-5">
                            {/* Checklist */}
                            {topic.subTopics && topic.subTopics.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 shadow-sm"
                                >
                                    <h3 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                                        <CheckCircle2 size={18} className="text-status-ok" /> Learning Checklist
                                    </h3>
                                    <div className="space-y-2">
                                        {topic.subTopics.map((sub, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-console-surface-2 border border-border-subtle transition-all hover:border-border-strong">
                                                <div className={`mt-0.5 shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition-colors ${sub.isCompleted ? 'bg-status-ok border-status-ok' : 'border-border-strong bg-console-surface/50'
                                                    }`}>
                                                    {sub.isCompleted && <CheckCircle2 size={12} strokeWidth={3} className="text-white" />}
                                                </div>
                                                <span className={`text-[13px] sm:text-sm leading-snug font-medium transition-colors ${sub.isCompleted ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
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
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 shadow-sm"
                                >
                                    <h3 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                                        <BookOpen size={18} className="text-accent-primary" /> Resources Attached
                                    </h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {topic.resources.map((res, idx) => (
                                            <a
                                                key={idx}
                                                href={res.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3.5 rounded-lg bg-console-surface-2 border border-border-subtle hover:border-accent-primary/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all group"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                                    <Badge variant="purple" className="uppercase text-[9px] shrink-0 font-bold tracking-wider">{res.type}</Badge>
                                                    <span className="font-semibold text-sm text-text-primary truncate group-hover:text-accent-primary transition-colors">{res.title}</span>
                                                </div>
                                                <ExternalLink size={14} className="text-text-secondary shrink-0 group-hover:text-accent-primary transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Additional Info Cards (Notes/Bugs/Files) */}
                            <div className="grid grid-cols-1 gap-4 sm:gap-5">
                                {topic.notes && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.25 }}
                                        className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-accent-primary/40"></div>
                                        <h3 className="text-sm font-bold text-text-primary mb-2">Topic Notes</h3>
                                        <p className="text-text-primary/80 text-sm whitespace-pre-wrap leading-relaxed">{topic.notes}</p>
                                    </motion.div>
                                )}

                                {topic.bugsFaced && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="bg-status-error/5 border border-status-error/20 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-status-error"></div>
                                        <h3 className="text-sm font-bold text-status-error mb-2 flex items-center gap-1.5">
                                            <Bug size={14} /> Critical Bugs / Gotchas
                                        </h3>
                                        <p className="text-status-error/90 text-sm font-medium leading-relaxed">{topic.bugsFaced}</p>
                                    </motion.div>
                                )}

                                {topic.filesModified && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.35 }}
                                        className="bg-console-surface border border-border-subtle rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-text-secondary/40"></div>
                                        <h3 className="text-sm font-bold text-text-secondary mb-2 flex items-center gap-1.5">
                                            <FileCode size={14} /> Affected Architecture
                                        </h3>
                                        <p className="text-text-primary font-mono text-xs bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-border-subtle overflow-x-auto custom-scrollbar">
                                            {topic.filesModified}
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
