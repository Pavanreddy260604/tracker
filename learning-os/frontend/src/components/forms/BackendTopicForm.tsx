import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';
import { Plus, Trash2, CheckCircle2, Circle, BookOpen, PlayCircle, FileText, Clock, Zap, LayoutGrid } from 'lucide-react';

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
    };
    onSuccess?: () => void;
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
    });

    const [subTopics, setSubTopics] = useState<SubTopic[]>(initialValues?.subTopics || []);
    const [newSubTopic, setNewSubTopic] = useState('');

    const [resources, setResources] = useState<Resource[]>(initialValues?.resources || []);
    const [newResource, setNewResource] = useState({ title: '', url: '', type: 'docs' as const });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

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
            });
            setSubTopics(initialValues.subTopics || []);
            setResources(initialValues.resources || []);
        }
    }, [initialValues]);

    useEffect(() => {
        const firstInput = document.querySelector('input[name="topicName"]') as HTMLInputElement;
        firstInput?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!values.topicName.trim()) {
            setError('Topic name is required');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...values,
                difficulty: (values.difficulty as 'easy' | 'medium' | 'hard') || undefined,
                subTopics,
                resources
            };

            if (initialValues?._id) {
                await api.updateBackendTopic(initialValues._id, payload);
            } else {
                await api.createBackendTopic({
                    ...payload,
                    date: new Date().toISOString().split('T')[0],
                });
            }
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    // SubTopics Handlers
    const addSubTopic = () => {
        if (!newSubTopic.trim()) return;
        setSubTopics([...subTopics, { id: crypto.randomUUID(), text: newSubTopic, isCompleted: false }]);
        setNewSubTopic('');
    };

    const toggleSubTopic = (id: string) => {
        setSubTopics(subTopics.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
    };

    const removeSubTopic = (id: string) => {
        setSubTopics(subTopics.filter(t => t.id !== id));
    };

    // Resource Handlers
    const addResource = () => {
        if (!newResource.title.trim() || !newResource.url.trim()) return;

        let url = newResource.url;
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }

        setResources([...resources, { ...newResource, url }]);
        setNewResource({ title: '', url: '', type: 'docs' });
    };

    const removeResource = (index: number) => {
        setResources(resources.filter((_, i) => i !== index));
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            className="space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {error && (
                <div className="p-4 text-base text-status-error bg-status-error/10 border border-status-error/20 rounded-xl flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-status-error flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Section 1: Main Information */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
                    <LayoutGrid size={20} className="text-blue-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Overview
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-8">
                    <Input
                        name="topicName"
                        label="Topic Name"
                        placeholder="e.g., Implementing JWT Authentication Flow"
                        value={values.topicName}
                        onChange={(e) => handleChange('topicName', e.target.value)}
                        required
                        className="h-14 text-lg font-medium"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                        <Select
                            label="Category"
                            value={values.category}
                            onChange={(v) => handleChange('category', v)}
                            options={CATEGORIES}
                            className="h-12"
                        />
                        <Select
                            label="Type"
                            value={values.type}
                            onChange={(v) => handleChange('type', v)}
                            options={TYPES}
                            className="h-12"
                        />
                    </div>
                </div>
            </div>

            {/* Section 2: Status & Metadata */}
            <div className="space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-2 mb-4">
                    <Zap size={20} className="text-amber-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Progress & Meta
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                    <Select
                        label="Current Status"
                        value={values.status}
                        onChange={(v) => handleChange('status', v)}
                        options={STATUSES}
                        className="h-12"
                    />

                    <Select
                        label="Difficulty"
                        value={values.difficulty}
                        onChange={(v) => handleChange('difficulty', v)}
                        options={DIFFICULTIES}
                        className="h-12"
                    />

                    <div className="relative">
                        <Clock size={18} className="absolute left-4 top-[2.6rem] text-gray-400 dark:text-gray-500" />
                        <Input
                            label="Time Spent"
                            placeholder="e.g., 2h 30m"
                            value={values.timeSpent}
                            onChange={(e) => handleChange('timeSpent', e.target.value)}
                            className="pl-10 h-12"
                        />
                    </div>
                </div>
            </div>

            {/* Section 3: Checklist */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
                    <CheckCircle2 size={20} className="text-green-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Checklist
                    </h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4 sm:space-y-6">
                    <div className="flex gap-3 sm:gap-4">
                        <Input
                            placeholder="Add a new task or sub-topic..."
                            value={newSubTopic}
                            onChange={(e) => setNewSubTopic(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubTopic())}
                            className="flex-1 h-12 text-base"
                        />
                        <Button type="button" onClick={addSubTopic} size="lg" className="h-12 px-6">
                            <Plus size={20} className="mr-2" /> Add Task
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <AnimatePresence>
                            {subTopics.map(topic => (
                                <motion.div
                                    key={topic.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 group hover:border-blue-500/30 transition-all"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleSubTopic(topic.id)}
                                        className="text-gray-400 dark:text-gray-500 hover:text-green-500 transition-colors flex-shrink-0"
                                    >
                                        {topic.isCompleted ? <CheckCircle2 size={24} className="text-green-500 fill-green-500/10" /> : <Circle size={24} />}
                                    </button>
                                    <span className={`flex-1 text-base ${topic.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                        {topic.text}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeSubTopic(topic.id)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-2"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {subTopics.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                <Zap size={32} className="mb-3 opacity-30" />
                                <p className="text-sm font-medium">No tasks added yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section 4: Resources */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
                    <BookOpen size={20} className="text-blue-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Resources
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/10">
                    <div className="space-y-6">
                        <Input
                            placeholder="Resource Title (e.g., MDN Documentation)"
                            value={newResource.title}
                            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                            label="Title"
                            className="h-12 text-base"
                        />
                        <Input
                            placeholder="Paste URL here..."
                            value={newResource.url}
                            onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                            label="Link"
                            className="h-12 text-base font-mono"
                        />
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <Select
                                    value={newResource.type}
                                    onChange={(v: any) => setNewResource({ ...newResource, type: v })}
                                    options={RESOURCE_TYPES}
                                    label="Type"
                                    className="h-12"
                                />
                            </div>
                            <Button type="button" onClick={addResource} className="h-12 px-8 text-base">
                                Add Resource
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        <AnimatePresence>
                            {resources.map((res, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 group hover:border-blue-500/30 transition-all"
                                >
                                    <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${res.type === 'video' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {res.type === 'video' ? <PlayCircle size={24} /> :
                                            res.type === 'course' ? <BookOpen size={24} /> :
                                                <FileText size={24} />}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">{res.title}</p>
                                        <a href={res.url} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline truncate block font-medium">
                                            {res.url.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                    <button type="button" onClick={() => removeResource(idx)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-2">
                                        <Trash2 size={20} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Section 5: Detailed Notes */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
                    <FileText size={20} className="text-gray-500 dark:text-gray-400" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Details & Logs
                    </h3>
                </div>

                <div className="space-y-6">
                    <Input
                        label="Files / Components Modified"
                        placeholder="e.g., auth.controller.ts, middleware/jwt.ts"
                        value={values.filesModified}
                        onChange={(e) => handleChange('filesModified', e.target.value)}
                        className="h-12"
                    />

                    <Textarea
                        label="Bugs / Challenges"
                        placeholder="Describe any roadblocks, errors encountered, and how you solved them..."
                        value={values.bugsFaced}
                        onChange={(e) => handleChange('bugsFaced', e.target.value)}
                        rows={4}
                        className="text-base leading-relaxed"
                    />

                    <Textarea
                        label="Learning Notes"
                        placeholder="Document key learnings, code snippets, commands, and architectural decisions..."
                        value={values.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        rows={8}
                        className="text-base leading-relaxed"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6 mt-6 border-t border-gray-200 dark:border-white/10">
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-12 text-base text-gray-500 dark:text-gray-400">
                        Cancel
                    </Button>
                )}
                <Button type="submit" isLoading={isSaving} className="flex-[2] h-12 text-base bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                    {initialValues?._id ? 'Update Topic' : 'Save Learning Topic'}
                </Button>
            </div>
        </motion.form>
    );
}