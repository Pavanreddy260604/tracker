import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Dumbbell, Moon, Trash2 } from 'lucide-react';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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



    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateTodayLog(values);
            onSuccess?.();
            toast.success('Progress saved successfully!');
        } catch (error: any) {
            const message = error.response?.data?.error || 'Failed to save progress';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const totalHours = values.dsaHours + values.backendHours + values.projectHours;

    return (
        <motion.div
            className={cn('space-y-5', className)}
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
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{target}H TARGET</p>
                        </div>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
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
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">DSA problems today</p>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={values.dsaProblemsSolved}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setValues(prev => ({ ...prev, dsaProblemsSolved: Math.min(99, parseInt(val) || 0) }));
                        }}
                        className="w-20 text-center font-bold h-10"
                    />
                </div>

            </div>

            {/* Sleep & Exercise */}
            <div className="grid grid-cols-2 gap-4">
                {/* Sleep */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                        <Moon size={18} className="text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Sleep</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Input
                            type="text"
                            inputMode="numeric"
                            value={values.sleepHours}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^\d.]/g, '');
                                setValues(prev => ({ ...prev, sleepHours: Math.min(24, parseFloat(val) || 0) }));
                            }}
                            className="w-16 text-center font-bold h-8 text-xs"
                        />
                    </div>

                </div>

                {/* Exercise */}
                <button
                    onClick={() => setValues(prev => ({ ...prev, exerciseCompleted: !prev.exerciseCompleted }))}
                    className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all',
                        values.exerciseCompleted
                            ? 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-white/10'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Dumbbell size={18} className={values.exerciseCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'} />
                        <span className={cn('text-sm font-medium', values.exerciseCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white')}>
                            Exercise
                        </span>
                    </div>
                    {values.exerciseCompleted && <Check size={18} className="text-green-600 dark:text-green-400" />}
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 sm:pt-6 mt-6 border-t border-gray-200 dark:border-white/10">
                {/* Reset Button (Only if there is data to reset) */}
                {initialValues && (
                    <Button
                        variant="danger"
                        onClick={() => setIsDeleteModalOpen(true)}
                        isLoading={isDeleting}
                        className="w-1/3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-transparent transition-colors"
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
