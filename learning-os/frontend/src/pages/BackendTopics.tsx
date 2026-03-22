import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Server, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid,
    Database, Shield, Code, Settings, Zap, CheckCircle2, BookOpen, Clock, BarChart3, SlidersHorizontal, BrainCircuit,
    Layers, Globe, Binary, Activity, Compass, Terminal
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SRSInfoModal } from '../components/ui/SRSInfoModal';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { DeleteModal } from '../components/ui/DeleteModal';
import { api, type BackendTopic } from '../services/api';
import { toast } from '../stores/toastStore';
import { useAI } from '../contexts/AIContext';
import { SystemDesignCanvas } from '../components/learning/SystemDesignCanvas';
import { cn } from '../lib/utils';

const CATEGORIES = [
    { value: '', label: 'All Clusters' },
    { value: 'node', label: 'Node.js Runtime' },
    { value: 'express', label: 'Express Framework' },
    { value: 'database', label: 'Data Persistence' },
    { value: 'auth', label: 'Identity & Auth' },
    { value: 'api', label: 'Interface Design' },
    { value: 'system-design', label: 'Architecture' },
    { value: 'devops', label: 'Orchestration' },
    { value: 'security', label: 'Cyber Security' },
    { value: 'performance', label: 'Optimization' },
];

const categoryIconMap: Record<string, any> = {
    node: Binary,
    express: Server,
    database: Database,
    auth: Shield,
    api: Globe,
    'system-design': Layers,
    devops: Settings,
    security: Shield,
    testing: Code,
    performance: Activity,
};

