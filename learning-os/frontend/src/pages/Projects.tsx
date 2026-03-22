import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, FolderGit2, Edit2, Trash2, ChevronLeft, ChevronRight, ExternalLink,
    CheckCircle2, Database, HelpCircle, BrainCircuit, Workflow, Activity, Compass, 
    Layers, Github, History, Zap, Code2, LayoutGrid, Terminal
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { DeleteModal } from '../components/ui/DeleteModal';
import { api, type ProjectStudy } from '../services/api';
import { toast } from '../stores/toastStore';
import { useAI } from '../contexts/AIContext';
import { cn } from '../lib/utils';

const SAMPLE_PROJECTS = [
    {
        projectName: 'React Source Code',
        repoUrl: 'https://github.com/facebook/react',
        moduleStudied: 'Reconciliation',
        flowUnderstanding: 'React uses a virtual DOM to optimize updates. The reconciliation process (Fiber) breaks work into units to avoid blocking the main thread.',
        coreComponents: 'FiberNode, current/workInProgress trees',
        questions: 'How does concurrent mode specifically pause and resume work?',
        notes: 'Fiber is a reimplementation of the stack reconciler.',
        keyTakeaways: ['Virtual DOM is just a plain object tree', 'Keys are crucial for list performance'],
        tasks: [
            { id: '1', text: 'Read FiberNode structure', status: 'done' },
            { id: '2', text: 'Trace useState implementation', status: 'in-progress' }
        ],
        confidenceLevel: 4,
        simpleExplanation: 'It\'s like a smart todo list for the browser that only updates what actually changed.',
        flowUnderstood: true
    },
    {
        projectName: 'Node.js Core',
        repoUrl: 'https://github.com/nodejs/node',
        moduleStudied: 'Event Loop (libuv)',
        flowUnderstanding: 'The event loop has multiple phases (timers, pending callbacks, poll, check, close). process.nextTick runs before any phase.',
        coreComponents: 'uv_loop_t, watcher_queue',
        questions: 'Difference between setImmediate and process.nextTick in depth?',
        notes: 'Libuv handles the I/O operations asynchronously.',
        keyTakeaways: ['Don\'t block the Event Loop', 'Worker threads are for CPU intensive tasks'],
        tasks: [
            { id: '1', text: 'Check C++ to JS bindings', status: 'todo' },
            { id: '2', text: 'Debug a slow FS operation', status: 'done' }
        ],
        confidenceLevel: 3,
        simpleExplanation: 'It\'s a waiter that takes orders and notifies the kitchen, but doesn\'t cook the food himself.',
        flowUnderstood: true
    }
] as const;

