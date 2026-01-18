import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Check, Dumbbell, Moon, Trash2 } from 'lucide-react';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { useDataStore } from '../../stores/dataStore';
import { DeleteModal } from '../ui/DeleteModal';
import { cn } from '../../lib/utils';

interface QuickLogProps {
    initialValues?: {
        dsaHours: number;
        backendHours: number;
        projectHours: number;
        exerciseCompleted: boolean;
        sleepHours: number;
        dsaProblemsSolved: number;
    };
    onSuccess?: () => void;
    className?: string;
}

export function QuickLog({ initialValues, onSuccess, className }: QuickLogProps) {
    const [values, setValues] = useState({
        dsaHours: initialValues?.dsaHours ?? 0,
        backendHours: initialValues?.backendHours ?? 0,
        projectHours: initialValues?.projectHours ?? 0,
        exerciseCompleted: initialValues?.exerciseCompleted ?? false,
        sleepHours: initialValues?.sleepHours ?? 7,
        dsaProblemsSolved: initialValues?.dsaProblemsSolved ?? 0,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const { updateTodayLog, deleteTodayLog } = useDataStore();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteTodayLog();
            onSuccess?.();
            toast.success('Log deleted successfully');
            setIsDeleteModalOpen(false);
        } catch (error) {
            toast.error('Failed to delete log');
        } finally {
            setIsDeleting(false);
        }
    };

    const adjustValue = (field: keyof typeof values, delta: number) => {
        setValues(prev => {
            const current = prev[field] as number;
            const newValue = Math.max(0, Math.min(field === 'sleepHours' ? 24 : 12, current + delta));
            return { ...prev, [field]: newValue };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateTodayLog(values);
            onSuccess?.();
            toast.success('Progress saved successfully!');
        } catch (error: any) {
            console.error('Failed to save:', error);
            // Show backend error message if available
            const message = error.response?.data?.error || 'Failed to save progress';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const totalHours = values.dsaHours + values.backendHours + values.projectHours;

    return (
        <motion.div
            className={cn('space-y-6', className)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* Study Hours */}
            {[
                { key: 'dsaHours', label: 'DSA Hours', target: 6, color: 'blue' },
                { key: 'backendHours', label: 'Backend Hours', target: 4, color: 'purple' },
                { key: 'projectHours', label: 'Project Hours', target: 1, color: 'cyan' },
            ].map(({ key, label, target }) => (
                <div key={key} className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                            <p className="text-xs text-gray-500">{target}h target</p>
                        </div>
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-300">
                            {values[key as keyof typeof values]}h
                        </span>
                    </div>
                    <Slider
                        value={values[key as keyof typeof values] as number}
                        min={0}
                        max={target}
                        step={0.5}
                        onChange={(val) => setValues(prev => ({ ...prev, [key]: val }))}
                    />
                </div>
            ))}

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-white/10" />

            {/* Problems Solved */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">Problems Solved</p>
                    <p className="text-xs text-gray-500">DSA problems today</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => adjustValue('dsaProblemsSolved', -1)}
                        className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="w-14 text-center text-xl font-bold text-gray-800 dark:text-gray-300">
                        {values.dsaProblemsSolved}
                    </span>
                    <button
                        onClick={() => adjustValue('dsaProblemsSolved', 1)}
                        className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Sleep & Exercise */}
            <div className="grid grid-cols-2 gap-4">
                {/* Sleep */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                        <Moon size={18} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Sleep</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => adjustValue('sleepHours', -0.5)}
                            className="w-6 h-6 rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 flex items-center justify-center text-gray-600 dark:text-gray-400"
                        >
                            <Minus size={12} />
                        </button>
                        <span className="w-10 text-center font-medium text-gray-900 dark:text-white">
                            {values.sleepHours}h
                        </span>
                        <button
                            onClick={() => adjustValue('sleepHours', 0.5)}
                            className="w-6 h-6 rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 flex items-center justify-center text-gray-600 dark:text-gray-400"
                        >
                            <Plus size={12} />
                        </button>
                    </div>
                </div>

                {/* Exercise */}
                <button
                    onClick={() => setValues(prev => ({ ...prev, exerciseCompleted: !prev.exerciseCompleted }))}
                    className={cn(
                        'flex items-center justify-between p-3 rounded-xl transition-colors',
                        values.exerciseCompleted
                            ? 'bg-gray-200 dark:bg-gray-700 border border-gray-400 dark:border-gray-600'
                            : 'bg-gray-100 dark:bg-white/5 border border-transparent'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Dumbbell size={18} className={values.exerciseCompleted ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'} />
                        <span className={cn('text-sm', values.exerciseCompleted ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-300')}>
                            Exercise
                        </span>
                    </div>
                    {values.exerciseCompleted && <Check size={18} className="text-gray-800 dark:text-gray-200" />}
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                {/* Reset Button (Only if there is data to reset) */}
                {initialValues && (
                    <Button
                        variant="danger"
                        onClick={() => setIsDeleteModalOpen(true)}
                        isLoading={isDeleting}
                        className="w-1/3 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border border-transparent"
                    >
                        <Trash2 size={18} />
                    </Button>
                )}

                <Button
                    onClick={handleSave}
                    isLoading={isSaving}
                    className="flex-1"
                    size="lg"
                >
                    {totalHours >= 1 ? (
                        <>Log {totalHours}h Today ✨</>
                    ) : (
                        <>Save Progress</>
                    )}
                </Button>
            </div>

            <DeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Today's Log"
                description="Are you sure you want to delete today's progress log? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </motion.div>
    );
}
