import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Calendar, Clock, Code, Link as LinkIcon,
    Tag, AlertTriangle, CheckCircle2,
    Edit2, Trash2, Brain, RefreshCw, BrainCircuit
} from 'lucide-react';
import type { DSAProblem } from '../../services/api';
import { difficultyColors } from '../../lib/constants';
import { useAI } from '../../contexts/AIContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ViewProblemModalProps {
    problem: DSAProblem | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (problem: DSAProblem) => void;
    onDelete: (id: string) => void;
    onReview: (problem: DSAProblem) => void;
}

export function ViewProblemModal({ problem, isOpen, onClose, onEdit, onDelete, onReview }: ViewProblemModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const { setContext, toggleOpen } = useAI();

    useEffect(() => {
        if (isOpen && problem) {
            setContext({ type: 'DSA Problem', data: problem });
        }
        return () => {
            if (!isOpen) setContext(null);
        };
    }, [isOpen, problem, setContext]);

    if (!problem) return null;

    // Close on click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        ref={modalRef}
                        className="w-full max-w-2xl bg-white dark:bg-[var(--sw-surface)] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[var(--sw-border)] flex flex-col max-h-[90vh]"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[var(--sw-border)] bg-gray-50/50 dark:bg-white/5">
                            <div className="flex-1 pr-4">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {problem.problemName}
                                </h2>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={problem.status === 'solved' ? 'success' : problem.status === 'revisit' ? 'warning' : 'default'}>
                                        {problem.status.charAt(0).toUpperCase() + problem.status.slice(1)}
                                    </Badge>
                                    <Badge className={`${difficultyColors[problem.difficulty] ? difficultyColors[problem.difficulty].replace('border-l-4', 'bg-opacity-10') : ''} capitalize`}>
                                        {problem.difficulty}
                                    </Badge>
                                    <Badge variant="info">
                                        {problem.platform}
                                    </Badge>
                                    {problem.topic && (
                                        <Badge variant="secondary">
                                            {problem.topic}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar">

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Clock size={12} /> Time Spent
                                    </p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{problem.timeSpent} mins</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Calendar size={12} /> Last Solved
                                    </p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{formatDate(problem.date)}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Brain size={12} /> Reviews
                                    </p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">Stage {problem.reviewStage || 0}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Calendar size={12} /> Next Review
                                    </p>
                                    <p className={`font-semibold ${problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() ? 'text-amber-500' : 'text-gray-900 dark:text-gray-200'}`}>
                                        {formatDate(problem.nextReviewDate)}
                                    </p>
                                </div>
                            </div>

                            {/* Complexity */}
                            {(problem.timeComplexity || problem.spaceComplexity) && (
                                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
                                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                                        <Code size={16} /> Complexity Analysis
                                    </h3>
                                    <div className="flex flex-wrap gap-4 sm:gap-8">
                                        {problem.timeComplexity && (
                                            <div>
                                                <span className="text-xs uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 block mb-1">Time</span>
                                                <code className="text-sm font-mono bg-white dark:bg-black/20 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                                                    {problem.timeComplexity}
                                                </code>
                                            </div>
                                        )}
                                        {problem.spaceComplexity && (
                                            <div>
                                                <span className="text-xs uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 block mb-1">Space</span>
                                                <code className="text-sm font-mono bg-white dark:bg-black/20 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                                                    {problem.spaceComplexity}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Pattern & Notes */}
                            <div className="space-y-4">
                                {problem.patternLearned && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-green-500" /> Pattern Learned
                                        </h3>
                                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                            {problem.patternLearned}
                                        </div>
                                    </div>
                                )}

                                {problem.mistakes && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                                            <AlertTriangle size={16} className="text-amber-500" /> Mistakes & Notes
                                        </h3>
                                        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed border border-amber-100 dark:border-amber-500/10">
                                            {problem.mistakes}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tags */}
                            {problem.companyTags && problem.companyTags.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                                        <Tag size={16} /> Company Tags
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {problem.companyTags.map(tag => (
                                            <span key={tag} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/10 text-xs text-gray-600 dark:text-gray-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 justify-end">
                            <Button
                                variant={problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() ? 'primary' : 'secondary'}
                                onClick={() => {
                                    onReview(problem);
                                    onClose();
                                }}
                                leftIcon={<RefreshCw size={16} />}
                                className={problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                                {problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() ? 'Review Now' : 'Mark Reviewed'}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={toggleOpen}
                                leftIcon={<BrainCircuit size={16} />}
                                className="text-accent-primary border-accent-primary/20 hover:bg-accent-primary/5"
                            >
                                Ask AI
                            </Button>
                            {problem.solutionLink && (
                                <Button
                                    variant="secondary"
                                    onClick={() => window.open(problem.solutionLink, '_blank')}
                                    leftIcon={<LinkIcon size={16} />}
                                >
                                    Solution
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    onEdit(problem);
                                    onClose();
                                }}
                                leftIcon={<Edit2 size={16} />}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    onDelete(problem._id);
                                    onClose();
                                }}
                                leftIcon={<Trash2 size={16} />}
                            >
                                Delete
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
