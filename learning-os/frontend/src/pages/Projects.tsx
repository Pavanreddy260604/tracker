import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Search,
    FolderGit2,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Database,
    HelpCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ProjectStudyForm } from '../components/forms/ProjectStudyForm';
import { DeleteModal } from '../components/ui/DeleteModal';
import { api, type ProjectStudy } from '../services/api';
import { toast } from '../stores/toastStore';

const SAMPLE_PROJECTS = [
    {
        projectName: 'React Source Code',
        repoUrl: 'https://github.com/facebook/react',
        moduleStudied: 'Reconciliation',
        flowUnderstanding: 'React uses a virtual DOM to optimize updates. The reconciliation process (Fiber) breaks work into units to avoid blocking the main thread. Diffing algorithm uses heuristics (keys, type checks) to update efficiently.',
        involvedTables: 'FiberNode, current/workInProgress trees',
        questions: 'How does concurrent mode specifically pause and resume work?',
        notes: 'Fiber is a reimplementation of the stack reconciler. It allows splitting rendering work into chunks.',
        keyTakeaways: ['Virtual DOM is just a plain object tree', 'Keys are crucial for list performance', 'State updates are batched'],
        tasks: [
            { id: '1', text: 'Read FiberNode structure', status: 'done' },
            { id: '2', text: 'Trace useState implementation', status: 'in-progress' },
            { id: '3', text: 'Understand scheduler priority levels', status: 'todo' }
        ]
    },
    {
        projectName: 'Node.js Core',
        repoUrl: 'https://github.com/nodejs/node',
        moduleStudied: 'Event Loop (libuv)',
        flowUnderstanding: 'The event loop has multiple phases (timers, pending callbacks, poll, check, close). process.nextTick runs before any phase. Promises (microtasks) run between phases.',
        involvedTables: 'uv_loop_t, watcher_queue',
        questions: 'Difference between setImmediate and process.nextTick in depth?',
        notes: 'Libuv handles the I/O operations asynchronously and interfaces with the OS.',
        keyTakeaways: ['Don\'t block the Event Loop', 'Worker threads are for CPU intensive tasks', 'Streams are powerful for data processing'],
        tasks: [
            { id: '1', text: 'Check C++ to JS bindings', status: 'todo' },
            { id: '2', text: 'Debug a slow FS operation', status: 'done' }
        ]
    },
    {
        projectName: 'Linux Kernel',
        repoUrl: 'https://github.com/torvalds/linux',
        moduleStudied: 'Process Scheduler (CFS)',
        flowUnderstanding: 'Completely Fair Scheduler (CFS) models an ideal, precise multi-tasking CPU on real hardware. It uses a red-black tree to track vruntime (virtual runtime).',
        involvedTables: 'task_struct, rb_root',
        questions: 'How is nice value mapped to time slice weights?',
        notes: 'Context switching costs are minimized by using vruntime logic.',
        keyTakeaways: ['Red-black trees offer O(log n) insert/delete', 'Fairness is achieved by time weighting'],
        tasks: [
            { id: '1', text: 'Clone repository', status: 'done' },
            { id: '2', text: 'Locate scheduler.c', status: 'in-progress' }
        ]
    }
] as const;

const MotionCard = motion(Card);

