import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, Code2, SlidersHorizontal, 
    Award, BrainCircuit, Edit2, Trash2, Hexagon, Binary, Activity, Compass, Zap, Target,
    Terminal, Globe, Cpu
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge, DifficultyBadge, StatusBadge } from '../components/ui/Badge';
import { SRSInfoModal } from '../components/ui/SRSInfoModal';
import { DeleteModal } from '../components/ui/DeleteModal';
import { api, type DSAProblem } from '../services/api';
import { toast } from '../stores/toastStore';
import { TOPICS, DIFFICULTIES, difficultyColors } from '../lib/constants';
import { useAI } from '../contexts/AIContext';
import { cn } from '../lib/utils';

export function DSATracking() {
    const navigate = useNavigate();
    const [problems, setProblems] = useState<DSAProblem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSRSModal, setShowSRSModal] = useState(false);
    const [search, setSearch] = useState('');
    const [topicFilter, setTopicFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [showReviewDueOnly, setShowReviewDueOnly] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { toggleOpen } = useAI();

    const fetchProblems = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.getDSAProblems(page, 12, topicFilter || undefined, difficultyFilter || undefined);
            setProblems(response.problems || []);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch problems:', error);
            toast.error('Sector sync failed.');
        } finally {
            setIsLoading(false);
        }
    }, [page, topicFilter, difficultyFilter]);

    useEffect(() => {
        fetchProblems();
    }, [fetchProblems]);

    const handleConfirmDelete = async () => {
        if (!problemToDelete) return;
        setIsDeleting(true);
        try {
            await api.deleteDSAProblem(problemToDelete);
            toast.success('Record purged.');
            fetchProblems();
            setDeleteModalOpen(false);
        } catch (error: any) {
            toast.error('Purge failure.');
        } finally {
            setIsDeleting(false);
        }
    };

    const stats = useMemo(() => {
        const total = pagination.total;
        const solved = problems.filter(p => p.status === 'solved').length;
        const efficiency = total === 0 ? 0 : Math.round((solved / total) * 100);
        const reviewDue = problems.filter(p => p.nextReviewDate && new Date(p.nextReviewDate) <= new Date()).length;
        return { total, solved, efficiency, reviewDue };
    }, [problems, pagination.total]);

    const filteredProblems = useMemo(() => {
        let result = [...problems];
        if (search) {
            result = result.filter(p => p.problemName.toLowerCase().includes(search.toLowerCase()));
        }
        if (showReviewDueOnly) {
            result = result.filter(p => p.nextReviewDate && new Date(p.nextReviewDate) <= new Date());
        }
        return result;
    }, [problems, search, showReviewDueOnly]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-20">
            {/* Immersive Header */}
            <div className="relative overflow-hidden rounded-[3rem] bg-console-surface/30 border border-white/5 p-8 lg:p-12">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">
                            <Target size={14} className="animate-pulse" />
                            Algorithmic Mastery Domain
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-black text-text-primary tracking-tighter leading-none">
                            DSA <span className="text-emerald-400">Intelligence</span>
                        </h1>
                        <p className="text-text-muted text-lg max-w-xl font-medium tracking-tight">
                            Optimize your mental runtime. Map data structures, audit complexities, and master the mechanics of efficient problem solving.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setShowSRSModal(true)}
                            className="h-14 px-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md text-text-secondary hover:text-text-primary font-bold"
                        >
                            <Zap size={18} className="mr-2 text-emerald-400" /> Audit Matrix
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => navigate('/dsa/new')}
                            className="h-14 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-xl shadow-emerald-500/20 scale-105 hover:scale-110 transition-transform"
                        >
                            <Plus size={20} className="mr-2" /> Initialize Problem
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
                    {[
                        { label: 'Total Problems', value: stats.total, icon: Code2, color: 'text-emerald-400' },
                        { label: 'Solved Archives', value: stats.solved, icon: CheckCircle2, color: 'text-teal-400' },
                        { label: 'Audit Required', value: stats.reviewDue, icon: RefreshCw, color: 'text-amber-400', pulse: stats.reviewDue > 0 },
                        { label: 'Runtime Accuracy', value: `${stats.efficiency}%`, icon: Activity, color: 'text-emerald-400' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-console-bg/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex items-center gap-5 group hover:border-emerald-500/20 transition-all">
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

            {/* Controls Bar - Ultra-Minimalist */}
            <div className="flex flex-wrap items-center gap-2 p-1 bg-console-surface/10 backdrop-blur-sm border border-border-subtle/30 rounded-lg w-fit">
                <div className="relative w-40 group">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-emerald-400 transition-colors" />
                    <Input
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-7 bg-transparent border-transparent hover:border-border-subtle/50 rounded-md text-[10px] placeholder:text-text-disabled/40 w-full"
                    />
                </div>

                <div className="h-4 w-px bg-border-subtle/50 mx-1 hidden lg:block" />

                <Select
                    value={topicFilter}
                    onChange={setTopicFilter}
                    options={TOPICS}
                    className="w-32 h-7 bg-transparent border-transparent hover:bg-console-surface/20 rounded-md text-[10px] text-text-secondary"
                />
                <Select
                    value={difficultyFilter}
                    onChange={setDifficultyFilter}
                    options={DIFFICULTIES}
                    className="w-24 h-7 bg-transparent border-transparent hover:bg-console-surface/20 rounded-md text-[10px] text-text-secondary"
                />
                
                <div className="h-4 w-px bg-border-subtle/50 mx-1 hidden lg:block" />

                <Button
                    variant={showReviewDueOnly ? 'primary' : 'secondary'}
                    onClick={() => setShowReviewDueOnly(!showReviewDueOnly)}
                    className={cn(
                        "h-7 px-3 rounded-md font-bold whitespace-nowrap text-[9px] uppercase tracking-tighter transition-all",
                        showReviewDueOnly 
                            ? "bg-amber-500/80 text-white" 
                            : "bg-transparent text-text-muted hover:text-text-secondary hover:bg-console-surface/30"
                    )}
                >
                    <RefreshCw size={10} className={cn("mr-1.5", showReviewDueOnly && "animate-spin-slow")} />
                    Audit
                </Button>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                    >
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-48 rounded-[2.5rem] bg-console-surface/30 animate-pulse border border-white/5" />
                        ))}
                    </motion.div>
                ) : filteredProblems.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-32 flex flex-col items-center justify-center text-center space-y-6"
                    >
                        <div className="w-24 h-24 bg-console-surface/50 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
                            <Binary size={40} className="text-text-disabled" />
                        </div>
                        <div className="space-y-2">
                             <h3 className="text-2xl font-black text-text-primary">Problem Void</h3>
                             <p className="text-text-muted max-w-sm font-medium">No algorithmic records identified in this sector. Execute initialization to proceed.</p>
                        </div>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProblems.map((problem, i) => (
                            <motion.div
                                key={problem._id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => navigate(`/dsa/${problem._id}`)}
                                className={cn(
                                    "group relative bg-console-surface/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 hover:bg-console-surface/50 transition-all duration-500 cursor-pointer shadow-elevation-1 hover:shadow-elevation-premium overflow-hidden",
                                    `hover:border-${problem.difficulty === 'hard' ? 'status-error' : problem.difficulty === 'medium' ? 'status-warning' : 'status-ok'}/30`
                                )}
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                         <Hexagon size={20} />
                                     </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "p-4 rounded-[1.5rem] border border-white/5 transition-all shadow-inner bg-console-bg",
                                            difficultyColors[problem.difficulty as keyof typeof difficultyColors]?.replace('text-', 'bg-').replace('border-', 'border-') + '/10'
                                        )}>
                                            <Binary size={24} className={difficultyColors[problem.difficulty as keyof typeof difficultyColors]} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xl font-black text-text-primary truncate tracking-tight">{problem.problemName}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <DifficultyBadge difficulty={problem.difficulty} />
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{problem.platform}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <StatusBadge status={problem.status} />
                                        {problem.nextReviewDate && new Date(problem.nextReviewDate) <= new Date() && (
                                            <Badge variant="warning" className="animate-pulse">Audit Due</Badge>
                                        )}
                                        {problem.reviewStage && problem.reviewStage > 0 && (
                                             <Badge variant="purple">Matrix {problem.reviewStage}</Badge>
                                        )}
                                    </div>

                                    {problem.topic && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 w-fit">
                                            <Compass size={12} className="text-blue-400" />
                                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{problem.topic}</span>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5">
                                                <History size={12} className="text-emerald-400" />
                                                {new Date(problem.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProblemToDelete(problem._id);
                                                setDeleteModalOpen(true);
                                            }}
                                            className="p-3 text-text-muted hover:text-status-error hover:bg-status-error/10 rounded-xl transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Difficulty Watermark */}
                                <div className={cn(
                                    "absolute -left-4 -bottom-4 opacity-[0.02] rotate-12 pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-500",
                                    difficultyColors[problem.difficulty as keyof typeof difficultyColors]
                                )}>
                                    <Binary size={120} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Pagination */}
            {!isLoading && pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-6 pt-10">
                    <Button
                        variant="ghost"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-14 w-14 rounded-2xl border border-white/5 bg-console-surface/50"
                    >
                        <ChevronLeft size={24} />
                    </Button>
                    <div className="px-6 py-3 bg-console-surface/50 border border-white/5 rounded-2xl text-sm font-black uppercase tracking-widest text-text-muted">
                        Sector {page} / {pagination.pages}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                        disabled={page === pagination.pages}
                        className="h-14 w-14 rounded-2xl border border-white/5 bg-console-surface/50"
                    >
                        <ChevronRight size={24} />
                    </Button>
                </div>
            )}

            <SRSInfoModal isOpen={showSRSModal} onClose={() => setShowSRSModal(false)} />
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Sector Purge"
                description="This action will permanently erase the algorithmic archive for this problem."
                isDeleting={isDeleting}
            />
        </div>
    );
}

const History = ({ size, className }: { size: number, className: string }) => (
    <Clock size={size} className={className} />
);

const Clock = ({ size, className }: { size: number, className: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
);
