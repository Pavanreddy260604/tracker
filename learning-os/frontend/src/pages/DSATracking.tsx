import { useEffect, useState, useCallback } from 'react';

import { motion } from 'framer-motion';
import {
    Plus,
    Search,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Code2,
    SlidersHorizontal,
    Award,
    BrainCircuit,
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
import { AnimatedList } from '../components/ui/AnimatedList';
import { api, type DSAProblem } from '../services/api';
import { toast } from '../stores/toastStore';
import { TOPICS, DIFFICULTIES, difficultyColors } from '../lib/constants';
import { useAI } from '../contexts/AIContext';

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
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toggleOpen } = useAI();
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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-text-primary">DSA Problems</h1>
                    <p className="hidden sm:block text-sm text-text-secondary mt-1">Track your problem-solving journey</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleOpen}
                        className="p-2 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95"
                        title="Ask AI about DSA"
                    >
                        <BrainCircuit size={20} />
                    </button>
                    <Button size="sm" onClick={() => setShowAddModal(true)} leftIcon={<Plus size={16} />} className="shrink-0">
                        <span className="hidden sm:inline">Add Problem</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 sm:overflow-visible">
                {[
                    { label: 'Total', value: stats.total, color: 'text-text-primary', icon: Code2 },
                    { label: 'Solved', value: stats.solved, color: 'text-status-ok', icon: CheckCircle2 },
                    { label: 'Easy', value: stats.easy, color: 'text-status-ok', icon: Award },
                    { label: 'Medium', value: stats.medium, color: 'text-status-warning', icon: Award },
                    { label: 'Hard', value: stats.hard, color: 'text-status-error', icon: Award },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        className="flex-shrink-0 min-w-[100px] sm:min-w-0 p-4 rounded-xl bg-console-surface border border-border-subtle shadow-premium premium-card glow-border"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <div className="flex items-center gap-2 mb-2 opacity-60">
                            <stat.icon size={12} className={stat.color} />
                            <p className="text-[10px] text-text-secondary uppercase tracking-[0.15em] font-bold">{stat.label}</p>
                        </div>
                        <p className={`text-2xl sm:text-3xl font-black ${stat.color} text-glow`}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex gap-2 w-full sm:flex-1">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <Input
                            placeholder="Search problems..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 sm:pl-11"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="sm:hidden shrink-0 px-3 w-[40px] border border-border-strong hover:bg-console-surface"
                    >
                        <SlidersHorizontal size={16} className={showMobileFilters ? "text-accent-primary" : "text-text-secondary"} />
                    </Button>
                </div>

                {/* Mobile Collapsible / Desktop Flex Selects Grid */}
                <div className={`${showMobileFilters ? "flex" : "hidden"} flex-col sm:flex sm:flex-row gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                        <Select
                            value={topicFilter}
                            onChange={(v) => { setTopicFilter(v); setPage(1); }}
                            options={TOPICS}
                            className="w-full sm:w-48"
                        />
                        <Select
                            value={difficultyFilter}
                            onChange={(v) => { setDifficultyFilter(v); setPage(1); }}
                            options={DIFFICULTIES}
                            className="w-full sm:w-40"
                        />
                    </div>

                    <Button
                        variant={showReviewDueOnly ? 'primary' : 'secondary'}
                        onClick={() => setShowReviewDueOnly(!showReviewDueOnly)}
                        className={`shrink-0 w-full sm:w-auto whitespace-nowrap ${showReviewDueOnly ? 'bg-status-warning hover:bg-status-warning' : ''}`}
                        leftIcon={<RefreshCw size={16} className={showReviewDueOnly ? 'animate-spin-slow' : ''} />}
                    >
                        Review Due
                    </Button>
                </div>
            </div>

            {/* Problems List */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl bg-console-surface border border-border-subtle space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-6 w-1/3" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-8 rounded-lg" />
                                    <Skeleton className="h-8 w-8 rounded-lg" />
                                    <Skeleton className="h-8 w-8 rounded-lg" />
                                </div>
                            </div>
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </div>
            ) : filteredProblems.length === 0 ? (
                showReviewDueOnly ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-status-ok/10 p-6 rounded-full mb-4">
                            <CheckCircle2 size={48} className="text-status-ok" />
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-2">All Caught Up!</h3>
                        <p className="text-text-secondary max-w-sm">
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
                        icon={<Code2 size={32} className="text-text-disabled" />}
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
                    <AnimatedList
                        showGradients
                        enableArrowNavigation
                        displayScrollbar
                        staggerDelay={40}
                        onItemSelect={(_item, index) => {
                            if (filteredProblems[index]) setViewingProblem(filteredProblems[index]);
                        }}
                        items={filteredProblems.map((problem) => (
                            <Card
                                key={problem._id}
                                className={`p-4 border-l-4 premium-card glow-border ${difficultyColors[problem.difficulty as keyof typeof difficultyColors] || 'border-l-border-subtle'} relative overflow-hidden`}
                                hover={true}
                                onClick={() => setViewingProblem(problem)}
                            >
                                <div className="flex items-center justify-between gap-4 cursor-pointer relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-bold text-text-primary truncate hover:text-accent-primary transition-colors text-sm sm:text-base tracking-tight">
                                                {problem.problemName}
                                            </h3>
                                            {problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() && (
                                                <motion.div
                                                    initial={{ scale: 0.8 }}
                                                    animate={{ scale: [1, 1.2, 1] }}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                    className="w-2.5 h-2.5 rounded-full bg-status-error shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                                    title="Review Due"
                                                />
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-text-secondary font-medium uppercase tracking-wider">
                                            <DifficultyBadge difficulty={problem.difficulty} />
                                            <span className="opacity-30">•</span>
                                            <StatusBadge status={problem.status} />
                                            <span className="opacity-30">•</span>
                                            <span className="bg-console-surface-2 px-2 py-0.5 rounded-md border border-border-subtle">{problem.platform}</span>
                                            {problem.reviewStage && problem.reviewStage > 0 && (
                                                <>
                                                    <span className="opacity-30">•</span>
                                                    <span className="text-accent-primary bg-accent-soft px-2 py-0.5 rounded-md">Stage {problem.reviewStage}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingProblem(problem);
                                        }}
                                        className="text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full w-10 h-10 p-0"
                                    >
                                        <ChevronRight size={20} />
                                    </Button>
                                </div>
                                {/* Subtle difficulty-themed background glow */}
                                <div className={`absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-10 pointer-events-none rounded-full
                                    ${problem.difficulty === 'easy' ? 'bg-status-ok' : problem.difficulty === 'medium' ? 'bg-status-warning' : 'bg-status-error'}`}
                                />
                            </Card>
                        ))}
                    />

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
                            <span className="text-sm text-text-secondary">
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