export function Projects() {
    const [studies, setStudies] = useState<ProjectStudy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingStudy, setEditingStudy] = useState<ProjectStudy | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Delete Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [studyToDelete, setStudyToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const fetchStudies = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.getProjectStudies(page, 20);
            setStudies(response.studies);
            setPagination({ total: response.pagination.total, pages: response.pagination.pages });
        } catch (error) {
            console.error('Failed to fetch studies:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchStudies();
    }, [fetchStudies]);

    const handleSeedData = async () => {
        // Removed confirm to ensure immediate action and avoid browser blocking issues.
        // if (!confirm('Add sample project data? This will create 3 new entries.')) return;

        setIsSeeding(true);
        try {
            // Sequential to avoid race conditions or potential rate limits if any
            for (const project of SAMPLE_PROJECTS) {
                await api.createProjectStudy({
                    ...project,
                    // Cast keyTakeaways to mutable array since 'as const' makes it readonly
                    keyTakeaways: [...project.keyTakeaways],
                    // Cast tasks to mutable array and ensure status match
                    tasks: project.tasks.map(t => ({ ...t, status: t.status as 'todo' | 'in-progress' | 'done' })),
                    date: new Date().toISOString().split('T')[0]
                });
            }
            toast.success('Sample projects added successfully');
            fetchStudies();
        } catch (error) {
            console.error('Failed to seed data:', error);
            toast.error('Failed to add sample data');
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDeleteClick = (id: string) => {
        setStudyToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!studyToDelete) return;

        setIsDeleting(true);
        try {
            await api.deleteProjectStudy(studyToDelete);
            toast.success('Study session deleted');
            fetchStudies();
            setDeleteModalOpen(false);
            setStudyToDelete(null);
        } catch (error) {
            console.error('Failed to delete:', error);
            toast.error('Failed to delete study');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredStudies = studies.filter(s =>
        s.projectName.toLowerCase().includes(search.toLowerCase()) ||
        s.moduleStudied.toLowerCase().includes(search.toLowerCase())
    );

    // Group by project name
    const projectGroups = filteredStudies.reduce((acc, study) => {
        if (!acc[study.projectName]) {
            acc[study.projectName] = [];
        }
        acc[study.projectName].push(study);
        return acc;
    }, {} as Record<string, ProjectStudy[]>);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Project Studies</h1>
                    <p className="text-sm text-gray-400 mt-1">Track code reading and project understanding</p>
                </div>
                <div className="flex items-center gap-3">
                    {studies.length === 0 && (
                        <Button
                            variant="secondary"
                            onClick={handleSeedData}
                            isLoading={isSeeding}
                            leftIcon={<Database size={16} />}
                        >
                            Load Sample Data
                        </Button>
                    )}
                    <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={18} />}>
                        Add Study
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Sessions', value: pagination.total, icon: FolderGit2, color: 'text-cyan-400' },
                    { label: 'Projects', value: Object.keys(projectGroups).length, icon: FolderGit2, color: 'text-purple-400' },
                    { label: 'Understood', value: studies.filter(s => s.flowUnderstanding).length, icon: CheckCircle2, color: 'text-green-400' },
                    { label: 'To Revisit', value: studies.filter(s => !s.flowUnderstanding).length, icon: XCircle, color: 'text-amber-400' },
                ].map(stat => (
                    <motion.div
                        key={stat.label}
                        className="p-4 rounded-xl bg-[#1c2128] border border-white/10"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon size={16} className={stat.color} />
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
                        </div>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                    placeholder="Search projects or modules..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-11"
                />
            </div>

            {/* Studies List */}
            {isLoading ? (
                <div className="space-y-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-3">
                            <div className="flex items-center gap-3 mb-3">
                                <Skeleton className="h-5 w-5 rounded bg-gray-700/50" />
                                <Skeleton className="h-6 w-40 bg-gray-700/50" />
                                <Skeleton className="h-5 w-20 rounded-full bg-gray-700/30" />
                            </div>
                            <div className="ml-7 space-y-3">
                                <div className="p-4 rounded-xl bg-[#1c2128] border border-white/5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-6 w-1/3 bg-gray-700/50" />
                                            <div className="flex gap-2">
                                                <Skeleton className="h-4 w-24 bg-gray-700/50" />
                                                <Skeleton className="h-4 w-32 bg-gray-700/50" />
                                            </div>
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-3/4 bg-gray-700/30" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredStudies.length === 0 ? (
                <EmptyState
                    icon={<FolderGit2 size={32} className="text-gray-300" />}
                    title="No study sessions found"
                    description={search
                        ? "Try a different search term"
                        : "Start reading project code and documenting your learnings"
                    }
                    action={!search ? {
                        label: 'Add First Study',
                        onClick: () => setShowAddModal(true),
                    } : undefined}
                />
            ) : (
                <div className="space-y-6">
                    <AnimatePresence mode="popLayout">
                        {Object.entries(projectGroups).map(([projectName, projectStudies], groupIndex) => (
                            <motion.div
                                key={projectName}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                            >
                                {/* Project Header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <FolderGit2 size={20} className="text-gray-300" />
                                    <h2 className="text-lg font-semibold text-white">{projectName}</h2>
                                    <Badge variant="info">{projectStudies.length} sessions</Badge>
                                </div>

                                {/* Project Studies */}
                                <AnimatePresence mode="popLayout">
                                    {projectStudies.map((study, index) => (
                                        <MotionCard
                                            key={study._id}
                                            className={`p-4 border-l-4 ${study.flowUnderstanding ? 'border-l-green-500' : 'border-l-amber-500'} rounded-xl bg-[#1c2128] border border-white/10 hover:border-white/20 transition-colors`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: index * 0.03 }}
                                            hover={true}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-semibold text-white truncate">
                                                            {study.moduleStudied}
                                                        </h3>
                                                        {study.flowUnderstanding ? (
                                                            <Badge variant="success">
                                                                <CheckCircle2 size={12} className="mr-1" />
                                                                Understood
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="warning">
                                                                <HelpCircle size={12} className="mr-1" />
                                                                Revisit
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                                        <span>{new Date(study.date).toLocaleDateString()}</span>
                                                        {study.involvedTables && (
                                                            <span className="flex items-center gap-1">
                                                                <Database size={14} />
                                                                {study.involvedTables}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {study.questions && (
                                                        <p className="mt-2 text-sm text-amber-400/80">
                                                            ❓ {study.questions}
                                                        </p>
                                                    )}

                                                    {study.notes && (
                                                        <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                                                            {study.notes}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {study.repoUrl && (
                                                        <a
                                                            href={study.repoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-900 transition-colors"
                                                        >
                                                            <ExternalLink size={18} />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => setEditingStudy(study)}
                                                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-900 transition-colors"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(study._id)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </MotionCard>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
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

            {/* Add Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add Study Session"
                size="lg"
            >
                <ProjectStudyForm
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchStudies();
                    }}
                    onCancel={() => setShowAddModal(false)}
                />
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingStudy}
                onClose={() => setEditingStudy(null)}
                title="Edit Study"
                size="lg"
            >
                {editingStudy && (
                    <ProjectStudyForm
                        initialValues={editingStudy}
                        onSuccess={() => {
                            setEditingStudy(null);
                            fetchStudies();
                        }}
                        onCancel={() => setEditingStudy(null)}
                    />
                )}
            </Modal>

            {/* Delete Modal */}
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Study"
                description="Are you sure you want to delete this study session? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </div >
    );
}
