import { useEffect, useState, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Search,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Code2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DifficultyBadge, StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { DSAProblemForm } from '../components/forms/DSAProblemForm';
import { ViewProblemModal } from '../components/modals/ViewProblemModal';
import { SRSInfoModal } from '../components/ui/SRSInfoModal';
import { DeleteModal } from '../components/ui/DeleteModal';
import { api, type DSAProblem } from '../services/api';
import { toast } from '../stores/toastStore';
import { TOPICS, DIFFICULTIES, difficultyColors } from '../lib/constants';

const MotionCard = motion(Card);

export function DSATracking() {
    const [problems, setProblems] = useState<DSAProblem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSRSModal, setShowSRSModal] = useState(false);
    const [editingProblem, setEditingProblem] = useState<DSAProblem | null>(null);
    const [viewingProblem, setViewingProblem] = useState<DSAProblem | null>(null);
    const [search, setSearch] = useState('');
    const [topicFilter, setTopicFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [showReviewDueOnly, setShowReviewDueOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // const navigate = useNavigate();

    const fetchProblems = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.getDSAProblems(page, 20, topicFilter || undefined, difficultyFilter || undefined);
            setProblems(response.problems);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch problems:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, topicFilter, difficultyFilter]);

    useEffect(() => {
        fetchProblems();
    }, [fetchProblems]);

    const handleDeleteClick = (id: string) => {
        setProblemToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!problemToDelete) return;

        setIsDeleting(true);
        try {
            await api.deleteDSAProblem(problemToDelete);
            toast.success('Problem deleted successfully');
            fetchProblems();
            setDeleteModalOpen(false);
            setProblemToDelete(null);
        } catch (error: any) {
            console.error('Failed to delete:', error);
            const message = error.message || 'Failed to delete problem';
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReview = async (problem: DSAProblem) => {
        const currentStage = problem.reviewStage || 1;
        let nextDate = new Date();
        let nextStage = currentStage + 1;

        // 1-4-7 Rule Logic
        // Stage 1 (Day 1) -> Review -> Day 4 (+3 days)
        // Stage 2 (Day 4) -> Review -> Day 7 (+3 days)
        // Stage 3 (Day 7) -> Review -> Done (Mastered/Solved)

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
            fetchProblems();
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

    const filteredProblems = problems.filter(p => {
        const matchesSearch = p.problemName.toLowerCase().includes(search.toLowerCase());
        const matchesReview = showReviewDueOnly
            ? p.nextReviewDate && new Date(p.nextReviewDate) <= new Date()
            : true;
        return matchesSearch && matchesReview;
    });

    // Stats
    const stats = {
        total: pagination.total,
        solved: problems.filter(p => p.status === 'solved').length,
        easy: problems.filter(p => p.difficulty === 'easy').length,
        medium: problems.filter(p => p.difficulty === 'medium').length,
        hard: problems.filter(p => p.difficulty === 'hard').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">DSA Problems</h1>
                    <p className="text-sm text-gray-400 mt-1">Track your problem-solving journey</p>
                </div>
                <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={18} />}>
                    Add Problem
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total', value: stats.total, color: 'text-white' },
                    { label: 'Solved', value: stats.solved, color: 'text-green-400' },
                    { label: 'Easy', value: stats.easy, color: 'text-green-400' },
                    { label: 'Medium', value: stats.medium, color: 'text-amber-400' },
                    { label: 'Hard', value: stats.hard, color: 'text-red-400' },
                ].map(stat => (
                    <motion.div
                        key={stat.label}
                        className="p-4 rounded-xl bg-[#1c2128] border border-white/10"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <Input
                        placeholder="Search problems..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11"
                    />
                </div>
                <Select
                    value={topicFilter}
                    onChange={(v) => { setTopicFilter(v); setPage(1); }}
                    options={TOPICS}
                    className="sm:w-48"
                />
                <Select
                    value={difficultyFilter}
                    onChange={(v) => { setDifficultyFilter(v); setPage(1); }}
                    options={DIFFICULTIES}
                    className="sm:w-40"
                />
                <Button
                    variant={showReviewDueOnly ? 'primary' : 'secondary'}
                    onClick={() => setShowReviewDueOnly(!showReviewDueOnly)}
                    className={`whitespace-nowrap ${showReviewDueOnly ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    leftIcon={<RefreshCw size={16} className={showReviewDueOnly ? 'animate-spin-slow' : ''} />}
                >
                    Review Due
                </Button>
            </div>

            {/* Problems List */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl bg-[#1c2128] border border-white/5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-6 w-1/3 bg-gray-700/50" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-4 w-20 bg-gray-700/50" />
                                        <Skeleton className="h-4 w-24 bg-gray-700/50" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-8 rounded-lg bg-gray-700/50" />
                                    <Skeleton className="h-8 w-8 rounded-lg bg-gray-700/50" />
                                    <Skeleton className="h-8 w-8 rounded-lg bg-gray-700/50" />
                                </div>
                            </div>
                            <Skeleton className="h-4 w-full bg-gray-700/30" />
                        </div>
                    ))}
                </div>
            ) : filteredProblems.length === 0 ? (
                showReviewDueOnly ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-green-500/10 p-6 rounded-full mb-4">
                            <CheckCircle2 size={48} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
                        <p className="text-gray-400 max-w-sm">
                            You have no problem reviews due today. Feel free to solve new problems!
                        </p>
                        <Button
                            className="mt-6"
                            variant="secondary"
                            onClick={() => setShowReviewDueOnly(false)}
                        >
                            View All Problems
                        </Button>
                    </div>
                ) : (
                    <EmptyState
                        icon={<Code2 size={32} className="text-gray-300" />}
                        title="No problems found"
                        description={search || topicFilter || difficultyFilter
                            ? "Try adjusting your filters"
                            : "Start tracking your DSA progress by adding your first problem"
                        }
                        action={!search && !topicFilter && !difficultyFilter ? {
                            label: 'Add First Problem',
                            onClick: () => setShowAddModal(true),
                        } : undefined}
                    />
                )
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredProblems.map((problem, index) => (
                            <MotionCard
                                key={problem._id}
                                className={`p-4 border-l-4 ${difficultyColors[problem.difficulty as keyof typeof difficultyColors] || 'border-l-gray-500'}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.03 }}
                                hover={true}
                                onClick={() => setViewingProblem(problem)}
                            >
                                <div className="flex items-center justify-between gap-4 cursor-pointer">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-semibold text-white truncate hover:text-blue-400 transition-colors">
                                                {problem.problemName}
                                            </h3>
                                            {problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() && (
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Review Due" />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <DifficultyBadge difficulty={problem.difficulty} />
                                            <span className="text-gray-600">•</span>
                                            <StatusBadge status={problem.status} />
                                            <span className="text-gray-600">•</span>
                                            <span className="capitalize">{problem.platform}</span>
                                            {problem.reviewStage && problem.reviewStage > 0 && (
                                                <>
                                                    <span className="text-gray-600">•</span>
                                                    <span>Stage {problem.reviewStage}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action - Just the View Button */}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingProblem(problem);
                                        }}
                                        className="text-gray-500 hover:text-white"
                                    >
                                        <ChevronRight size={18} />
                                    </Button>
                                </div>
                            </MotionCard>
                        ))}
                    </AnimatePresence>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <span className="text-sm text-gray-400">
                                Page {page} of {pagination.pages}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    )}
                </div>
            )
            }

            {/* SRS Modal */}
            <SRSInfoModal
                isOpen={showSRSModal}
                onClose={() => setShowSRSModal(false)}
            />

            {/* Add Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add DSA Problem"
                size="3xl"
            >
                <DSAProblemForm
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchProblems();
                    }}
                    onCancel={() => setShowAddModal(false)}
                />
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingProblem}
                onClose={() => setEditingProblem(null)}
                title="Edit Problem"
                size="3xl"
            >
                {editingProblem && (
                    <DSAProblemForm
                        initialValues={editingProblem}
                        onSuccess={() => {
                            setEditingProblem(null);
                            fetchProblems();
                        }}
                        onCancel={() => setEditingProblem(null)}
                    />
                )}
            </Modal>

            {/* View Modal */}
            <ViewProblemModal
                isOpen={!!viewingProblem}
                problem={viewingProblem}
                onClose={() => setViewingProblem(null)}
                onEdit={(problem) => setEditingProblem(problem)}
                onDelete={(id) => {
                    handleDeleteClick(id);
                    setViewingProblem(null);
                }}
                onReview={handleReview}
            />

            {/* Delete Modal */}
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Problem"
                description="Are you sure you want to delete this problem? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </div >
    );
}
