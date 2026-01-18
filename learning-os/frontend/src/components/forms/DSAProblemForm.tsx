import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { api } from '../../services/api';

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
        // DSA 2.0
        solutionCode?: string;
        timeComplexity?: string;
        spaceComplexity?: string;
        companyTags?: string[];
        nextReviewDate?: string;
    };
    onSuccess?: () => void;
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

const TOPICS = [
    { value: 'arrays', label: 'Arrays' },
    { value: 'strings', label: 'Strings' },
    { value: 'linked-list', label: 'Linked List' },
    { value: 'stack', label: 'Stack' },
    { value: 'queue', label: 'Queue' },
    { value: 'trees', label: 'Trees' },
    { value: 'graphs', label: 'Graphs' },
    { value: 'dp', label: 'Dynamic Programming' },
    { value: 'greedy', label: 'Greedy' },
    { value: 'backtracking', label: 'Backtracking' },
    { value: 'binary-search', label: 'Binary Search' },
    { value: 'two-pointers', label: 'Two Pointers' },
    { value: 'sliding-window', label: 'Sliding Window' },
    { value: 'heap', label: 'Heap / Priority Queue' },
    { value: 'trie', label: 'Trie' },
    { value: 'bit-manipulation', label: 'Bit Manipulation' },
    { value: 'math', label: 'Math' },
    { value: 'recursion', label: 'Recursion' },
    { value: 'sorting', label: 'Sorting' },
    { value: 'hashing', label: 'Hashing' },
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
        topic: initialValues?.topic || '',
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
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialValues) {
            setValues({
                problemName: initialValues.problemName || '',
                platform: initialValues.platform || 'leetcode',
                topic: initialValues.topic || '',
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
            });
        }
    }, [initialValues]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!values.problemName.trim()) {
            setError('Problem name is required');
            return;
        }
        if (!values.topic) {
            setError('Topic is required');
            return;
        }

        setIsSaving(true);
        try {
            if (initialValues?._id) {
                await api.updateDSAProblem(initialValues._id, {
                    ...initialValues, // Preserve all initial data (like nextReviewDate)
                    ...values,      // Overwrite with form state
                    difficulty: values.difficulty as 'easy' | 'medium' | 'hard',
                    status: values.status as 'solved' | 'revisit' | 'attempted',
                    companyTags: values.companyTags.split(',').map(tag => tag.trim()).filter(t => t),
                });
            } else {
                // Calculate initial review date (SRS Lite)
                // Easy: 3 days, Medium: 2 days, Hard: 1 day
                const daysToAdd = values.difficulty === 'easy' ? 3 : values.difficulty === 'medium' ? 2 : 1;
                const nextReview = new Date();
                nextReview.setDate(nextReview.getDate() + daysToAdd);

                await api.createDSAProblem({
                    ...values,
                    difficulty: values.difficulty as 'easy' | 'medium' | 'hard',
                    status: values.status as 'solved' | 'revisit' | 'attempted',
                    companyTags: values.companyTags.split(',').map(tag => tag.trim()).filter(t => t),
                    nextReviewDate: nextReview.toISOString(),
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

    const handleChange = (field: string, value: string | number) => {
        setValues(prev => ({ ...prev, [field]: value }));
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

            {/* Section 1: Core Problem Info */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                    Problem Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <Input
                            label="Problem Name"
                            placeholder="e.g., Two Sum"
                            value={values.problemName}
                            onChange={(e) => handleChange('problemName', e.target.value)}
                            required
                        />
                    </div>
                    <Select
                        label="Platform"
                        value={values.platform}
                        onChange={(v) => handleChange('platform', v)}
                        options={PLATFORMS}
                    />
                    <Input
                        label="Solution Link"
                        placeholder="https://leetcode.com/ problems/..."
                        value={values.solutionLink}
                        onChange={(e) => handleChange('solutionLink', e.target.value)}
                    />
                </div>
            </div>

            {/* Section 2: Classification & Metrics */}
            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl border border-gray-100 dark:border-white/10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Select
                        label="Topic"
                        value={values.topic}
                        onChange={(v) => handleChange('topic', v)}
                        options={TOPICS}
                        placeholder="Select topic"
                    />
                    <Select
                        label="Difficulty"
                        value={values.difficulty}
                        onChange={(v) => handleChange('difficulty', v)}
                        options={DIFFICULTIES}
                    />
                    <Select
                        label="Status"
                        value={values.status}
                        onChange={(v) => handleChange('status', v)}
                        options={STATUSES}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input
                        type="number"
                        label="Time Spent (min)"
                        value={values.timeSpent || ''}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleChange('timeSpent', isNaN(val) ? 0 : val);
                        }}
                        min={0}
                        max={300}
                    />
                    <Input
                        label="Time Complexity"
                        placeholder="e.g. O(n)"
                        value={values.timeComplexity}
                        onChange={(e) => handleChange('timeComplexity', e.target.value)}
                    />
                    <Input
                        label="Space Complexity"
                        placeholder="e.g. O(1)"
                        value={values.spaceComplexity}
                        onChange={(e) => handleChange('spaceComplexity', e.target.value)}
                    />
                </div>
            </div>

            {/* Section 3: Analysis & Solution */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                    Analysis & Solution
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Pattern Learned"
                        placeholder="e.g., Sliding Window, Two Pointers"
                        value={values.patternLearned}
                        onChange={(e) => handleChange('patternLearned', e.target.value)}
                    />
                    <Input
                        label="Company Tags"
                        placeholder="Google, Amazon, Meta"
                        value={values.companyTags}
                        onChange={(e) => handleChange('companyTags', e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Textarea
                        label="Mistakes & Key Learnings"
                        placeholder="What was the tricky part? What did you miss initially?"
                        value={values.mistakes}
                        onChange={(e) => handleChange('mistakes', e.target.value)}
                        rows={3}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Solution Code</label>
                        <textarea
                            className="w-full h-64 p-4 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                            placeholder="// Paste your standardized solution code here..."
                            value={values.solutionCode}
                            onChange={(e) => handleChange('solutionCode', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-4">
                {onCancel && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    isLoading={isSaving}
                    className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                >
                    {initialValues?._id ? 'Update Problem' : 'Save Problem'}
                </Button>
            </div>
        </motion.form>
    );
}