export function BackendTopics() {
    const navigate = useNavigate();
    const [topics, setTopics] = useState<BackendTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSRSModal, setShowSRSModal] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showReviewDueOnly, setShowReviewDueOnly] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { toggleOpen } = useAI();

    const fetchTopics = useCallback(async () => {
        setIsLoading(true);
        try {
            const limit = search ? 100 : 12;
            const response = await api.getBackendTopics(page, limit, categoryFilter || undefined);
            setTopics(response.topics || []);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch topics:', error);
            toast.error('Sector data sync failed.');
        } finally {
            setIsLoading(false);
        }
    }, [page, categoryFilter, search]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    const handleConfirmDelete = async () => {
        if (!topicToDelete) return;
        setIsDeleting(true);
        try {
            await api.deleteBackendTopic(topicToDelete);
            toast.success('Topic purged from module.');
            fetchTopics();
            setDeleteModalOpen(false);
        } catch (error: any) {
            toast.error('Purge failure.');
        } finally {
            setIsDeleting(false);
        }
    };

    const stats = useMemo(() => {
        const total = topics.length;
        const completed = topics.filter(t => t.status === 'completed').length;
        const mastery = total === 0 ? 0 : Math.round((completed / total) * 100);
        const reviewDue = topics.filter(t => t.nextReviewDate && new Date(t.nextReviewDate) <= new Date()).length;
        return { total, completed, mastery, reviewDue };
    }, [topics]);

    const filteredTopics = useMemo(() => {
        let result = [...topics];
        if (search) {
            result = result.filter(t => t.topicName.toLowerCase().includes(search.toLowerCase()));
        }
        if (showReviewDueOnly) {
            result = result.filter(t => t.nextReviewDate && new Date(t.nextReviewDate) <= new Date());
        }
        
        if (sortBy === 'newest') result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sortBy === 'name') result.sort((a, b) => a.topicName.localeCompare(b.topicName));
        
        return result;
    }, [topics, search, sortBy, showReviewDueOnly]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-20">
            {/* Immersive Header */}
            <div className="relative overflow-hidden rounded-[3rem] bg-console-surface/30 border border-white/5 p-8 lg:p-12">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-accent-primary font-black uppercase tracking-[0.3em] text-[10px]">
                            <Compass size={14} className="animate-spin-slow" />
                            Backend Architecture Domain
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-black text-text-primary tracking-tighter leading-none">
                            System <span className="text-accent-primary">Intelligence</span>
                        </h1>
                        <p className="text-text-muted text-lg max-w-xl font-medium tracking-tight">
                            Master the mechanics of high-performance backend systems. Track execution flow, decipher logic, and maintain architectural integrity.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setShowSRSModal(true)}
                            className="h-14 px-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md text-text-secondary hover:text-text-primary font-bold"
                        >
                            <Zap size={18} className="mr-2 text-amber-500" /> Review Matrix
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => navigate('/backend/new')}
                            className="h-14 px-8 rounded-2xl bg-gradient-to-r from-accent-primary to-blue-500 text-white font-black shadow-xl shadow-accent-primary/20 scale-105 hover:scale-110 transition-transform"
                        >
                            <Plus size={20} className="mr-2" /> Initialize Topic
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
                    {[
                        { label: 'System Topics', value: stats.total, icon: Server, color: 'text-blue-400' },
                        { label: 'Deployments', value: stats.completed, icon: CheckCircle2, color: 'text-green-400' },
                        { label: 'Due for Audit', value: stats.reviewDue, icon: RefreshCw, color: 'text-amber-400', pulse: stats.reviewDue > 0 },
                        { label: 'Mastery Level', value: `${stats.mastery}%`, icon: Zap, color: 'text-accent-primary' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-console-bg/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex items-center gap-5 group hover:border-accent-primary/20 transition-all">
                            <div className={cn("p-4 rounded-2xl bg-white/5", stat.color, stat.pulse && "animate-pulse")}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-text-primary">{stat.value}</div>
                                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-console-surface/70 backdrop-blur-xl border border-border-subtle/40 p-4 rounded-[2rem]">
                <div className="flex flex-1 items-center gap-4 w-full">
                    <div className="relative flex-1 group">
                        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" />
                        <Input
                            placeholder="Seek topic..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-14 h-14 bg-console-bg/80 border-border-subtle/30 rounded-2xl text-base"
                        />
                    </div>
                    <div className="hidden lg:flex items-center gap-2 p-1.5 bg-console-bg/80 rounded-2xl border border-border-subtle/30">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-3 rounded-xl transition-all",
                                viewMode === 'list' ? "bg-accent-primary text-white shadow-lg" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('canvas')}
                            className={cn(
                                "p-3 rounded-xl transition-all",
                                viewMode === 'canvas' ? "bg-accent-primary text-white shadow-lg" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <LayoutGrid size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <Select
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={CATEGORIES}
                        className="flex-1 lg:w-64 h-14 bg-console-bg/50 border-white/5 rounded-2xl"
                    />
                    <Button
                        variant={showReviewDueOnly ? 'primary' : 'secondary'}
                        onClick={() => setShowReviewDueOnly(!showReviewDueOnly)}
                        className={cn(
                            "h-14 px-6 rounded-2xl font-bold whitespace-nowrap",
                            showReviewDueOnly ? "bg-amber-500 text-white" : "bg-console-bg/50 border border-white/5"
                        )}
                    >
                        <RefreshCw size={18} className={cn("mr-2", showReviewDueOnly && "animate-spin-slow")} />
                        Audit Due
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                    >
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-64 rounded-[2.5rem] bg-console-surface/30 animate-pulse border border-white/5" />
                        ))}
                    </motion.div>
                ) : viewMode === 'canvas' ? (
                    <motion.div
                        key="canvas"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full bg-console-surface/20 rounded-[3rem] border border-white/5 overflow-hidden shadow-inner"
                    >
                        <SystemDesignCanvas 
                            topics={filteredTopics} 
                            onNodeClick={(id) => navigate(`/backend/${id}`)}
                        />
                    </motion.div>
                ) : filteredTopics.length === 0 ? (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-32 flex flex-col items-center justify-center text-center space-y-6"
                    >
                        <div className="w-24 h-24 bg-console-surface/50 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
                            <Terminal size={40} className="text-text-disabled" />
                        </div>
                        <div className="space-y-2">
                             <h3 className="text-2xl font-black text-text-primary">System Void Detected</h3>
                             <p className="text-text-muted max-w-sm font-medium">No topics identified in this sector. Execute initialization to proceed.</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                    >
                        {filteredTopics.map((topic, i) => (
                            <motion.div
                                key={topic._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => navigate(`/backend/${topic._id}`)}
                                className="group relative bg-console-surface/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 hover:bg-console-surface/50 hover:border-accent-primary/30 transition-all duration-500 cursor-pointer shadow-elevation-1 hover:shadow-elevation-premium"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="p-3 bg-accent-primary/10 rounded-2xl text-accent-primary">
                                         <Zap size={20} />
                                     </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-console-bg rounded-[1.5rem] border border-white/5 group-hover:bg-accent-primary/10 group-hover:border-accent-primary/30 transition-all shadow-inner">
                                            {(() => {
                                                const Icon = categoryIconMap[topic.category] || Server;
                                                return <Icon size={24} className="text-text-muted group-hover:text-accent-primary" />;
                                            })()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xl font-black text-text-primary truncate tracking-tight">{topic.topicName}</h3>
                                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{topic.category.replace('-', ' ')}</div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <StatusBadge status={topic.status as any} />
                                        {topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() && (
                                            <Badge variant="warning" className="animate-pulse">Audit Due</Badge>
                                        )}
                                        {topic.reviewStage && (
                                             <Badge variant="purple">Lvl {topic.reviewStage}</Badge>
                                        )}
                                    </div>

                                    {topic.notes && (
                                        <p className="text-sm text-text-muted line-clamp-2 italic font-medium leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                                            "{topic.notes}"
                                        </p>
                                    )}

                                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5">
                                                <History size={12} className="text-blue-400" />
                                                {new Date(topic.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                            {topic.timeSpent && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} className="text-green-400" />
                                                    {topic.timeSpent}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(topic._id);
                                            }}
                                            className="p-3 text-text-muted hover:text-status-error hover:bg-status-error/10 rounded-xl transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <SRSInfoModal isOpen={showSRSModal} onClose={() => setShowSRSModal(false)} />
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="System Purge"
                description="This action will permanently erase the architectural record for this topic."
                isDeleting={isDeleting}
            />
        </div>
    );
}

const History = ({ size, className }: { size: number, className: string }) => (
    <Clock size={size} className={className} />
);