export function Projects() {
    const navigate = useNavigate();
    const [studies, setStudies] = useState<ProjectStudy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [isSeeding, setIsSeeding] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [studyToDelete, setStudyToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { toggleOpen } = useAI();

    const fetchStudies = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.getProjectStudies(page, 12);
            setStudies(response.studies || []);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch studies:', error);
            toast.error('Workspace sync failed.');
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchStudies();
    }, [fetchStudies]);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            for (const project of SAMPLE_PROJECTS) {
                await api.createProjectStudy({
                    ...project,
                    keyTakeaways: [...project.keyTakeaways],
                    tasks: project.tasks.map(t => ({ ...t, status: t.status as any })),
                    date: new Date().toISOString().split('T')[0]
                } as any);
            }
            toast.success('Sample workspaces initialized.');
            fetchStudies();
        } catch (error) {
            toast.error('Initialization failure.');
        } finally {
            setIsSeeding(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!studyToDelete) return;
        setIsDeleting(true);
        try {
            await api.deleteProjectStudy(studyToDelete);
            toast.success('Workspace purged.');
            fetchStudies();
            setDeleteModalOpen(false);
        } catch (error) {
            toast.error('Purge failure.');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredStudies = useMemo(() => {
        return studies.filter(s =>
            s.projectName.toLowerCase().includes(search.toLowerCase()) ||
            s.moduleStudied.toLowerCase().includes(search.toLowerCase())
        );
    }, [studies, search]);

    const projectGroups = useMemo(() => {
        return filteredStudies.reduce((acc, study) => {
            if (!acc[study.projectName]) acc[study.projectName] = [];
            acc[study.projectName].push(study);
            return acc;
        }, {} as Record<string, ProjectStudy[]>);
    }, [filteredStudies]);

    const stats = useMemo(() => {
        const total = studies.length;
        const understood = studies.filter(s => s.flowUnderstood).length;
        const projects = Object.keys(projectGroups).length;
        return { total, understood, projects };
    }, [studies, projectGroups]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-20">
             {/* Immersive Header */}
             <div className="relative overflow-hidden rounded-[3rem] bg-console-surface/30 border border-white/5 p-8 lg:p-12">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-blue-400 font-black uppercase tracking-[0.3em] text-[10px]">
                            <Layers size={14} className="animate-pulse" />
                            Project Architecture Intelligence
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-black text-text-primary tracking-tighter leading-none">
                            Workspace <span className="text-blue-400">Analysis</span>
                        </h1>
                        <p className="text-text-muted text-lg max-w-xl font-medium tracking-tight">
                            Deconstruct complex codebases into actionable mental models. Trace patterns, audit logic, and document system architecture.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                         {studies.length === 0 && (
                            <Button 
                                variant="ghost" 
                                onClick={handleSeedData}
                                isLoading={isSeeding}
                                className="h-14 px-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md text-text-secondary hover:text-text-primary font-bold"
                            >
                                <Database size={18} className="mr-2 text-blue-400" /> Load Samples
                            </Button>
                        )}
                        <Button 
                            variant="primary" 
                            onClick={() => navigate('/projects/new')}
                            className="h-14 px-8 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black shadow-xl shadow-blue-500/20 scale-105 hover:scale-110 transition-transform"
                        >
                            <Plus size={20} className="mr-2" /> Initialize Study
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
                    {[
                        { label: 'Total Sessions', value: stats.total, icon: History, color: 'text-blue-400' },
                        { label: 'Active Clusters', value: stats.projects, icon: LayoutGrid, color: 'text-indigo-400' },
                        { label: 'Logic Deciphered', value: stats.understood, icon: CheckCircle2, color: 'text-green-400' },
                        { label: 'Pending Audit', value: stats.total - stats.understood, icon: HelpCircle, color: 'text-amber-400' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-console-bg/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex items-center gap-5 group hover:border-blue-500/20 transition-all">
                            <div className={cn("p-4 rounded-2xl bg-white/5", stat.color)}>
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

            {/* Search Bar */}
            <div className="relative group max-w-2xl mx-auto">
                <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-blue-400 transition-colors" />
                <Input
                    placeholder="Search workspaces, repos, or modules..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-16 h-16 bg-console-surface/70 backdrop-blur-xl border-border-subtle/40 rounded-[2rem] text-lg font-medium shadow-elevation-1 focus:shadow-elevation-premium transition-all"
                />
            </div>

            {/* Content Area */}
            <div className="space-y-12">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             {[1, 2, 3, 4].map(i => (
                                 <div key={i} className="h-48 rounded-[2.5rem] bg-console-surface/30 animate-pulse border border-white/5" />
                             ))}
                         </div>
                    ) : Object.keys(projectGroups).length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="py-32 flex flex-col items-center justify-center text-center space-y-6"
                        >
                            <div className="w-24 h-24 bg-console-surface/50 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl">
                                <FolderGit2 size={40} className="text-text-disabled" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-text-primary">Workspace Empty</h3>
                                <p className="text-text-muted max-w-sm font-medium">Initialize a new project study to begin architectural analysis.</p>
                            </div>
                        </motion.div>
                    ) : (
                        Object.entries(projectGroups).map(([projectName, groupStudies], groupIndex) => (
                            <motion.div
                                key={projectName}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.1 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-4 px-4">
                                     <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                         <Github size={18} />
                                     </div>
                                     <h2 className="text-2xl font-black text-text-primary tracking-tight">{projectName}</h2>
                                     <Badge variant="outline" className="opacity-50 border-white/10 uppercase tracking-widest text-[9px] font-bold">
                                         {groupStudies.length} ARCHIVES
                                     </Badge>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {groupStudies.map((study, i) => (
                                        <motion.div
                                            key={study._id}
                                            whileHover={{ y: -5 }}
                                            onClick={() => navigate(`/projects/${study._id}`)}
                                            className="group relative bg-console-surface/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 hover:bg-console-surface/50 hover:border-blue-500/30 transition-all duration-500 cursor-pointer shadow-elevation-1 hover:shadow-elevation-premium"
                                        >
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="space-y-4 flex-1 min-w-0">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-blue-500/10 transition-colors">
                                                            <Code2 size={24} className="text-text-muted group-hover:text-blue-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-xl font-black text-text-primary truncate">{study.moduleStudied}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <StatusBadge status={study.flowUnderstood ? 'completed' : 'in_progress'} />
                                                                {study.confidenceLevel && (
                                                                    <div className="flex items-center gap-1 ml-2">
                                                                        {[1,2,3,4,5].map(s => (
                                                                            <div key={s} className={cn("w-1 h-3 rounded-full", s <= (study.confidenceLevel || 0) ? 'bg-blue-400' : 'bg-white/5')} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {study.notes && (
                                                        <p className="text-sm text-text-muted italic line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                                                            "{study.notes}"
                                                        </p>
                                                    )}

                                                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                             <div className="flex items-center gap-1.5 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                                 <History size={12} className="text-blue-400" />
                                                                 {new Date(study.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                             </div>
                                                             {study.tasks && study.tasks.length > 0 && (
                                                                 <div className="flex items-center gap-1.5 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                                     <Workflow size={12} className="text-green-400" />
                                                                     {study.tasks.filter(t => t.status === 'done').length}/{study.tasks.length} TASKS
                                                                 </div>
                                                             )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {study.repoUrl && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        window.open(study.repoUrl, '_blank');
                                                                    }}
                                                                    className="p-3 text-text-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setStudyToDelete(study._id);
                                                                    setDeleteModalOpen(true);
                                                                }}
                                                                className="p-3 text-text-muted hover:text-status-error hover:bg-status-error/10 rounded-xl transition-all"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

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

            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Archive Purge"
                description="This action will permanently erase the architectural record for this workspace."
                isDeleting={isDeleting}
            />
        </div>
    );
}
