import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Plus, Search, Server, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid,
    Database, Shield, Code, Settings, Zap, CheckCircle2, BookOpen, Clock, BarChart3, Copy, SlidersHorizontal, BrainCircuit
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { SRSInfoModal } from '../components/ui/SRSInfoModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { BackendTopicForm } from '../components/forms/BackendTopicForm';
import { DeleteModal } from '../components/ui/DeleteModal';
import { AnimatedList } from '../components/ui/AnimatedList';
import { api, type BackendTopic } from '../services/api';
import { toast } from '../stores/toastStore';
import { BackendTopicViewModal } from '../components/ui/BackendTopicViewModal';
import { useAI } from '../contexts/AIContext';
import { SystemDesignCanvas } from '../components/learning/SystemDesignCanvas';
import { cn } from '../lib/utils';

const CATEGORIES = [
    { value: '', label: 'All Categories' },
    { value: 'node', label: 'Node.js' },
    { value: 'express', label: 'Express.js' },
    { value: 'database', label: 'Database' },
    { value: 'auth', label: 'Authentication' },
    { value: 'api', label: 'API Design' },
    { value: 'system-design', label: 'System Design' },
    { value: 'devops', label: 'DevOps' },
    { value: 'security', label: 'Security' },
    { value: 'testing', label: 'Testing' },
    { value: 'performance', label: 'Performance' },
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name', label: 'Name (A-Z)' },
];

const categoryIconMap: Record<string, any> = {
    node: Code,
    express: Server,
    database: Database,
    auth: Shield,
    api: Zap,
    'system-design': Settings,
    devops: Server,
    security: Shield,
    testing: Code,
    performance: Zap,
};

const statusColors = {
    completed: 'border-l-status-ok',
    in_progress: 'border-l-status-warning',
    planned: 'border-l-border-subtle',
};


