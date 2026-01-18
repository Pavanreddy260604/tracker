import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Server, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight,
    Database, Shield, Code, Settings, Zap, CheckCircle2, BookOpen, Clock, BarChart3, Copy
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
import { api, type BackendTopic } from '../services/api';
import { toast } from '../stores/toastStore';

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

const categoryIcons: Record<string, React.ReactNode> = {
    node: <Code size={16} className="text-gray-300" />,
    express: <Server size={16} className="text-gray-400" />,
    database: <Database size={16} className="text-gray-300" />,
    auth: <Shield size={16} className="text-gray-300" />,
    api: <Zap size={16} className="text-gray-300" />,
    'system-design': <Settings size={16} className="text-gray-400" />,
    devops: <Server size={16} className="text-gray-300" />,
    security: <Shield size={16} className="text-gray-400" />,
    testing: <Code size={16} className="text-gray-300" />,
    performance: <Zap size={16} className="text-gray-300" />,
};

const statusColors = {
    completed: 'border-l-green-500',
    in_progress: 'border-l-yellow-500',
    planned: 'border-l-gray-500',
};

const MotionCard = motion(Card);

export function BackendTopics() {
    const [topics, setTopics] = useState<BackendTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSRSModal, setShowSRSModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<BackendTopic | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showReviewDueOnly, setShowReviewDueOnly] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const navigate = useNavigate();

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Backend Topics</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-400">Track your backend development learning</p>
                        <button
                            onClick={() => setShowSRSModal(true)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                            How SRS review works?
                        </button>
                    </div>
                </div>
                <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={18} />}>
                    Add Topic
                </Button>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-blue-400' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-400' },
                    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-yellow-400' },
                    { label: 'Mastery', value: `${stats.completionRate}%`, icon: Zap, color: 'text-purple-400' },
                ].map((stat, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#1c2128] border border-white/10 flex items-center gap-3">
                        <stat.icon size={20} className={stat.color} />
                        <div>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Category Stats */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(categoryCounts).map(([category, count]) => (
                    <motion.div
                        key={category}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${categoryFilter === category
                            ? 'bg-white/10 border-white/30'
                            : 'bg-[#1c2128] border-white/10 hover:border-white/20'
                            }`}
                        onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {categoryIcons[category] || <Server size={16} className="text-gray-400" />}
                        <span className="text-sm text-gray-300 capitalize">{category.replace('-', ' ')}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <Input
                        placeholder="Search topics..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11"
                    />
                </div>
                <Select
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={CATEGORIES}
                    className="sm:w-48"
                />
                <Button
                    variant={showReviewDueOnly ? 'primary' : 'secondary'}
                    onClick={() => setShowReviewDueOnly(!showReviewDueOnly)}
                    className={`whitespace-nowrap ${showReviewDueOnly ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    leftIcon={<RefreshCw size={16} className={showReviewDueOnly ? 'animate-spin-slow' : ''} />}
                >
                    Review Due
                </Button>
                <Select
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                    className="sm:w-40"
                />
            </div>

            {/* Topics List */}
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
                                </div>
                            </div>
                            <Skeleton className="h-4 w-full bg-gray-700/30" />
                        </div>
                    ))}
                </div>
            ) : filteredTopics.length === 0 ? (
                showReviewDueOnly ? (
                    <EmptyState
                        icon={<CheckCircle2 size={48} className="text-green-500 mb-4" />}
                        title="All Caught Up!"
                        description="You have no items due for review today. Great job keeping up with your schedule!"
                    />
                ) : (
                    <EmptyState
                        icon={<Server size={32} className="text-gray-300" />}
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
                    <AnimatePresence mode="popLayout">
                        {filteredTopics.map((topic, index) => (
                            <MotionCard
                                key={topic._id}
                                className={`p-4 border-l-4 ${statusColors[topic.status as keyof typeof statusColors] || 'border-l-gray-500'}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.03 }}
                                hover={true}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            {categoryIcons[topic.category] || <Server size={18} className="text-gray-400" />}
                                            <button
                                                onClick={() => navigate(`/backend/${topic._id}`)}
                                                className="font-semibold text-white truncate hover:text-blue-400 hover:underline text-left"
                                            >
                                                {topic.topicName}
                                            </button>
                                            {topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() && (
                                                <Badge variant="success" className="animate-pulse">Review Due</Badge>
                                            )}
                                            {topic.reviewStage && topic.reviewStage < 4 && (
                                                <Badge variant="purple" size="sm">Stage {topic.reviewStage}/3</Badge>
                                            )}
                                            {!topic.nextReviewDate && topic.reviewStage === 4 && (
                                                <Badge variant="default" size="sm">Mastered</Badge>
                                            )}
                                            <StatusBadge status={topic.status as any} />
                                            {topic.difficulty && (
                                                <Badge variant="outline" className="text-xs capitalize">{topic.difficulty}</Badge>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                            <Badge variant="purple">{topic.type.replace('-', ' ')}</Badge>
                                            <span className="capitalize">{topic.category.replace('-', ' ')}</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(topic.date).toLocaleDateString()}
                                            </span>
                                            {topic.timeSpent && (
                                                <span className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded-full">
                                                    {topic.timeSpent}
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress & Resources */}
                                        <div className="flex flex-wrap items-center gap-4 mt-3">
                                            {topic.subTopics && topic.subTopics.length > 0 && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md">
                                                    <CheckCircle2 size={12} className="text-green-400" />
                                                    <span>
                                                        {topic.subTopics.filter(t => t.isCompleted).length} / {topic.subTopics.length} Tasks
                                                    </span>
                                                </div>
                                            )}
                                            {topic.resources && topic.resources.length > 0 && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md">
                                                    <BookOpen size={12} className="text-blue-400" />
                                                    <span>{topic.resources.length} Resources</span>
                                                </div>
                                            )}
                                        </div>

                                        {topic.filesModified && (
                                            <p className="mt-2 text-sm text-gray-500">
                                                📁 {topic.filesModified}
                                            </p>
                                        )}

                                        {topic.notes && (
                                            <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                                                {topic.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(topic)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
                                            title="Duplicate"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { handleReview(topic, e); }}
                                            className={`p-2 rounded-lg transition-colors ${topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date()
                                                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            title={topic.nextReviewDate ? `Review Due: ${topic.nextReviewDate}` : 'Mark Reviewed'}
                                        >
                                            <RefreshCw size={18} className={topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() ? 'animate-pulse' : ''} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingTopic(topic)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteClick(topic._id)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </MotionCard>
                        ))}
                    </AnimatePresence>

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
        </div >
    );
}