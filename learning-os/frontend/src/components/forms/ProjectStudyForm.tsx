import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

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
        involvedTables?: string;
        questions?: string;
        notes?: string;
        architectureDiagram?: string;
        keyTakeaways?: string[];
        tasks?: Task[];
    };
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function ProjectStudyForm({ initialValues, onSuccess, onCancel }: ProjectStudyFormProps) {
    const [values, setValues] = useState({
        projectName: initialValues?.projectName || '',
        repoUrl: initialValues?.repoUrl || '',
        moduleStudied: initialValues?.moduleStudied || '',
        flowUnderstanding: initialValues?.flowUnderstanding || '',
        involvedTables: initialValues?.involvedTables || '',
        questions: initialValues?.questions || '',
        notes: initialValues?.notes || '',
        architectureDiagram: initialValues?.architectureDiagram || '',
        keyTakeaways: initialValues?.keyTakeaways?.join('\n') || '',
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
                involvedTables: initialValues.involvedTables || '',
                questions: initialValues.questions || '',
                notes: initialValues.notes || '',
                architectureDiagram: initialValues.architectureDiagram || '',
                keyTakeaways: initialValues.keyTakeaways?.join('\n') || '',
            });
            setTasks(initialValues.tasks || []);
        }
    }, [initialValues]);

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
                keyTakeaways: values.keyTakeaways.split('\n').filter(t => t.trim()),
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
        setValues(prev => ({ ...prev, [field]: value }));
    };

    const addTask = () => {
        if (!newTask.trim()) return;
        setTasks([...tasks, { id: crypto.randomUUID(), text: newTask, status: 'todo' }]);
        setNewTask('');
    };

    const toggleTaskStatus = (id: string) => {
        setTasks(tasks.map(t => {
            if (t.id !== id) return t;
            const nextStatus = t.status === 'todo' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'todo';
            return { ...t, status: nextStatus };
        }));
    };

    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            className="space-y-8"
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
                    <Input
                        label="Involved Tables"
                        placeholder="users, sessions..."
                        value={values.involvedTables}
                        onChange={(e) => handleChange('involvedTables', e.target.value)}
                    />
                </div>
            </div>

            {/* Architecture & Flow */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                    Deep Dive
                </h3>

                <Input
                    label="Architecture Diagram URL"
                    placeholder="https://excalidraw.com/..."
                    value={values.architectureDiagram}
                    onChange={(e) => handleChange('architectureDiagram', e.target.value)}
                />

                <Textarea
                    label="Flow Understanding"
                    placeholder="Describe how the data flows from request to response..."
                    value={values.flowUnderstanding}
                    onChange={(e) => handleChange('flowUnderstanding', e.target.value)}
                    rows={4}
                />
            </div>

            {/* Tasks / Kanban Lite */}
            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl border border-gray-100 dark:border-white/10 space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Implementation Tasks</h4>

                <div className="flex gap-2">
                    <Input
                        placeholder="Add a new sub-task..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
                        className="flex-1"
                    />
                    <Button type="button" onClick={addTask} size="sm" leftIcon={<Plus size={16} />}>
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
                                <button type="button" onClick={() => toggleTaskStatus(task.id)} className="text-gray-400 hover:text-blue-500">
                                    {task.status === 'done' ? <CheckCircle2 size={18} className="text-green-500" /> :
                                        task.status === 'in-progress' ? <Circle size={18} className="text-blue-500 fill-blue-500/20" /> :
                                            <Circle size={18} />}
                                </button>
                                <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {task.text}
                                </span>
                                <button type="button" onClick={() => removeTask(task.id)} className="text-gray-400 hover:text-red-500 opacity-50 hover:opacity-100">
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

            {/* Takeaways */}
            <div className="space-y-4">
                <Textarea
                    label="Questions & Notes"
                    placeholder="Unclear parts, questions to ask..."
                    value={values.questions}
                    onChange={(e) => handleChange('questions', e.target.value)}
                    rows={2}
                />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Key Takeaways (One per line)</label>
                    <textarea
                        className="w-full min-h-[100px] p-3 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                        placeholder="- Use dependency injection for testing&#10;- Optimize DB indexes"
                        value={values.keyTakeaways}
                        onChange={(e) => handleChange('keyTakeaways', e.target.value)}
                    />
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-4">
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
