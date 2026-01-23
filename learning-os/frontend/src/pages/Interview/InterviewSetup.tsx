import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Plus, Trash2, Settings, Code2, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

interface QuestionConfig {
    id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
}

export function InterviewSetup() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    // Global Config
    const [duration, setDuration] = useState(30);
    const [language, setLanguage] = useState('javascript');

    // Question Config List
    const [questions, setQuestions] = useState<QuestionConfig[]>([
        { id: '1', difficulty: 'easy', topics: ['Array'] }
    ]);

    const categories = ['Array', 'String', 'DP', 'Graph', 'Tree', 'Greedy', 'HashTable', 'Stack', 'Queue', 'Heap'];

    const addQuestion = () => {
        setQuestions([
            ...questions,
            { id: Math.random().toString(36).substr(2, 9), difficulty: 'medium', topics: ['Array'] }
        ]);
    };

    const removeQuestion = (id: string) => {
        if (questions.length > 1) {
            setQuestions(questions.filter(q => q.id !== id));
        }
    };

    const updateQuestion = (id: string, field: keyof QuestionConfig, value: any) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const toggleTopic = (qId: string, topic: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const currentTopics = q.topics;
                const newTopics = currentTopics.includes(topic)
                    ? currentTopics.filter(t => t !== topic)
                    : [...currentTopics, topic];
                return { ...q, topics: newTopics.length ? newTopics : ['Array'] }; // Prevent empty topics
            }
            return q;
        }));
    };

    const handleStart = async () => {
        setIsLoading(true);
        try {
            // Remove 'id' before sending to API
            const questionsConfig = questions.map(({ difficulty, topics }) => ({ difficulty, topics }));

            const response = await api.startInterview({
                duration,
                language,
                questionsConfig
            });
            navigate(`/interview/${response._id}`);
        } catch (error) {
            console.error('Failed to start:', error);
            alert('Failed to start interview. Please check if backend is running.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent mb-3">
                    Enterprise Interview Simulator
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
                    Design your perfect technical interview. Configure each question specifically or let AI generate them based on your parameters.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Global Settings */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm sticky top-6">
                        <div className="flex items-center gap-2 mb-6 text-gray-900 dark:text-white font-semibold text-lg border-b border-gray-100 dark:border-white/5 pb-4">
                            <Settings size={20} className="text-gray-500" />
                            Session Settings
                        </div>

                        {/* Duration */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <Clock size={16} /> Duration (mins)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[30, 45, 60, 90].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setDuration(mins)}
                                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${duration === mins
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                            }`}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <Code2 size={16} /> Language
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="go">Go</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Question Builder */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-500" />
                                Question Configuration
                            </h2>
                            <span className="text-sm text-gray-500">{questions.length} Questions</span>
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence>
                                {questions.map((q, idx) => (
                                    <motion.div
                                        key={q.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50 dark:bg-black/20 group hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                    {idx + 1}
                                                </span>
                                                <h3 className="font-medium text-gray-900 dark:text-white">Question {idx + 1}</h3>
                                            </div>

                                            {questions.length > 1 && (
                                                <button
                                                    onClick={() => removeQuestion(q.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Difficulty Select */}
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Difficulty</label>
                                                <div className="flex bg-white dark:bg-[#1c2128] rounded-lg p-1 border border-gray-200 dark:border-white/10">
                                                    {['easy', 'medium', 'hard'].map(diff => (
                                                        <button
                                                            key={diff}
                                                            onClick={() => updateQuestion(q.id, 'difficulty', diff)}
                                                            className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${q.difficulty === diff
                                                                    ? diff === 'easy' ? 'bg-green-100 text-green-700' :
                                                                        diff === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-red-100 text-red-700'
                                                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
                                                                }`}
                                                        >
                                                            {diff}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Topics Select */}
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                                    Topics <span className="text-gray-400 font-normal ml-1">({q.topics.length})</span>
                                                </label>
                                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                                    {categories.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => toggleTopic(q.id, cat)}
                                                            className={`px-2 py-1 rounded text-xs font-medium border transition-all ${q.topics.includes(cat)
                                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                                    : 'bg-white dark:bg-[#1c2128] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                                                                }`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={addQuestion}
                            className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 dark:hover:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                            <Plus size={18} /> Add Another Question
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-t border-gray-200 dark:border-white/10 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <AlertCircle size={18} className="text-blue-500" />
                        <span>AI will generate tailored questions for each slot.</span>
                    </div>
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-95 transform active:scale-95"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Begin Logic Battle <Play size={18} fill="currentColor" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
