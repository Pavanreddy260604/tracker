import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';
import { useDataStore } from '../../stores/dataStore';
import { 
    Plus, 
    Trash2, 
    CheckCircle2, 
    Circle, 
    BookOpen, 
    PlayCircle, 
    FileText, 
    Clock, 
    Zap, 
    LayoutGrid, 
    ChevronDown, 
    ChevronUp, 
    Star, 
    HelpCircle,
    Binary,
    Activity,
    Compass,
    AlertCircle,
    BrainCircuit,
    Terminal
} from 'lucide-react';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

interface SubTopic {
    id: string;
    text: string;
    isCompleted: boolean;
}

interface Resource {
    title: string;
    url: string;
    type: 'video' | 'article' | 'docs' | 'course';
}

interface BackendTopicFormProps {
    initialValues?: {
        _id?: string;
        topicName: string;
        category: string;
        type: string;
        status: string;
        difficulty?: string;
        timeSpent?: string;
        filesModified?: string;
        bugsFaced?: string;
        notes?: string;
        subTopics?: SubTopic[];
        resources?: Resource[];
        confidenceLevel?: number;
        simpleExplanation?: string;
    };
    onSuccess?: (topic?: any) => void;
    onCancel?: () => void;
}

const CATEGORIES = [
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
    { value: 'other', label: 'Other' },
];

