
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
    ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { api, type BackendTopic } from '../services/api';

export function BackendTopicDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [topic, setTopic] = useState<BackendTopic | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

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
                <h2 className="text-2xl font-bold text-white">Topic Not Found</h2>
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
            <div className="flex items-center gap-4">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/backend')}
                    leftIcon={<ArrowLeft size={16} />}
                >
                    Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{topic.topicName}</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Metadata */}
                <div className="md:col-span-1 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1c2128] border border-white/10 rounded-xl p-6 space-y-4"
                    >
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                            <StatusBadge status={topic.status as any} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
                            <div className="flex items-center gap-2 text-gray-300">
                                <Server size={18} />
                                <span className="capitalize">{topic.category}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Added On</label>
                            <div className="flex items-center gap-2 text-gray-300">
                                <Clock size={16} />
                                <span>{new Date(topic.date).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
                            <label className="text-xs text-gray-500 uppercase tracking-wide">SRS Status</label>
                            {topic.nextReviewDate ? (
                                <div className={`flex items-center gap-2 p-3 rounded-lg border ${new Date(topic.nextReviewDate) <= new Date()
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : 'bg-green-500/10 border-green-500/20 text-green-400'
                                    }`}>
                                    <Calendar size={18} />
                                    <div>
                                        <p className="font-semibold">{new Date(topic.nextReviewDate).toLocaleDateString()}</p>
                                        <p className="text-xs opacity-80">
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
                                    className="w-full mt-2 bg-green-600 hover:bg-green-700"
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
                            className="bg-[#1c2128] border border-white/10 rounded-xl p-6"
                        >
                            <h3 className="font-bold text-white mb-2">Progress</h3>
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${completionRate}%` }}></div>
                            </div>
                            <p className="text-right text-xs text-blue-400">{completionRate}% Completed</p>
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
                            className="bg-[#1c2128] border border-white/10 rounded-xl p-6"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-green-400" /> Learning Checklist
                            </h3>
                            <div className="space-y-3">
                                {topic.subTopics.map((sub, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                                        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${sub.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-500'
                                            }`}>
                                            {sub.isCompleted && <CheckCircle2 size={14} className="text-white" />}
                                        </div>
                                        <span className={`text-sm ${sub.isCompleted ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
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
                            className="bg-[#1c2128] border border-white/10 rounded-xl p-6"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <BookOpen className="text-blue-400" /> Resources
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {topic.resources.map((res, idx) => (
                                    <a
                                        key={idx}
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Badge variant="purple" className="uppercase text-[10px]">{res.type}</Badge>
                                            <span className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors">{res.title}</span>
                                        </div>
                                        <ExternalLink size={16} className="text-gray-500 group-hover:text-blue-400" />
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
                                className="bg-[#1c2128] border border-white/10 rounded-xl p-6"
                            >
                                <h3 className="font-bold text-white mb-2">Notes</h3>
                                <p className="text-gray-300 whitespace-pre-wrap">{topic.notes}</p>
                            </motion.div>
                        )}
                        {topic.bugsFaced && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-[#1c2128] border border-red-500/20 rounded-xl p-6"
                            >
                                <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                                    <Bug size={16} /> Bugs / Issues
                                </h3>
                                <p className="text-gray-300">{topic.bugsFaced}</p>
                            </motion.div>
                        )}
                        {topic.filesModified && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-[#1c2128] border border-white/10 rounded-xl p-6"
                            >
                                <h3 className="font-bold text-gray-400 mb-2 flex items-center gap-2">
                                    <FileCode size={16} /> Files Modified
                                </h3>
                                <p className="text-gray-300 font-mono text-sm">{topic.filesModified}</p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
