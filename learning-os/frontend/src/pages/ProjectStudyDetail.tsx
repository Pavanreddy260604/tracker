import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, LayoutGrid, Cpu, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProjectStudyForm } from '../components/forms/ProjectStudyForm';
import { useAutoSave } from '../hooks/useAutoSave';
import { projectsApi } from '../services/projects.api';
import type { ProjectStudy } from '../services/types';
import { toast } from '../stores/toastStore';
import { cn } from '../lib/utils';
import { useRoutedEntity } from '../hooks/useRoutedEntity';
import { useAIContextTracker } from '../contexts/AIContext';

export function ProjectStudyDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const fetchStudy = useCallback(async (entityId: string) => {
        const response = await projectsApi.getProjectStudy(entityId);
        return response.study;
    }, []);

    const { entity: study, isLoading, error, isTransitioning } = useRoutedEntity<ProjectStudy>(
        id,
        fetchStudy,
        'Project workspace not found in the learning grid'
    );

    // Sync context with AI Assistant
    useAIContextTracker('Project Study', study);

    const { status, lastSaved, handleChange } = useAutoSave<Partial<ProjectStudy>>({
        onSave: async (data) => {
            if (!id || id === 'new') return;
            
            // Intelligent Auto-Promotion
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

    if (isLoading || isTransitioning) {
        return (
            <div className="max-w-6xl mx-auto space-y-12 animate-pulse py-4">
                <div className="flex items-center gap-10 border-b border-border-subtle pb-12">
                    <div className="h-24 w-24 rounded-[2rem] bg-console-surface-2 border border-border-subtle shadow-inner" />
                    <div className="space-y-4 flex-1">
                        <div className="h-4 w-40 bg-console-surface-3 rounded-full opacity-40" />
                        <div className="h-12 w-1/2 bg-console-surface-2 rounded-2xl" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <div className="lg:col-span-2 h-[800px] w-full bg-console-surface/50 rounded-[3rem] border border-border-subtle" />
                   <div className="h-[400px] w-full bg-console-surface/50 rounded-[2.5rem] border border-border-subtle" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 p-16 text-center animate-in zoom-in duration-500">
                <div className="p-10 bg-status-error/10 rounded-[2.5rem] border border-status-error/20 shadow-2xl shadow-status-error/5">
                    <AlertCircle size={72} className="text-status-error" />
                </div>
                <div className="space-y-4">
                    <h2 className="text-5xl font-black text-text-primary tracking-tighter italic">Workspace Offline</h2>
                    <p className="text-text-secondary max-w-lg mx-auto font-medium text-xl leading-relaxed">
                        This project study environment could not be initialized. The learning matrix may be undergoing maintenance.
                    </p>
                </div>
                <Button 
                    variant="primary" 
                    size="lg"
                    onClick={() => navigate('/projects')} 
                    leftIcon={<ArrowLeft size={24} />}
                    className="mt-6 px-12 py-8 rounded-[1.5rem] shadow-2xl shadow-accent-primary/20 text-lg font-bold"
                >
                    Return to Projects
                </Button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.99, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-6xl mx-auto space-y-10 pb-40 relative"
        >
            {/* Immersive Save Bar */}
            {id !== 'new' && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-console-elevated/95 backdrop-blur-2xl border border-border-strong/30 px-6 py-4 rounded-[2rem] shadow-elevation-3 border-t border-accent-primary/20 transition-all duration-500 hover:scale-105">
                    <div className="flex items-center gap-3 pr-6 border-r border-border-strong/30 mr-2">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full transition-all duration-500 shadow-sm",
                            status === 'saving' ? "bg-accent-primary animate-ping" :
                                status === 'saved' ? "bg-status-ok shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-text-disabled"
                        )} />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted leading-none mb-1">
                                {status === 'saving' ? 'Synchronizing' : 'Cloud Sync'}
                            </span>
                            <span className="text-[11px] font-bold text-text-secondary whitespace-nowrap">
                                {status === 'saving' ? 'Writing buffer...' : status === 'saved' ? `Saved at ${lastSaved?.toLocaleTimeString()}` : 'Workspace Ready'}
                            </span>
                        </div>
                    </div>
                    <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => navigate('/projects')}
                        className="rounded-xl px-6 py-4"
                    >
                        Close Phase
                    </Button>
                </div>
            )}

            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 border-b border-border-subtle pb-12 pt-6 relative group">
                <div className="flex items-start gap-8">
                    <div className="relative">
                        <div className="absolute -inset-2 bg-accent-primary rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition duration-700" />
                        <div className="relative p-6 bg-console-surface rounded-[2rem] border border-border-strong shadow-strong transition-all duration-700 group-hover:rotate-3 group-hover:scale-110">
                            <Cpu size={40} className="text-accent-primary" />
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[12px] font-black uppercase tracking-[0.3em] text-text-muted">
                                {id === 'new' ? 'New Workspace' : `Project Analyser v1.0`}
                            </span>
                            <Badge className="bg-accent-soft text-accent-primary border-accent-primary/20 px-4 py-1.5 text-[11px] font-black tracking-wider uppercase">
                                {study?.moduleStudied || 'New Module'}
                            </Badge>
                            {study?.flowUnderstood && (
                                <Badge className="bg-status-ok/10 text-status-ok border-status-ok/20 flex items-center gap-1.5">
                                    <CheckCircle2 size={12} />
                                    UNDERSTOOD
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-black text-text-primary tracking-tighter leading-[1.1]">
                            {study?.projectName || 'Project Workspace'}
                        </h1>
                        
                        {/* Progress Visualization */}
                        {study && (
                            <div className="flex items-center gap-4 mt-2">
                                <div className="flex-1 h-2 bg-console-surface-3 border border-border-subtle rounded-full overflow-hidden max-w-[280px] shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${study.tasks && study.tasks.length > 0
                                                ? Math.round((study.tasks.filter(t => t.status === 'done').length / study.tasks.length) * 100)
                                                : 0}%`
                                        }}
                                        className="h-full bg-gradient-to-r from-accent-primary to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                    />
                                </div>
                                <span className="text-[11px] font-black text-accent-primary uppercase tracking-[0.1em]">
                                    {study.tasks && study.tasks.length > 0
                                        ? `${Math.round((study.tasks.filter(t => t.status === 'done').length / study.tasks.length) * 100)}% Logic Captured`
                                        : 'Awaiting Input'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 self-end lg:self-auto">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/projects')}
                        leftIcon={<ArrowLeft size={18} />}
                        className="text-text-muted hover:text-text-primary font-bold tracking-tight hover:bg-white/5 py-6 px-8 rounded-2xl border border-transparent hover:border-border-subtle"
                    >
                        Exit Grid
                    </Button>
                </div>
            </header>

            {/* Immersive Workspace Content */}
            <div className="relative group/canvas">
                <div className="absolute -inset-10 bg-radial-gradient from-accent-primary/5 to-transparent rounded-[5rem] blur-[100px] opacity-20 pointer-events-none group-hover/canvas:opacity-40 transition-opacity duration-1000" />
                
                <div className="relative bg-console-surface/30 backdrop-blur-3xl border border-border-subtle rounded-[3rem] p-8 lg:p-14 shadow-elevation-2">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <Save size={160} />
                    </div>
                    
                    <ProjectStudyForm
                        initialValues={study || undefined}
                        onSuccess={(newStudy) => {
                            if (id === 'new' && newStudy?._id) {
                                toast.success('Project workspace initialized.');
                                navigate(`/projects/${newStudy._id}`);
                            } else {
                                toast.success('Workspace parameters synced.');
                            }
                        }}
                        onChange={(data: any) => handleChange(data)}
                    />
                </div>
            </div>
            
            <footer className="pt-20 text-center opacity-20 select-none">
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-text-muted">
                    Learning OS // Project CRYSTAL // Advanced Workspace v3
                </p>
            </footer>
        </motion.div>
    );
}
