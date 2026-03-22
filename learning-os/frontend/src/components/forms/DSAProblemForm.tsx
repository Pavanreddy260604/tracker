import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';
import { useDataStore } from '../../stores/dataStore';
import { toast } from '../../stores/toastStore';
import { DSA_TOPIC_OPTIONS, normalizeDsaTopic } from '../../lib/constants';
import { 
    ChevronDown, ChevronUp, LayoutGrid, Zap, BrainCircuit, Code2, AlertTriangle, 
    Link as LinkIcon, Clock, Trophy, Star, HelpCircle, Terminal, Activity,
    Target, Compass, Binary, Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DSAProblemFormProps {
    initialValues?: {
        _id?: string;
        problemName: string;
        platform: string;
        topic: string;
        difficulty: string;
        timeSpent: number;
        status: string;
        patternLearned?: string;
        mistakes?: string;
        solutionLink?: string;
        notes?: string;
        solutionCode?: string;
        timeComplexity?: string;
        spaceComplexity?: string;
        companyTags?: string[];
        nextReviewDate?: string;
        confidenceLevel?: number;
        simpleExplanation?: string;
    };
    onSuccess?: (problem?: any) => void;
    onCancel?: () => void;
}

const PLATFORMS = [
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'gfg', label: 'GeeksforGeeks' },
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'hackerrank', label: 'HackerRank' },
    { value: 'codechef', label: 'CodeChef' },
    { value: 'neetcode', label: 'NeetCode' },
    { value: 'other', label: 'Other' },
];

const DIFFICULTIES = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
];

const STATUSES = [
    { value: 'solved', label: 'Solved' },
    { value: 'revisit', label: 'Need to Revisit' },
    { value: 'attempted', label: 'Attempted' },
];

