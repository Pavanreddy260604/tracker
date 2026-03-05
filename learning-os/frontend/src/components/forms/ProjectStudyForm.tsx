import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
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
        flowUnderstanding: string;
        coreComponents?: string;
        questions?: string;
        notes?: string;
        tasks?: Task[];
        keyTakeaways?: string[];
    };
    onSuccess?: () => void;
    onCancel?: () => void;
    onChange?: (data: Partial<ProjectStudy>) => void;
    autoSave?: boolean;
}

export function ProjectStudyForm({ initialValues, onSuccess, onCancel, onChange }: ProjectStudyFormProps) {
    const [values, setValues] = useState({
        projectName: initialValues?.projectName || '',
        repoUrl: initialValues?.repoUrl || '',
        moduleStudied: initialValues?.moduleStudied || '',
        flowUnderstanding: initialValues?.flowUnderstanding || '',
        coreComponents: initialValues?.coreComponents || '',
        questions: initialValues?.questions || '',
        notes: initialValues?.notes || '',
        keyTakeaways: initialValues?.keyTakeaways || [],
    });

    const [tasks, setTasks] = useState<Task[]>(initialValues?.tasks || []);
    const [newTask, setNewTask] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialValues) {
            setValues({
                projectName: initialValues.projectName || '',
                repoUrl: initialValues.repoUrl || '',
                moduleStudied: initialValues.moduleStudied || '',
                flowUnderstanding: initialValues.flowUnderstanding || '',
                coreComponents: initialValues.coreComponents || '',
                questions: initialValues.questions || '',
                notes: initialValues.notes || '',
                keyTakeaways: initialValues.keyTakeaways || [],
            });
            setTasks(initialValues.tasks || []);
        }
    }, [initialValues]);

    // Phase 39: Keyboard Shortcuts Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit(e as any);
            }
            // Alt + N for Name
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                document.getElementById('input-project-name')?.focus();
            }
            // Alt + T for Task
            if (e.altKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                document.getElementById('input-add-a-new-sub-task...')?.focus();
            }
            // Alt + C for Components
            if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                document.getElementById('input-add-component-(e.g.-mongoose,-redis)...')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [values, tasks]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!values.projectName.trim()) {
            setError('Project name is required');
            return;
        }
        if (!values.moduleStudied.trim()) {
            setError('Module/Service name is required');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...values,
                tasks: tasks
            };

            if (initialValues?._id) {
                await api.updateProjectStudy(initialValues._id, payload);
            } else {
                await api.createProjectStudy({
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
        const newValues = { ...values, [field]: value };
        setValues(newValues);
        onChange?.({ ...newValues, tasks });
    };

    const addTask = () => {
        if (!newTask.trim()) return;
        const newTasks: Task[] = [...tasks, { id: crypto.randomUUID(), text: newTask, status: 'todo' }];
        setTasks(newTasks);
        setNewTask('');
        onChange?.({ ...values, tasks: newTasks });
    };

    const toggleTaskStatus = (id: string) => {
        const newTasks = tasks.map(t => {
            if (t.id !== id) return t;
            const nextStatus = t.status === 'todo' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'todo';
            return { ...t, status: nextStatus as Task['status'] };
        });
        setTasks(newTasks);
        onChange?.({ ...values, tasks: newTasks });
    };

    const removeTask = (id: string) => {
        const newTasks = tasks.filter(t => t.id !== id);
        setTasks(newTasks);
        onChange?.({ ...values, tasks: newTasks });
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {error && (
                <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {error}
                </div>
            )}

            {/* Core Info */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                    Project Scope
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Project Name"
                        placeholder="e.g., NestJS Starter"
                        value={values.projectName}
                        onChange={(e) => handleChange('projectName', e.target.value)}
                        required
                    />
                    <Input
                        label="Repository URL"
                        placeholder="https://github.com/..."
                        value={values.repoUrl}
                        onChange={(e) => handleChange('repoUrl', e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Module / Service"
                        placeholder="e.g., Auth Module"
                        value={values.moduleStudied}
                        onChange={(e) => handleChange('moduleStudied', e.target.value)}
                        required
                    />
                </div>
            </div>

            {/* Core Components Tagging */}
            <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
                    <h3 className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                        Core Tech & Components
                    </h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {values.coreComponents.split(',').filter(t => t.trim()).map((tag, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-accent-primary/10 border border-accent-primary/20 rounded-full text-xs font-medium text-accent-primary">
                            {tag.trim()}
                            <button
                                onClick={() => {
                                    const tags = values.coreComponents.split(',').filter(t => t.trim());
                                    const newTags = tags.filter((_, i) => i !== idx);
                                    handleChange('coreComponents', newTags.join(', '));
                                }}
                                className="hover:text-status-error transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
                <Input
                    id="input-add-component-(e.g.-mongoose,-redis)..."
                    placeholder="Add component (e.g. Mongoose, Redis)..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value;
                            if (!val.trim()) return;
                            const current = values.coreComponents.split(',').filter(t => t.trim());
                            if (!current.includes(val.trim())) {
                                handleChange('coreComponents', [...current, val.trim()].join(', '));
                            }
                            (e.target as HTMLInputElement).value = '';
                        }
                    }}
                />
            </div>

            <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-border-subtle pb-2 mb-4">
                    Key Takeaways & Findings
                </h3>
                <Textarea
                    placeholder="Bullet point your main findings here..."
                    value={values.keyTakeaways.join('\n')}
                    onChange={(e) => {
                        const takeaways = e.target.value.split('\n');
                        const newValues = { ...values, keyTakeaways: takeaways };
                        setValues(newValues);
                        onChange?.({ ...newValues, tasks });
                    }}
                    rows={4}
                    className="font-medium"
                />
            </div>

            <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-text-disabled uppercase tracking-widest border-b border-border-subtle pb-2 mb-4">
                    Logical Flow & Understanding
                </h3>
                <Textarea
                    placeholder="How does data flow through this module? What are the key patterns?"
                    value={values.flowUnderstanding}
                    onChange={(e) => handleChange('flowUnderstanding', e.target.value)}
                    rows={6}
                    className="font-mono text-sm leading-relaxed"
                />
            </div>

            {/* Tasks / Kanban Lite */}
            <div className="bg-gray-50 dark:bg-white/5 p-4 sm:p-6 rounded-xl border border-gray-100 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Implementation Tasks</h4>
                    {tasks.length > 0 && tasks.some(t => t.status !== 'done') && (
                        <button
                            type="button"
                            onClick={() => {
                                const newTasks = tasks.map(t => ({ ...t, status: 'done' as const }));
                                setTasks(newTasks);
                                onChange?.({ ...values, tasks: newTasks });
                            }}
                            className="text-[10px] font-bold text-accent-primary uppercase tracking-wider hover:underline"
                        >
                            Mark All Done
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    <Input
                        id="input-add-a-new-sub-task..."
                        placeholder="Add a new sub-task..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        onClick={addTask}
                        size="sm"
                        leftIcon={<Plus size={16} />}
                        aria-label="Add task"
                    >
                        Add
                    </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    <AnimatePresence>
                        {tasks.map(task => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <button
                                            type="button"
                                            onClick={() => toggleTaskStatus(task.id)}
                                            aria-checked={task.status === 'done'}
                                            role="checkbox"
                                            aria-label={`Mark task "${task.text}" as ${task.status === 'done' ? 'todo' : 'done'}`}
                                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border ${task.status === 'done'
                                                ? 'bg-status-ok/10 text-status-ok border-status-ok/20'
                                                : task.status === 'in-progress'
                                                    ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                                                    : 'bg-text-disabled/10 text-text-secondary border-text-disabled/20'
                                                }`}
                                        >
                                            {task.status === 'done' ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                                            {task.status}
                                        </button>
                                        <span className={`text-sm ${task.status === 'done' ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
                                            {task.text}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeTask(task.id)}
                                    className="text-gray-400 hover:text-red-500 opacity-50 hover:opacity-100"
                                    aria-label={`Delete task "${task.text}"`}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {tasks.length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-2">No tasks added yet.</p>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <Textarea
                    label="Questions & Notes"
                    placeholder="Unclear parts, questions to ask..."
                    value={values.questions}
                    onChange={(e) => handleChange('questions', e.target.value)}
                    rows={2}
                />
            </div>

            <div className="pt-4 sm:pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 flex gap-3 sm:gap-4">
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
                        Cancel
                    </Button>
                )}
                <Button type="submit" isLoading={isSaving} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                    {initialValues?._id ? 'Update Project' : 'Save Project'}
                </Button>
            </div>
        </motion.form>
    );
}