export function BackendTopics() {
    const [topics, setTopics] = useState<BackendTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSRSModal, setShowSRSModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<BackendTopic | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showReviewDueOnly, setShowReviewDueOnly] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [viewModalTopicId, setViewModalTopicId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');
    const { toggleOpen } = useAI();

    const fetchTopics = useCallback(async () => {
        setIsLoading(true);
        try {
            // If searching, fetch a larger limit to allow client-side filtering across all data
            const limit = search ? 1000 : 20;
            const response = await api.getBackendTopics(page, limit, categoryFilter || undefined);
            setTopics(response.topics);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch topics:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, categoryFilter, search]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    const handleDeleteClick = (id: string) => {
        setTopicToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!topicToDelete) return;

        setIsDeleting(true);
        try {
            await api.deleteBackendTopic(topicToDelete);
            toast.success('Topic deleted successfully');
            fetchTopics();
            setDeleteModalOpen(false);
            setTopicToDelete(null);
        } catch (error: any) {
            console.error('Failed to delete:', error);
            const message = error.message || 'Failed to delete topic';
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDuplicate = async (topic: BackendTopic) => {
        try {
            const { _id, date, ...copyData } = topic;
            await api.createBackendTopic({
                ...copyData,
                topicName: `${topic.topicName} (Copy)`,
                status: 'planned',
                date: new Date().toISOString().split('T')[0],
            });
            fetchTopics();
        } catch (error) {
            console.error('Failed to duplicate:', error);
        }
    };

    const handleReview = async (topic: BackendTopic, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentStage = topic.reviewStage || 1;
        let nextDate = new Date();
        let nextStage = currentStage + 1;

        // 1-4-7 Rule Logic
        // Stage 1 (Day 1) -> Review -> Schedule for Day 4 (+3 days)
        // Stage 2 (Day 4) -> Review -> Schedule for Day 7 (+3 days)
        // Stage 3 (Day 7) -> Review -> Done (Mastered)

        if (currentStage < 3) {
            nextDate.setDate(nextDate.getDate() + 3);
        } else {
            // Completed 1-4-7 cycle
            nextStage = 4;
        }

        try {
            await api.updateBackendTopic(topic._id, {
                nextReviewDate: nextStage <= 3 ? nextDate.toISOString().split('T')[0] : undefined,
                reviewStage: nextStage
            });
            fetchTopics();
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

    // Stats Logic
    const stats = useMemo(() => {
        const total = topics.length;
        const completed = topics.filter(t => t.status === 'completed').length;
        const inProgress = topics.filter(t => t.status === 'in_progress').length;
        const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, inProgress, completionRate };
    }, [topics]);

    // Filtering & Sorting
    const filteredTopics = useMemo(() => {
        let result = topics.filter(t =>
            t.topicName.toLowerCase().includes(search.toLowerCase())
        );

        if (showReviewDueOnly) {
            result = result.filter(t => t.nextReviewDate && new Date(t.nextReviewDate) <= new Date());
        }

        if (sortBy === 'newest') result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sortBy === 'oldest') result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (sortBy === 'name') result.sort((a, b) => a.topicName.localeCompare(b.topicName));

        return result;
    }, [topics, search, sortBy]);

    const categoryCounts = useMemo(() => {
        return topics.reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [topics]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Backend Topics</h1>
                    <div className="hidden sm:flex items-center gap-2 mt-1">
                        <p className="text-sm text-text-secondary">Track your backend development learning</p>
                        <button
                            onClick={() => setShowSRSModal(true)}
                            className="text-xs text-accent-primary hover:text-accent-primary-dark underline"
                        >
                            How SRS review works?
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleOpen}
                        className="p-2 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95"
                        title="Ask AI about Backend"
                    >
                        <BrainCircuit size={20} />
                    </button>
                    <Button size="sm" onClick={() => setShowAddModal(true)} leftIcon={<Plus size={16} />} className="shrink-0">
                        <span className="hidden sm:inline">Add Topic</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex justify-end p-1.5 bg-console-darker border border-border-subtle rounded-2xl w-fit ml-auto">
                <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
                        viewMode === 'list' ? "bg-accent-primary text-white shadow-premium" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <SlidersHorizontal size={14} />
                    LIST VIEW
                </button>
                <button
                    onClick={() => setViewMode('canvas')}
                    className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
                        viewMode === 'canvas' ? "bg-accent-primary text-white shadow-premium" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <LayoutGrid size={14} />
                    SYSTEM CANVAS
                </button>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-accent-primary' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-status-ok' },
                    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-status-warning' },
                    { label: 'Mastery', value: `${stats.completionRate}%`, icon: Zap, color: 'text-accent-primary' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="py-3 px-4 rounded-xl bg-console-surface border border-border-subtle flex items-center gap-3 shadow-premium premium-card glow-border"
                    >
                        <div className={`p-2 rounded-lg bg-black/20 ${stat.color}`}>
                            <stat.icon size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl sm:text-2xl font-black text-text-primary leading-none text-glow">{stat.value}</p>
                            <p className="text-[10px] text-text-secondary uppercase tracking-[0.1em] font-bold mt-1 opacity-60">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Category Stats */}
            <div className="flex overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 gap-2">
                {Object.entries(categoryCounts).map(([category, count]) => (
                    <motion.div
                        key={category}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${categoryFilter === category
                            ? 'bg-accent-soft border-accent-primary/30'
                            : 'bg-console-surface border-border-subtle hover:border-accent-primary/20'
                            }`}
                        onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {(() => {
                            const IconComponent = categoryIconMap[category] || Server;
                            return <IconComponent size={16} className="text-text-secondary" />;
                        })()}
                        <span className="text-sm font-medium text-text-primary capitalize">{category.replace('-', ' ')}</span>
                        <span className="text-xs text-text-secondary">{count}</span>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex gap-2 w-full sm:flex-1">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <Input
                            placeholder="Search topics..."
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

                <div className={`${showMobileFilters ? "flex" : "hidden"} flex-col sm:flex sm:flex-row gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                        <Select
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            options={CATEGORIES}
                            className="w-full sm:w-48"
                        />
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            options={SORT_OPTIONS}
                            className="w-full sm:w-40"
                        />
                    </div>
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

            {/* Topics List / Canvas */}
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
                                </div>
                            </div>
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </div>
            ) : viewMode === 'canvas' ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full"
                >
                    <SystemDesignCanvas 
                        topics={filteredTopics} 
                        onNodeClick={(id) => setViewModalTopicId(id)}
                    />
                </motion.div>
            ) : filteredTopics.length === 0 ? (
                showReviewDueOnly ? (
                    <EmptyState
                        icon={<CheckCircle2 size={48} className="text-status-ok mb-4" />}
                        title="All Caught Up!"
                        description="You have no items due for review today. Great job keeping up with your schedule!"
                    />
                ) : (
                    <EmptyState
                        icon={<Server size={32} className="text-text-disabled" />}
                        title="No topics found"
                        description={search || categoryFilter
                            ? "Try adjusting your filters"
                            : "Start tracking your backend learning journey"
                        }
                        action={!search && !categoryFilter ? {
                            label: 'Add First Topic',
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
                            if (filteredTopics[index]) setViewModalTopicId(filteredTopics[index]._id);
                        }}
                        items={filteredTopics.map((topic) => (
                            <Card
                                key={topic._id}
                                className={`p-4 bg-console-surface border border-border-subtle border-l-4 shadow-premium premium-card glow-border relative overflow-hidden ${statusColors[topic.status as keyof typeof statusColors] || 'border-l-border-strong'}`}
                                hover={true}
                            >
                                <div className="flex items-start justify-between gap-4 relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <div className="p-1.5 rounded-md bg-white/5">
                                                {(() => {
                                                    const IconItem = categoryIconMap[topic.category] || Server;
                                                    return <IconItem size={18} className="text-text-secondary" />;
                                                })()}
                                            </div>
                                            <button
                                                onClick={() => setViewModalTopicId(topic._id)}
                                                className="font-bold text-sm sm:text-base text-text-primary truncate hover:text-accent-primary transition-colors tracking-tight"
                                            >
                                                {topic.topicName}
                                            </button>
                                            <div className="flex flex-wrap items-center gap-2 ml-1">
                                                {topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() && (
                                                    <Badge variant="warning" className="animate-pulse shadow-lg shadow-status-warning/10">Review Due</Badge>
                                                )}
                                                {topic.reviewStage && topic.reviewStage < 4 && (
                                                    <Badge variant="purple" size="sm">Stage {topic.reviewStage}/3</Badge>
                                                )}
                                                {!topic.nextReviewDate && topic.reviewStage === 4 && (
                                                    <Badge variant="purple" size="sm">Mastered</Badge>
                                                )}
                                                <StatusBadge status={topic.status as any} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-[11px] sm:text-xs text-text-secondary font-medium uppercase tracking-wider">
                                            <Badge variant="outline" className="opacity-70">{topic.type.replace('-', ' ')}</Badge>
                                            <span className="opacity-30">•</span>
                                            <span className="capitalize">{topic.category.replace('-', ' ')}</span>
                                            <span className="opacity-30">•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(topic.date).toLocaleDateString()}
                                            </span>
                                            {topic.timeSpent && (
                                                <span className="text-accent-primary bg-accent-soft px-2 py-0.5 rounded-full font-bold">
                                                    {topic.timeSpent}
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress & Resources */}
                                        <div className="flex flex-wrap items-center gap-3 mt-3">
                                            {topic.subTopics && topic.subTopics.length > 0 && (
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary bg-white/5 px-2.5 py-1 rounded-lg border border-border-subtle/50">
                                                    <CheckCircle2 size={12} className="text-status-ok" />
                                                    <span>
                                                        {topic.subTopics.filter(t => t.isCompleted).length} / {topic.subTopics.length} TASKS
                                                    </span>
                                                </div>
                                            )}
                                            {topic.resources && topic.resources.length > 0 && (
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary bg-white/5 px-2.5 py-1 rounded-lg border border-border-subtle/50">
                                                    <BookOpen size={12} className="text-accent-primary" />
                                                    <span>{topic.resources.length} RESOURCES</span>
                                                </div>
                                            )}
                                        </div>

                                        {topic.notes && (
                                            <p className="mt-3 text-xs sm:text-sm text-text-secondary line-clamp-2 italic opacity-70">
                                                "{topic.notes}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 sm:gap-2">
                                        {[
                                            { icon: Copy, action: () => handleDuplicate(topic), title: 'Duplicate' },
                                            { icon: RefreshCw, action: (e: any) => handleReview(topic, e), title: 'Review', highlight: topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() },
                                            { icon: Edit2, action: () => setEditingTopic(topic), title: 'Edit' },
                                            { icon: Trash2, action: () => handleDeleteClick(topic._id), title: 'Delete', danger: true },
                                        ].map((btn, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={btn.action}
                                                className={`p-2 rounded-xl transition-all ${btn.danger ? 'hover:bg-status-error/10 text-text-secondary hover:text-status-error' : btn.highlight ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' : 'hover:bg-white/5 text-text-secondary hover:text-text-primary'}`}
                                                title={btn.title}
                                            >
                                                <btn.icon size={18} className={btn.highlight ? 'animate-spin-slow' : ''} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tech Watermark */}
                                <div className="absolute -left-4 -bottom-4 opacity-[0.03] text-text-primary rotate-12 pointer-events-none group-hover:opacity-[0.07] transition-opacity duration-500">
                                    {(() => {
                                        const GhostIcon = categoryIconMap[topic.category] || Server;
                                        return <GhostIcon size={120} />;
                                    })()}
                                </div>
                            </Card>
                        ))}
                    />

                    {/* Pagination */}
                    {!search && pagination.pages > 1 && (
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

            {/* Add Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add Backend Topic"
                size="lg"
            >
                <BackendTopicForm
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchTopics();
                    }}
                    onCancel={() => setShowAddModal(false)}
                />
            </Modal>

            {/* SRS Info Modal */}
            <SRSInfoModal
                isOpen={showSRSModal}
                onClose={() => setShowSRSModal(false)}
            />

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingTopic}
                onClose={() => setEditingTopic(null)}
                title="Edit Topic"
                size="lg"
            >
                {editingTopic && (
                    <BackendTopicForm
                        initialValues={editingTopic}
                        onSuccess={() => {
                            setEditingTopic(null);
                            fetchTopics();
                        }}
                        onCancel={() => setEditingTopic(null)}
                    />
                )}
            </Modal>

            {/* Delete Modal */}
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Topic"
                description="Are you sure you want to delete this topic? This action cannot be undone."
                isDeleting={isDeleting}
            />

            {/* Read-Only Study View Modal */}
            <BackendTopicViewModal
                isOpen={!!viewModalTopicId}
                onClose={() => setViewModalTopicId(null)}
                topicId={viewModalTopicId}
            />
        </div >
    );
}