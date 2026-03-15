import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Download,
    AlertCircle,
    LayoutGrid,
    BrainCircuit,
    Cpu,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ProjectStudyForm } from '../components/forms/ProjectStudyForm';
import { SeniorityPulseTerminal } from '../components/learning/SeniorityPulseTerminal';
import { useAutoSave } from '../hooks/useAutoSave';
import { projectsApi } from '../services/projects.api';
import { api } from '../services/api';
import type { ProjectStudy } from '../services/types';
import { toast } from '../stores/toastStore';
import { cn } from '../lib/utils';
import { useAI } from '../contexts/AIContext';

export function ProjectStudyDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [study, setStudy] = useState<ProjectStudy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [pulseData, setPulseData] = useState<any>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
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


    const handlePulseAudit = async () => {
        if (!id) return;
        setIsAnalyzing(true);
        try {
            const response = await api.pulseProjectAudit(id);
            setPulseData(response.data);
            toast.success('Seniority Pulse analysis complete!');
        } catch (err) {
            console.error('Pulse audit failed:', err);
            toast.error('Failed to perform pulse audit');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleValidate = async () => {
        if (!id) return;
        setIsValidating(true);
        try {
            const response = await api.validateProjectFlow(id);
            setValidationResult(response);
            toast.success('Logic flow validated!');
        } catch (err) {
            console.error('Validation failed:', err);
            toast.error('Failed to validate logic flow');
        } finally {
            setIsValidating(false);
        }
    };


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

                        {/* Elite Seniority Pulse Diagnostic */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                                        <BrainCircuit size={18} className="text-accent-primary" /> Engineering Pulse Audit
                                    </h3>
                                    <p className="text-[10px] font-bold text-text-disabled uppercase mt-1">Scale-Proof Logic Analysis Terminal</p>
                                </div>
                            </div>

                            <SeniorityPulseTerminal
                                data={pulseData}
                                isAnalyzing={isAnalyzing}
                                onRunAudit={handlePulseAudit}
                            />
                        </div>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-console-surface border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-premium">
                        <h3 className="text-sm font-black uppercase tracking-widest text-text-disabled mb-6 flex items-center gap-2">
                            <Cpu size={16} className="text-accent-primary" /> Core Specification
                        </h3>
                        {study && (
                            <ProjectStudyForm
                                initialValues={study}
                                onSuccess={() => toast.success('Changes saved')}
                                onChange={(data: any) => handleChange(data)}
                            />
                        )}
                    </div>

                </div>

                {/* Right Column: Logic Validation */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-console-elevated border border-accent-primary/20 rounded-2xl p-6 shadow-strong relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <BrainCircuit size={100} className="text-accent-primary" />
                        </div>
                        
                        <h3 className="text-xs font-black uppercase tracking-widest text-accent-primary mb-4">AI Logic Validator</h3>
                        
                        <p className="text-[11px] text-text-secondary leading-relaxed mb-6">
                            Critical check of your flow understanding against the physical architectural constraints. 
                        </p>

                        <Button 
                            onClick={handleValidate}
                            isLoading={isValidating}
                            variant="primary" 
                            className="w-full shadow-premium py-6"
                        >
                            Validate Logic Flow
                        </Button>

                        {validationResult && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-text-disabled">Consistency Score</span>
                                    <span className={cn(
                                        "text-xl font-black",
                                        validationResult.score >= 80 ? "text-status-ok" :
                                        validationResult.score >= 50 ? "text-status-warning" : "text-status-error"
                                    )}>{validationResult.score}%</span>
                                </div>
                                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-1000",
                                            validationResult.score >= 80 ? "bg-status-ok" :
                                            validationResult.score >= 50 ? "bg-status-warning" : "bg-status-error"
                                        )}
                                        style={{ width: `${validationResult.score}%` }}
                                    />
                                </div>
                                
                                <div className="p-3 bg-black/10 rounded-lg border border-border-subtle">
                                    <p className="text-[11px] font-medium text-text-secondary leading-relaxed italic">
                                        "{validationResult.feedback}"
                                    </p>
                                </div>

                                {validationResult.gaps?.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-status-warning">Identified Gaps</p>
                                        {validationResult.gaps.map((gap: string, i: number) => (
                                            <div key={i} className="flex gap-2 text-[11px] text-text-primary/80">
                                                <span className="text-status-warning">•</span>
                                                <span>{gap}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}
