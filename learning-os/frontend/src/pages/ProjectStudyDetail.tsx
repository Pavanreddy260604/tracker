import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Download,
    AlertCircle,
    LayoutGrid,
    BrainCircuit
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ProjectStudyForm } from '../components/forms/ProjectStudyForm';
import { useAutoSave } from '../hooks/useAutoSave';
import { projectsApi } from '../services/projects.api';
import type { ProjectStudy } from '../services/types';
import { toast } from '../stores/toastStore';
import { cn } from '../lib/utils';
import { useAI } from '../contexts/AIContext';

export function ProjectStudyDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [study, setStudy] = useState<ProjectStudy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { setContext, toggleOpen } = useAI();

    useEffect(() => {
        if (study) {
            setContext({ type: 'Project', data: study });
        }
        return () => {
            setContext(null);
        };
    }, [study, setContext]);

    const { status, lastSaved, handleChange } = useAutoSave<Partial<ProjectStudy>>({
        onSave: async (data) => {
            if (!id || id === 'new') return;

            // Phase 36: Intelligent Auto-Promotion
            if (study && !study.flowUnderstood) {
                const taskProgress = study.tasks && study.tasks.length > 0
                    ? study.tasks.filter(t => t.status === 'done').length / study.tasks.length
                    : 0;
                const takeawayCount = study.keyTakeaways?.length || 0;

                if (taskProgress >= 0.8 || takeawayCount >= 3) {
                    data.flowUnderstood = true;
                    toast.success('Project promoted to "Understood"!');
                }
            }

            await projectsApi.updateProjectStudy(id, data);
        }
    });

    useEffect(() => {
        const fetchStudy = async () => {
            if (!id) return;
            if (id === 'new') {
                setIsLoading(false);
                return;
            }
            try {
                const response = await projectsApi.getProjectStudy(id);
                setStudy(response.study);
            } catch (err) {
                console.error('Failed to fetch study:', err);
                setError('Project study not found');
            } finally {
                setIsLoading(false);
            }
        };
        fetchStudy();
    }, [id]);


    if (isLoading) {
        return (
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center gap-4 border-b border-border-subtle pb-6">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-64" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6">
                        <Skeleton className="h-[300px] w-full rounded-2xl" />
                        <Skeleton className="h-[150px] w-full rounded-2xl" />
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-[200px] w-full rounded-2xl" />
                        <div className="grid grid-cols-2 gap-6">
                            <Skeleton className="h-[200px] w-full rounded-2xl" />
                            <Skeleton className="h-[200px] w-full rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || (!study && id !== 'new')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <AlertCircle size={48} className="text-status-error" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Study Not Found</h2>
                <Button onClick={() => navigate('/projects')} leftIcon={<ArrowLeft size={16} />}>
                    Back to Projects
                </Button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-6 pb-20 relative"
        >
            {/* Phase 19: Sticky Action Bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-console-elevated/80 backdrop-blur-md border border-border-subtle px-4 py-3 rounded-2xl shadow-strong border-t border-accent-primary/10 transition-all duration-300">
                <div className="flex items-center gap-2 pr-4 border-r border-border-subtle mr-1">
                    <div className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-300",
                        status === 'saving' ? "bg-accent-primary animate-pulse" :
                            status === 'saved' ? "bg-status-ok" : "bg-text-disabled"
                    )} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                        {status === 'saving' ? 'Saving...' : status === 'saved' ? `Saved ${lastSaved?.toLocaleTimeString()}` : 'Workspace Synced'}
                    </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { }} leftIcon={<Download size={16} />}>
                    Export
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/projects')}>
                    Done
                </Button>
            </div>

            {/* Page-level header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent-primary/10 rounded-2xl">
                        <LayoutGrid size={24} className="text-accent-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">Project Analysis</span>
                            <Badge variant="info" className="text-[10px]">{study?.moduleStudied || 'New Module'}</Badge>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {study?.projectName || 'Project Workspace'}
                        </h1>

                        {/* Progress Indicator */}
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-1.5 bg-console-surface border border-border-subtle rounded-full overflow-hidden max-w-[200px]">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${study?.tasks && study.tasks.length > 0
                                            ? Math.round((study.tasks.filter(t => t.status === 'done').length / study.tasks.length) * 100)
                                            : 0}%`
                                    }}
                                    className="h-full bg-accent-primary"
                                />
                            </div>
                            <span className="text-[10px] font-bold text-text-disabled uppercase">
                                {study?.tasks && study.tasks.length > 0
                                    ? `${Math.round((study.tasks.filter(t => t.status === 'done').length / study.tasks.length) * 100)}% Complete`
                                    : 'No Tasks'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-3">
                    <button
                        onClick={toggleOpen}
                        className="p-2 rounded-full hover:bg-accent-primary/10 text-accent-primary transition-colors active:scale-95"
                        title="Ask AI helper"
                    >
                        <BrainCircuit size={22} />
                    </button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/projects')}
                        leftIcon={<ArrowLeft size={16} />}
                        className="text-text-disabled hover:text-text-primary"
                    >
                        Back to Projects
                    </Button>
                </div>
            </div>

            <div className="bg-console-surface border border-border-subtle rounded-2xl p-8 shadow-premium">
                {study && (
                    <ProjectStudyForm
                        initialValues={study}
                        onSuccess={() => toast.success('Changes saved')}
                        onChange={(data: any) => handleChange(data)}
                    />
                )}
            </div>
        </motion.div>
    );
}