const DIFFICULTIES = [
    { value: '', label: 'Select Difficulty' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
];

const TYPES = [
    { value: 'theory', label: 'Theory / Concept' },
    { value: 'feature', label: 'Feature Build' },
    { value: 'bug-fix', label: 'Bug Fix' },
    { value: 'refactor', label: 'Refactoring' },
    { value: 'optimization', label: 'Optimization' },
];

const STATUSES = [
    { value: 'completed', label: 'Completed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'planned', label: 'Planned' },
];

const RESOURCE_TYPES = [
    { value: 'docs', label: 'Documentation' },
    { value: 'article', label: 'Article / Guide' },
    { value: 'video', label: 'Video / Youtube' },
    { value: 'course', label: 'Course' }
];

export function BackendTopicForm({ initialValues, onSuccess, onCancel }: BackendTopicFormProps) {
    const [values, setValues] = useState({
        topicName: initialValues?.topicName || '',
        category: initialValues?.category || 'node',
        type: initialValues?.type || 'theory',
        status: initialValues?.status || 'completed',
        difficulty: initialValues?.difficulty || '',
        timeSpent: initialValues?.timeSpent || '',
        filesModified: initialValues?.filesModified || '',
        bugsFaced: initialValues?.bugsFaced || '',
        notes: initialValues?.notes || '',
        confidenceLevel: initialValues?.confidenceLevel || 3,
        simpleExplanation: initialValues?.simpleExplanation || '',
    });

    const [subTopics, setSubTopics] = useState<SubTopic[]>(initialValues?.subTopics || []);
    const [newSubTopic, setNewSubTopic] = useState('');
    const [resources, setResources] = useState<Resource[]>(initialValues?.resources || []);
    const { fetchStreak, fetchDashboard } = useDataStore();
    const [newResource, setNewResource] = useState({ title: '', url: '', type: 'docs' as const });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(!!initialValues?._id);

    useEffect(() => {
        if (initialValues) {
            setValues({
                topicName: initialValues.topicName || '',
                category: initialValues.category || 'node',
                type: initialValues.type || 'theory',
                status: initialValues.status || 'completed',
                difficulty: initialValues.difficulty || '',
                timeSpent: initialValues.timeSpent || '',
                filesModified: initialValues.filesModified || '',
                bugsFaced: initialValues.bugsFaced || '',
                notes: initialValues.notes || '',
                confidenceLevel: initialValues.confidenceLevel || 3,
                simpleExplanation: initialValues.simpleExplanation || '',
            });
            setSubTopics(initialValues.subTopics || []);
            setResources(initialValues.resources || []);
        }
    }, [initialValues]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!values.topicName.trim()) {
            setError('System title required for execution.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...values,
                difficulty: (values.difficulty || undefined) as 'beginner' | 'intermediate' | 'advanced' | undefined,
                subTopics,
                resources
            };

            if (initialValues?._id) {
                await api.updateBackendTopic(initialValues._id, payload);
                toast.success('System record synchronized.');
                onSuccess?.();
            } else {
                const result = await api.createBackendTopic({
                    ...payload,
                    date: new Date().toISOString().split('T')[0],
                });
                toast.success('New technical node established.');
                onSuccess?.(result.topic);
            }
            
            fetchStreak();
            fetchDashboard();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Synchronization failure');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    const addSubTopic = () => {
        if (!newSubTopic.trim()) return;
        setSubTopics([...subTopics, { id: crypto.randomUUID(), text: newSubTopic, isCompleted: false }]);
        setNewSubTopic('');
    };

    const addResource = () => {
        if (!newResource.title.trim() || !newResource.url.trim()) return;
        let url = newResource.url;
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        setResources([...resources, { ...newResource, url }]);
        setNewResource({ title: '', url: '', type: 'docs' });
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

            {/* Core Specs */}
            <div className="space-y-8">
                <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                    <Binary size={20} className="text-blue-400" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Core Specification</h3>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <Input
                        name="topicName"
                        label="Infrastructure Domain"
                        placeholder="e.g., Load Balanced Microservices"
                        value={values.topicName}
                        onChange={(e) => handleChange('topicName', e.target.value)}
                        required
                        className="text-xl font-black py-8 bg-console-bg/50 border-border-subtle/50 focus:border-blue-400/50 transition-all shadow-inner"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Select
                            label="Domain Sector"
                            value={values.category}
                            onChange={(v) => handleChange('category', v)}
                            options={CATEGORIES}
                            className="bg-console-bg/50 border-border-subtle/50 h-14"
                        />
                        <Select
                            label="Operational Status"
                            value={values.status}
                            onChange={(v) => handleChange('status', v)}
                            options={STATUSES}
                            className="bg-console-bg/50 border-border-subtle/50 h-14"
                        />
                    </div>
                </div>
            </div>

            {/* Metacognition: The "Director" View */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000" />
                <div className="relative bg-console-surface/80 backdrop-blur-xl border border-border-subtle/30 p-8 lg:p-10 rounded-[2.5rem] space-y-10 shadow-elevation-2">
                    <div className="flex items-center gap-3 border-b border-border-subtle/30 pb-6">
                        <BrainCircuit size={24} className="text-blue-400 animate-pulse" />
                        <h3 className="text-lg font-black text-text-primary italic tracking-tight">Metacognitive Audit</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Confidence Matrix</label>
                            <div className="flex items-center gap-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setValues(v => ({ ...v, confidenceLevel: star }))}
                                        className={cn(
                                            "w-14 h-14 rounded-2xl transition-all duration-500 flex items-center justify-center border",
                                            values.confidenceLevel >= star 
                                                ? 'bg-blue-500/20 border-blue-400/40 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-110 z-10' 
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
                                <span className="ml-4 text-xs font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                                    {['Low', 'Unstable', 'Locked', 'Optimized', 'Mastered'][values.confidenceLevel - 1]}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">
                                <Compass size={14} className="text-blue-400" /> Feynman Verification
                            </label>
                            <Textarea
                                placeholder="Condense the system architecture into a 5-year-old's mental model..."
                                value={values.simpleExplanation}
                                onChange={(e) => setValues(v => ({ ...v, simpleExplanation: e.target.value }))}
                                rows={4}
                                className="bg-console-bg/50 border-white/5 focus:border-blue-400/30 text-sm italic font-medium leading-relaxed rounded-2xl p-6"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-start">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="group flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] hover:text-blue-400 transition-colors"
                >
                    <div className="p-1.5 rounded-lg bg-console-surface shadow-sm group-hover:bg-blue-500/10 transition-colors">
                        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                    {showAdvanced ? 'Collapse Parameters' : 'Expand Infrastructure Details'}
                </button>
            </div>

            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -20 }}
                        className="space-y-12"
                    >
                        {/* Type & Time */}
                        <div className="p-10 bg-console-surface/50 rounded-[2.5rem] border border-border-subtle grid grid-cols-1 md:grid-cols-3 gap-10">
                            <Select
                                label="Instruction Type"
                                value={values.type}
                                onChange={(v) => handleChange('type', v)}
                                options={TYPES}
                                className="bg-console-bg border-border-strong h-14"
                            />
                            <Select
                                label="Inherent Difficulty"
                                value={values.difficulty}
                                onChange={(v) => handleChange('difficulty', v)}
                                options={DIFFICULTIES}
                                className="bg-console-bg border-border-strong h-14"
                            />
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Computation Time</label>
                                <div className="relative">
                                    <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <Input
                                        placeholder="e.g., 4.5h"
                                        value={values.timeSpent}
                                        onChange={(e) => handleChange('timeSpent', e.target.value)}
                                        className="pl-12 h-14 bg-console-bg border-border-strong"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <Activity size={20} className="text-green-400" />
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Execution Checklist</h3>
                            </div>
                            
                            <div className="bg-console-surface/50 border border-border-subtle p-8 rounded-[2.5rem] space-y-8">
                                <div className="flex gap-4">
                                    <Input
                                        placeholder="Push task to stack..."
                                        value={newSubTopic}
                                        onChange={(e) => setNewSubTopic(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubTopic())}
                                        className="flex-1 h-14 bg-console-bg border-border-strong"
                                    />
                                    <Button type="button" onClick={addSubTopic} className="px-8 h-14 rounded-xl bg-console-surface-3 hover:bg-console-surface-active">
                                        <Plus size={20} />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {subTopics.map(topic => (
                                        <motion.div
                                            key={topic.id}
                                            layout
                                            className="flex items-center gap-4 p-5 bg-console-bg/50 border border-border-subtle rounded-2xl group transition-all hover:border-blue-400/20"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSubTopics(subTopics.map(t => t.id === topic.id ? { ...t, isCompleted: !t.isCompleted } : t))}
                                                className={cn(
                                                    "w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center",
                                                    topic.isCompleted ? "bg-green-500 border-green-500 text-white" : "border-border-strong text-transparent hover:border-blue-400"
                                                )}
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                            <span className={cn("flex-1 font-medium transition-all", topic.isCompleted ? "text-text-muted line-through" : "text-text-primary")}>
                                                {topic.text}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setSubTopics(subTopics.filter(t => t.id !== topic.id))}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-text-disabled hover:text-status-error transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Resources */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <Compass size={20} className="text-blue-400" />
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Technical Assets</h3>
                            </div>
                            
                            <div className="bg-console-surface/50 border border-border-subtle p-8 lg:p-10 rounded-[2.5rem] space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <Input
                                        label="Asset Label"
                                        placeholder="e.g., Redis Pattern Docs"
                                        value={newResource.title}
                                        onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                        className="bg-console-bg border-border-strong"
                                    />
                                    <Input
                                        label="Access URI"
                                        placeholder="https://..."
                                        value={newResource.url}
                                        onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                                        className="font-mono text-xs bg-console-bg border-border-strong"
                                    />
                                    <Select
                                        label="Asset Type"
                                        value={newResource.type}
                                        onChange={(v: any) => setNewResource({ ...newResource, type: v })}
                                        options={RESOURCE_TYPES}
                                        className="bg-console-bg border-border-strong h-14"
                                    />
                                    <div className="flex items-end">
                                        <Button type="button" onClick={addResource} className="w-full h-14 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 font-bold">
                                            Inject Asset
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {resources.map((res, idx) => (
                                        <div key={idx} className="flex items-center gap-5 p-5 bg-console-bg/50 border border-border-subtle rounded-2xl hover:border-blue-400/20 transition-all group">
                                            <div className="p-3 rounded-xl bg-console-surface-3 text-blue-400">
                                                {res.type === 'video' ? <PlayCircle size={24} /> : <FileText size={24} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-text-primary truncate">{res.title}</p>
                                                <p className="text-[10px] font-mono text-text-muted truncate uppercase tracking-widest">{res.url.replace(/^https?:\/\//, '')}</p>
                                            </div>
                                            <button type="button" onClick={() => setResources(resources.filter((_, i) => i !== idx))} className="opacity-0 group-hover:opacity-100 p-2 text-text-disabled hover:text-status-error transition-all">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Advanced Logs */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <Terminal size={20} className="text-text-secondary" />
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted">Technical Logs</h3>
                            </div>
                            <div className="space-y-8">
                                <Input
                                    label="Affected Modules"
                                    placeholder="e.g., auth.middleware.ts, types.ts"
                                    value={values.filesModified}
                                    onChange={(e) => handleChange('filesModified', e.target.value)}
                                    className="bg-console-surface border-border-strong h-14"
                                />
                                <Textarea
                                    label="Bugs & Structural Debt"
                                    placeholder="Roadblocks identified and neutralised..."
                                    value={values.bugsFaced}
                                    onChange={(e) => handleChange('bugsFaced', e.target.value)}
                                    rows={4}
                                    className="bg-console-surface border-border-strong rounded-2xl p-6"
                                />
                                <Textarea
                                    label="Architectural Notes"
                                    placeholder="Key decisions and logic flows..."
                                    value={values.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    rows={8}
                                    className="bg-console-surface border-border-strong rounded-2xl p-6"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Actions */}
            <div className="flex flex-col sm:flex-row gap-6 pt-12 border-t border-border-subtle">
                {onCancel && (
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={onCancel} 
                        className="flex-1 h-16 rounded-2xl border border-border-subtle text-text-muted hover:text-text-primary hover:bg-white/5 font-bold"
                    >
                        Discard Changes
                    </Button>
                )}
                <Button 
                    type="submit" 
                    isLoading={isSaving} 
                    className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/20 font-black text-lg tracking-tight hover:scale-[1.02] transition-transform"
                >
                    {initialValues?._id ? 'Synchronize Repository' : 'Seal Infrastructure Record'}
                </Button>
            </div>
        </form>
    );
}
