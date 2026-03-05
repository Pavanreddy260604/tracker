
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Clock,
    Calendar,
    ExternalLink,
    Code2,
    Cpu,
    Building2,
    BrainCircuit,
    CheckCircle2,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DifficultyBadge, StatusBadge } from '../components/ui/Badge';
import { api, type DSAProblem } from '../services/api';
import { useAI } from '../contexts/AIContext';

export function DSAProblemDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [problem, setProblem] = useState<DSAProblem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { setContext, toggleOpen } = useAI();

    useEffect(() => {
        if (problem) {
            setContext({ type: 'DSA Problem', data: problem });
        }
        return () => setContext(null);
    }, [problem, setContext]);

    useEffect(() => {
        const fetchProblem = async () => {
            if (!id) return;
            try {
                const response = await api.getDSAProblem(id);
                setProblem(response.problem);
            } catch (err) {
                console.error('Failed to fetch problem:', err);
                setError('Problem not found');
            } finally {
                setIsLoading(false);
            }
        };
        fetchProblem();
    }, [id]);

    const handleReview = async () => {
        if (!problem) return;
        const currentStage = problem.reviewStage || 1;
        let nextDate = new Date();
        let nextStage = currentStage + 1;

        if (currentStage < 3) {
            nextDate.setDate(nextDate.getDate() + 3);
        } else {
            nextStage = 4; // Done
        }

        try {
            await api.updateDSAProblem(problem._id, {
                nextReviewDate: nextStage <= 3 ? nextDate.toISOString().split('T')[0] : undefined,
                reviewStage: nextStage,
                status: nextStage === 4 ? 'solved' : 'revisit'
            });
            // Refresh
            const response = await api.getDSAProblem(problem._id);
            setProblem(response.problem);
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

    if (error || !problem) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <AlertCircle size={48} className="text-red-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Problem Not Found</h2>
                <Button onClick={() => navigate('/dsa')} leftIcon={<ArrowLeft size={16} />}>
                    Back to List
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header / Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/dsa')}
                    leftIcon={<ArrowLeft size={16} />}
                    className="w-fit"
                >
                    Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-text-primary">{problem.problemName}</h1>
                </div>
                <button
                    onClick={toggleOpen}
                    className="p-2 sm:p-2.5 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95 shrink-0"
                    title="Ask AI"
                >
                    <BrainCircuit size={20} className="sm:w-[22px] sm:h-[22px]" />
                </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Metadata Card */}
                <div className="md:col-span-1 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-console-surface border border-border-subtle rounded-xl p-6 space-y-4 shadow-premium"
                    >
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
                            <div className="flex flex-wrap gap-2">
                                <StatusBadge status={problem.status} />
                                <DifficultyBadge difficulty={problem.difficulty} />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">SRS Status</label>
                            {problem.nextReviewDate ? (
                                <div className={`flex items-center gap-2 p-3 rounded-lg border ${new Date(problem.nextReviewDate) <= new Date()
                                    ? 'bg-status-warning/10 border-status-warning/20 text-status-warning'
                                    : 'bg-status-ok/10 border-status-ok/20 text-status-ok'
                                    }`}>
                                    <Calendar size={18} />
                                    <div>
                                        <p className="font-semibold">{new Date(problem.nextReviewDate).toLocaleDateString()}</p>
                                        <p className="text-xs opacity-80 font-medium">
                                            {new Date(problem.nextReviewDate) <= new Date() ? 'Review Due Now' : 'Next Review'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <CheckCircle2 size={18} />
                                    <span>Mastered / No Review</span>
                                </div>
                            )}
                            {/* Review Action */}
                            {problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() && (
                                <Button
                                    onClick={handleReview}
                                    className="w-full mt-2 bg-status-warning hover:bg-status-warning dark:bg-amber-600 min-h-[44px]"
                                    leftIcon={<RefreshCw size={16} />}
                                >
                                    Complete Review (+3 Days)
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Platform</label>
                            <div className="flex items-center justify-between bg-console-surface-2 p-3 rounded-lg border border-border-subtle">
                                <span className="capitalize text-text-primary font-bold">{problem.platform}</span>
                                {problem.solutionLink ? (
                                    <a
                                        href={problem.solutionLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent-primary hover:text-accent-primary-dark flex items-center gap-1 text-sm font-bold"
                                    >
                                        Solve <ExternalLink size={14} />
                                    </a>
                                ) : (
                                    <span className="text-text-secondary text-xs">No Link</span>
                                )}
                            </div>
                        </div>

                        {problem.timeSpent > 0 && (
                            <div className="flex items-center gap-2 text-text-secondary text-sm">
                                <Clock size={16} />
                                <span>Time Spent: <span className="text-text-primary font-mono font-bold">{problem.timeSpent}m</span></span>
                            </div>
                        )}

                        {problem.companyTags && problem.companyTags.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-text-secondary uppercase tracking-wide">Companies</label>
                                <div className="flex flex-wrap gap-2">
                                    {problem.companyTags.map(tag => (
                                        <span key={tag} className="flex items-center gap-1 text-xs bg-console-surface-2 text-text-primary px-2 py-1 rounded border border-border-subtle font-medium">
                                            <Building2 size={12} className="text-text-secondary" /> {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary uppercase tracking-wide">Complexity</label>
                            {problem.timeComplexity && (
                                <div className="flex justify-between items-center text-sm bg-console-surface-2 px-3 py-2 rounded border border-border-subtle">
                                    <span className="text-text-secondary flex items-center gap-2"><Cpu size={14} /> Time</span>
                                    <span className="font-mono font-bold text-status-warning">{problem.timeComplexity}</span>
                                </div>
                            )}
                            {problem.spaceComplexity && (
                                <div className="flex justify-between items-center text-sm bg-console-surface-2 px-3 py-2 rounded border border-border-subtle">
                                    <span className="text-text-secondary flex items-center gap-2"><Cpu size={14} /> Space</span>
                                    <span className="font-mono font-bold text-accent-primary">{problem.spaceComplexity}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: Content Details */}
                <div className="md:col-span-2 space-y-6">

                    {/* Pattern/Approach */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-console-surface border border-border-subtle rounded-xl p-6 shadow-premium"
                    >
                        <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                            <BrainCircuit className="text-accent-primary" /> Pattern & Approach
                        </h3>
                        {problem.patternLearned ? (
                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                <p className="text-text-primary opacity-90 whitespace-pre-wrap text-[17px] leading-relaxed italic">{problem.patternLearned}</p>
                            </div>
                        ) : (
                            <p className="text-text-secondary italic">No pattern notes added.</p>
                        )}
                    </motion.div>

                    {/* Solution Code */}
                    {problem.solutionCode && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-console-surface border border-border-subtle rounded-xl overflow-hidden shadow-premium"
                        >
                            <div className="bg-console-surface-2 px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                                <Code2 size={18} className="text-accent-primary" />
                                <span className="font-bold text-text-primary">Solution Code</span>
                            </div>
                            <div className="p-4 bg-console-bg/50 overflow-x-auto">
                                <pre className="font-mono text-sm text-text-primary opacity-80">
                                    <code>{problem.solutionCode}</code>
                                </pre>
                            </div>
                        </motion.div>
                    )}

                    {/* Mistakes */}
                    {problem.mistakes && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-status-error/5 border border-status-error/20 rounded-xl p-6 shadow-premium"
                        >
                            <h3 className="text-lg font-bold text-status-error mb-2 flex items-center gap-2">
                                <AlertCircle size={20} /> Mistakes to Avoid
                            </h3>
                            <p className="text-status-error opacity-90 font-medium italic">{problem.mistakes}</p>
                        </motion.div>
                    )}

                </div>
            </div>
        </div>
    );
}
