import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Checkbox } from '../ui/Checkbox';
import { 
    Plus, 
    Trash2, 
    CheckCircle2, 
    Circle, 
    LayoutGrid, 
    ChevronDown, 
    ChevronUp, 
    Star, 
    Cpu, 
    Zap, 
    Workflow,
    Activity,
    Compass,
    Save,
    AlertCircle,
    BrainCircuit,
    Terminal,
    Layers,
    Github,
    History
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { useDataStore } from '../../stores/dataStore';
import { toast } from '../../stores/toastStore';
import type { ProjectStudy } from '../../services/types';

interface Task {
    id: string;
    text: string;
    status: 'todo' | 'in-progress' | 'done';
}

interface ProjectStudyFormProps {
    initialValues?: {
        _id?: string;
        projectName: string;
        repoUrl?: string;
        moduleStudied: string;
        flowUnderstood?: boolean;
        flowUnderstanding: string;
        coreComponents?: string;
        questions?: string;
        notes?: string;
        tasks?: Task[];
        keyTakeaways?: string[];
        confidenceLevel?: number;
        simpleExplanation?: string;
    };
    onSuccess?: (study?: any) => void;
    onCancel?: () => void;
    onChange?: (data: Partial<ProjectStudy>) => void;
}

const MODULES = [
    { value: 'auth-service', label: 'Auth Service' },
    { value: 'api-gateway', label: 'API Gateway' },
    { value: 'media-engine', label: 'Media Engine' },
    { value: 'frontend-core', label: 'Frontend Core' },
    { value: 'messaging', label: 'Messaging / Socket' },
    { value: 'infra', label: 'Infrastructure / DevOps' },
    { value: 'other', label: 'Other Module' },
];

export function ProjectStudyForm({ initialValues, onSuccess, onCancel, onChange }: ProjectStudyFormProps) {
    const [values, setValues] = useState({
        projectName: initialValues?.projectName || '',
        repoUrl: initialValues?.repoUrl || '',
        moduleStudied: initialValues?.moduleStudied || 'auth-service',
        flowUnderstanding: initialValues?.flowUnderstanding || '',
        coreComponents: initialValues?.coreComponents || '',
        questions: initialValues?.questions || '',
        notes: initialValues?.notes || '',
        keyTakeaways: initialValues?.keyTakeaways || [],
        confidenceLevel: initialValues?.confidenceLevel || 3,
        simpleExplanation: initialValues?.simpleExplanation || '',
        flowUnderstood: initialValues?.flowUnderstood || false,
    });

    const [tasks, setTasks] = useState<Task[]>(initialValues?.tasks || []);
    const [newTask, setNewTask] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(true);
    const { fetchStreak, fetchDashboard } = useDataStore();

    useEffect(() => {
        if (initialValues) {
            setValues({
                projectName: initialValues.projectName || '',
                repoUrl: initialValues.repoUrl || '',
                moduleStudied: initialValues.moduleStudied || 'auth-service',
                flowUnderstanding: initialValues.flowUnderstanding || '',
                coreComponents: initialValues.coreComponents || '',
                questions: initialValues.questions || '',
                notes: initialValues.notes || '',
                keyTakeaways: initialValues.keyTakeaways || [],
                confidenceLevel: initialValues.confidenceLevel || 3,
                simpleExplanation: initialValues.simpleExplanation || '',
                flowUnderstood: initialValues.flowUnderstood || false,
            });
            setTasks(initialValues.tasks || []);
        }
    }, [initialValues]);

    const handleFieldChange = (field: string, value: any) => {
        const newValues = { ...values, [field]: value };
        setValues(newValues);
        onChange?.({ ...newValues, tasks } as any);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!values.projectName.trim()) {
            setError('Project domain required for execution.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...values,
                tasks
            };

            if (initialValues?._id) {
                await api.updateProjectStudy(initialValues._id, payload as any);
                toast.success('Workspace synchronized.');
                onSuccess?.();
            } else {
                const result = await api.createProjectStudy({
                    ...payload,
                    date: new Date().toISOString().split('T')[0],
                } as any);
                toast.success('New workspace established.');
                onSuccess?.(result.study);
            }
            
            fetchStreak();
            fetchDashboard();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sync failure');
        } finally {
            setIsSaving(false);
        }
    };

    const addTask = () => {
        if (!newTask.trim()) return;
        const updatedTasks: Task[] = [...tasks, { id: crypto.randomUUID(), text: newTask, status: 'todo' }];
        setTasks(updatedTasks);
        setNewTask('');
        onChange?.({ ...values, tasks: updatedTasks } as any);
    };

    const toggleTask = (id: string) => {
        const updatedTasks: Task[] = tasks.map(t => {
            if (t.id === id) {
                const nextStatus: Task['status'] = t.status === 'done' ? 'todo' : t.status === 'todo' ? 'in-progress' : 'done';
                return { ...t, status: nextStatus };
            }
            return t;
        });
        setTasks(updatedTasks);
        onChange?.({ ...values, tasks: updatedTasks } as any);
    };

    const removeTask = (id: string) => {
        const updatedTasks = tasks.filter(t => t.id !== id);
        setTasks(updatedTasks);
        onChange?.({ ...values, tasks: updatedTasks } as any);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-12">
            {error && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-5 text-status-error bg-status-error/10 border border-status-error/20 rounded-2xl flex items-center gap-4"
                >
                    <AlertCircle size={20} />
                    <span className="font-bold tracking-tight">{error}</span>
                </motion.div>
            )}

            {/* Core Identity */}
            <div className="space-y-8">
                <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                    <Layers size={20} className="text-accent-primary" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Domain Sector</h3>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <Input
                        label="Project Cluster"
                        placeholder="e.g., Global Auth Microservice"
                        value={values.projectName}
                        onChange={(e) => handleFieldChange('projectName', e.target.value)}
                        required
                        className="text-xl font-black py-8 bg-console-bg/50 border-border-subtle/50 shadow-inner"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Select
                            label="Target Module"
                            value={values.moduleStudied}
                            onChange={(v) => handleFieldChange('moduleStudied', v)}
                            options={MODULES}
                            className="bg-console-bg/50 border-border-subtle/50 h-14"
                        />
                        <div className="space-y-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Repository Link</label>
                             <div className="relative">
                                <Github size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                <Input
                                    placeholder="github.com/repo"
                                    value={values.repoUrl}
                                    onChange={(e) => handleFieldChange('repoUrl', e.target.value)}
                                    className="pl-12 bg-console-bg/50 border-border-subtle/50 h-14 font-mono text-xs"
                                />
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metacognition Cluster */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-primary/20 to-blue-500/20 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000" />
                <div className="relative bg-console-surface/80 backdrop-blur-xl border border-border-subtle/30 p-8 lg:p-10 rounded-[2.5rem] space-y-10 shadow-elevation-2">
                    <div className="flex items-center justify-between border-b border-border-subtle/30 pb-6">
                        <div className="flex items-center gap-3">
                            <BrainCircuit size={24} className="text-accent-primary animate-pulse" />
                            <h3 className="text-lg font-black text-text-primary italic tracking-tight">Metacognitive Audit</h3>
                        </div>
                        <Checkbox
                            label="Logic Deciphered"
                            checked={values.flowUnderstood}
                            onCheckedChange={(checked) => handleFieldChange('flowUnderstood', checked)}
                            className="bg-console-bg/50 border-border-subtle/50"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Confidence Matrix</label>
                            <div className="flex items-center gap-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleFieldChange('confidenceLevel', star)}
                                        className={cn(
                                            "w-14 h-14 rounded-2xl transition-all duration-500 flex items-center justify-center border",
                                            values.confidenceLevel >= star 
                                                ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-110 z-10' 
                                                : 'bg-console-bg/50 border-border-subtle/30 text-text-muted hover:border-border-subtle/50'
                                        )}
                                    >
                                        <Star 
                                            size={26} 
                                            fill={values.confidenceLevel >= star ? "currentColor" : "none"} 
                                            className={values.confidenceLevel >= star ? "animate-pulse" : ""}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">
                                <Compass size={14} className="text-accent-primary" /> Feynman Abstraction
                            </label>
                            <Textarea
                                placeholder="Explain the system flow in 2 sentences..."
                                value={values.simpleExplanation}
                                onChange={(e) => handleFieldChange('simpleExplanation', e.target.value)}
                                rows={3}
                                className="bg-console-bg/50 border-border-subtle/30 focus:border-accent-primary/30 text-sm italic font-medium leading-relaxed rounded-2xl p-6"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Architecture & Stack */}
            <div className="space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                            <Workflow size={20} className="text-blue-400" />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Execution Flow</h3>
                        </div>
                        <Textarea
                            placeholder="Map out the interaction patterns identified..."
                            value={values.flowUnderstanding}
                            onChange={(e) => handleFieldChange('flowUnderstanding', e.target.value)}
                            rows={12}
                            className="bg-console-surface border-border-strong rounded-[2rem] p-8 text-base leading-relaxed font-mono shadow-inner"
                        />
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                            <Activity size={20} className="text-green-400" />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Active Objectives</h3>
                        </div>
                        
                        <div className="bg-console-surface/50 border border-border-subtle rounded-[2.5rem] p-6 space-y-6 min-h-[300px]">
                            <div className="relative">
                                <Plus size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                <Input
                                    placeholder="Add objective to stack..."
                                    value={newTask}
                                    onChange={(e) => setNewTask(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
                                    className="pl-12 bg-console-bg h-14 rounded-xl border-border-strong"
                                />
                            </div>

                            <div className="space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {tasks.map(task => (
                                        <motion.div
                                            key={task.id}
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border transition-all group",
                                                task.status === 'done' ? "bg-console-bg/30 border-status-ok/20" : "bg-console-bg border-border-strong"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleTask(task.id)}
                                                className={cn(
                                                    "w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center",
                                                    task.status === 'done' ? "bg-status-ok border-status-ok text-white" : 
                                                    task.status === 'in-progress' ? "bg-accent-primary/10 border-accent-primary text-accent-primary animate-pulse" :
                                                    "border-border-strong text-transparent hover:border-accent-primary"
                                                )}
                                            >
                                                {task.status === 'done' ? <CheckCircle2 size={12} /> : 
                                                 task.status === 'in-progress' ? <Zap size={12} fill="currentColor" /> : 
                                                 <Circle size={12} />}
                                            </button>
                                            <span className={cn(
                                                "flex-1 text-sm font-bold truncate transition-all",
                                                task.status === 'done' ? "text-text-muted line-through" : "text-text-primary"
                                            )}>
                                                {task.text}
                                            </span>
                                            <button type="button" onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-text-disabled hover:text-status-error transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Observation Logs */}
            <div className="space-y-8">
                <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                    <Terminal size={20} className="text-text-secondary" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Observation Terminal</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-4">
                         <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                             <Activity size={12} className="text-status-warning" /> Structural Debt / Questions
                         </label>
                         <Textarea
                            placeholder="Blockers identified..."
                            value={values.questions}
                            onChange={(e) => handleFieldChange('questions', e.target.value)}
                            rows={4}
                            className="bg-console-surface border-border-strong rounded-2xl p-6"
                         />
                    </div>
                    <div className="space-y-4">
                         <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                             <History size={12} className="text-blue-400" /> Deep Insights
                         </label>
                         <Textarea
                            placeholder="Architectural patterns noticed..."
                            value={values.notes}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            rows={4}
                            className="bg-console-surface border-border-strong rounded-2xl p-6"
                         />
                    </div>
                </div>
            </div>

            {/* Global Actions */}
            {!onCancel ? (
                 <div className="pt-8 border-t border-border-subtle">
                     <Button 
                         variant="primary"
                         onClick={handleSubmit}
                         isLoading={isSaving}
                         className="w-full h-16 rounded-2xl bg-gradient-to-r from-accent-primary to-blue-500 text-white shadow-xl shadow-accent-primary/20 font-black text-lg tracking-tight hover:scale-[1.01] transition-transform"
                     >
                         Push Workspace Updates
                     </Button>
                 </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-6 pt-12 border-t border-border-subtle">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={onCancel} 
                        className="flex-1 h-16 rounded-2xl border border-border-subtle text-text-muted hover:text-text-primary hover:bg-white/5 font-bold"
                    >
                        Abandon Session
                    </Button>
                    <Button 
                        type="submit" 
                        isLoading={isSaving} 
                        className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-accent-primary to-blue-500 text-white shadow-xl shadow-accent-primary/20 font-black text-lg tracking-tight hover:scale-[1.02] transition-transform"
                    >
                        {initialValues?._id ? 'Synchronize Workspace' : 'Initialize Module Area'}
                    </Button>
                </div>
            )}
        </form>
    );
}