export function DSAProblemForm({ initialValues, onSuccess, onCancel }: DSAProblemFormProps) {
    const [values, setValues] = useState({
        problemName: initialValues?.problemName || '',
        platform: initialValues?.platform || 'leetcode',
        topic: normalizeDsaTopic(initialValues?.topic) || '',
        difficulty: initialValues?.difficulty || 'medium',
        timeSpent: initialValues?.timeSpent || 30,
        status: initialValues?.status || 'solved',
        patternLearned: initialValues?.patternLearned || '',
        mistakes: initialValues?.mistakes || '',
        solutionLink: initialValues?.solutionLink || '',
        notes: initialValues?.notes || '',
        solutionCode: initialValues?.solutionCode || '',
        timeComplexity: initialValues?.timeComplexity || '',
        spaceComplexity: initialValues?.spaceComplexity || '',
        companyTags: initialValues?.companyTags?.join(', ') || '',
        confidenceLevel: initialValues?.confidenceLevel || 3,
        simpleExplanation: initialValues?.simpleExplanation || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(!!initialValues?._id);
    const { fetchStreak, fetchDashboard } = useDataStore();

    useEffect(() => {
        if (initialValues) {
            setValues({
                problemName: initialValues.problemName || '',
                platform: initialValues.platform || 'leetcode',
                topic: normalizeDsaTopic(initialValues.topic) || '',
                difficulty: initialValues.difficulty || 'medium',
                timeSpent: initialValues.timeSpent || 30,
                status: initialValues.status || 'solved',
                patternLearned: initialValues.patternLearned || '',
                mistakes: initialValues.mistakes || '',
                solutionLink: initialValues.solutionLink || '',
                notes: initialValues.notes || '',
                solutionCode: initialValues.solutionCode || '',
                timeComplexity: initialValues.timeComplexity || '',
                spaceComplexity: initialValues.spaceComplexity || '',
                companyTags: initialValues.companyTags?.join(', ') || '',
                confidenceLevel: initialValues.confidenceLevel || 3,
                simpleExplanation: initialValues.simpleExplanation || '',
            });
        }
    }, [initialValues]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!values.problemName.trim()) { setError('Problem name is required'); return; }
        if (!values.topic) { setError('Topic is required'); return; }

        setIsSaving(true);
        try {
            const commonPayload = {
                topic: normalizeDsaTopic(values.topic),
                difficulty: values.difficulty as 'easy' | 'medium' | 'hard',
                status: values.status as 'solved' | 'revisit' | 'attempted',
                companyTags: values.companyTags.split(',').map(tag => tag.trim()).filter(t => t),
            };

            if (initialValues?._id) {
                await api.updateDSAProblem(initialValues._id, { 
                    ...values, 
                    ...commonPayload,
                    platform: values.platform as any // Casting to stay compatible with API type
                });
                toast.success('Algorithmic record updated.');
                onSuccess?.();
            } else {
                const nextReview = new Date();
                nextReview.setDate(nextReview.getDate() + 1);
                const result = await api.createDSAProblem({
                    ...values,
                    ...commonPayload,
                    platform: values.platform as any,
                    nextReviewDate: nextReview.toISOString().split('T')[0],
                    reviewStage: 1,
                    date: new Date().toISOString().split('T')[0],
                });
                toast.success('Problem solved! Streak synchronized.');
                onSuccess?.(result.problem);
            }
            fetchStreak();
            fetchDashboard();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {error && (
                <div className="p-5 rounded-2xl bg-status-error/10 border border-status-error/20 flex items-center gap-4 animate-shake">
                    <div className="p-2 bg-status-error/20 rounded-lg text-status-error">
                        <AlertTriangle size={20} />
                    </div>
                    <p className="text-sm font-bold text-status-error">{error}</p>
                </div>
            )}

            {/* Immersive Header */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-console-surface/40 border border-border-subtle/30 p-8 lg:p-10">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">
                            <Target size={14} className="animate-pulse" />
                            Problem Initialization
                        </div>
                        <h2 className="text-3xl font-black text-text-primary tracking-tight">
                            {initialValues?._id ? 'Edit' : 'Track'} <span className="text-emerald-400">Problem</span>
                        </h2>
                    </div>
                </div>
            </div>

            {/* Core Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-console-surface/30 backdrop-blur-xl border border-border-subtle/30 p-8 rounded-[2.5rem]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                             <Binary size={18} />
                        </div>
                        <h3 className="text-sm font-black text-text-muted uppercase tracking-[0.2em]">Identification</h3>
                    </div>
                    
                    <Input
                        label="Problem Identifier"
                        placeholder="e.g., Trapping Rain Water"
                        value={values.problemName}
                        onChange={(e) => handleChange('problemName', e.target.value)}
                        required
                        className="h-14 bg-console-bg/50 border-border-subtle/40 rounded-2xl text-lg font-bold"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Target Cluster (Topic)"
                            value={values.topic}
                            onChange={(v) => handleChange('topic', v)}
                            options={DSA_TOPIC_OPTIONS.filter((option) => option.value)}
                            placeholder="Select topic"
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl"
                        />
                        <Select
                            label="Complexity Level"
                            value={values.difficulty}
                            onChange={(v) => handleChange('difficulty', v)}
                            options={DIFFICULTIES}
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl"
                        />
                    </div>
                </div>

                <div className="space-y-6 bg-console-surface/30 backdrop-blur-xl border border-border-subtle/30 p-8 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                             <Activity size={18} />
                        </div>
                        <h3 className="text-sm font-black text-text-muted uppercase tracking-[0.2em]">Runtime Status</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Execution Status"
                            value={values.status}
                            onChange={(v) => handleChange('status', v)}
                            options={STATUSES}
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl"
                        />
                        <Input
                            label="Execution Time (m)"
                            type="number"
                            value={values.timeSpent}
                            onChange={(e) => handleChange('timeSpent', parseInt(e.target.value))}
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Time Complexity"
                            placeholder="O(n)"
                            value={values.timeComplexity}
                            onChange={(e) => handleChange('timeComplexity', e.target.value)}
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl font-mono"
                        />
                        <Input
                            label="Space Complexity"
                            placeholder="O(1)"
                            value={values.spaceComplexity}
                            onChange={(e) => handleChange('spaceComplexity', e.target.value)}
                            className="h-12 bg-console-bg/50 border-border-subtle/40 rounded-xl font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* Metacognition Section */}
            <div className="relative group overflow-hidden bg-console-surface/30 backdrop-blur-xl border border-border-subtle/30 p-8 rounded-[2.5rem]">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 group-hover:opacity-[0.1] transition-opacity">
                    <BrainCircuit size={120} />
                </div>
                
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                         <Zap size={18} />
                    </div>
                    <h3 className="text-sm font-black text-text-muted uppercase tracking-[0.2em]">Metacognitive Audit</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Confidence Index</label>
                            <div className="flex items-center gap-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleChange('confidenceLevel', star)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl transition-all flex items-center justify-center",
                                            values.confidenceLevel >= star 
                                                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-105" 
                                                : "bg-white/5 text-text-muted hover:bg-white/10"
                                        )}
                                    >
                                        <Star size={20} fill={values.confidenceLevel >= star ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Input
                            label="Core Pattern"
                            placeholder="e.g., Sliding Window, Dijkstra"
                            value={values.patternLearned}
                            onChange={(e) => handleChange('patternLearned', e.target.value)}
                            className="h-12 bg-console-bg border-white/5 rounded-xl"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                            <HelpCircle size={14} className="text-blue-400" /> simpleExplanation (Feynman Audit)
                        </label>
                        <Textarea
                            placeholder="Explain the core logic in simple terms... What's the key 'trick'?"
                            value={values.simpleExplanation}
                            onChange={(e) => handleChange('simpleExplanation', e.target.value)}
                            rows={4}
                            className="bg-console-bg border-white/5 rounded-2xl text-sm italic leading-relaxed"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-text-primary"
                >
                    {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {showAdvanced ? 'Collapse Diagnostics' : 'Expand Diagnostics'}
                </button>

                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-8 overflow-hidden pt-4"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                     <Input
                                        label="Source Platform"
                                        value={values.platform}
                                        onChange={(e) => handleChange('platform', e.target.value)}
                                        className="h-12 bg-console-bg border-white/5 rounded-xl"
                                    />
                                    <Input
                                        label="Direct Solution Link"
                                        placeholder="https://leetcode.com/..."
                                        value={values.solutionLink}
                                        onChange={(e) => handleChange('solutionLink', e.target.value)}
                                        className="h-12 bg-console-bg border-white/5 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Input
                                        label="Corporate Tags (optional)"
                                        placeholder="Google, Amazon, Meta..."
                                        value={values.companyTags}
                                        onChange={(e) => handleChange('companyTags', e.target.value)}
                                        className="h-12 bg-console-bg border-white/5 rounded-xl"
                                    />
                                    <Textarea
                                        label="Execution Roadmap (Notes)"
                                        placeholder="General notes or observations..."
                                        value={values.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        rows={2}
                                        className="bg-console-bg border-white/5 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-status-error uppercase tracking-widest leading-none">
                                    <AlertTriangle size={14} /> Deviation Analysis (Mistakes)
                                </label>
                                <Textarea
                                    placeholder="What was the bottleneck? Where did the logic fail initially?"
                                    value={values.mistakes}
                                    onChange={(e) => handleChange('mistakes', e.target.value)}
                                    rows={3}
                                    className="bg-console-bg/50 border-status-error/10 hover:border-status-error/30 rounded-2xl text-sm"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">
                                         <Code2 size={14} /> Solution Payload
                                    </div>
                                    <span className="text-[9px] font-black text-text-disabled uppercase tracking-[0.2em]">Monospace Terminal Output</span>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <textarea
                                        className="relative w-full h-[500px] p-8 font-mono text-sm bg-console-bg/80 backdrop-blur-md text-text-primary rounded-2xl border border-white/5 focus:border-blue-500/30 outline-none transition-all resize-y shadow-inner"
                                        placeholder="// INITIALIZE ALGORITHM PAYLOAD..."
                                        value={values.solutionCode}
                                        onChange={(e) => handleChange('solutionCode', e.target.value)}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center gap-4 pt-10 border-t border-white/5">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="flex-1 h-16 rounded-2xl border border-white/5 text-text-muted hover:text-text-primary hover:bg-white/5 font-black uppercase tracking-widest"
                >
                    Abort
                </Button>
                <Button
                    type="submit"
                    isLoading={isSaving}
                    className="flex-[2] h-16 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-transform"
                >
                    {initialValues?._id ? 'Synchronize Record' : 'Commit Problem'}
                </Button>
            </div>
        </motion.form>
    );
}
