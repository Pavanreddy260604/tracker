import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Play, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export function InterviewSetup() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        duration: 30,
        questionCount: 1,
        difficulty: 'medium',
        language: 'javascript',
        topics: [] as string[]
    });

    const categories = ['Array', 'String', 'DP', 'Graph', 'Tree', 'Greedy'];

    const handleStart = async () => {
        setIsLoading(true);
        try {
            const response = await api.startInterview(config);
            navigate(`/interview/${response._id}`);
        } catch (error) {
            console.error('Failed to start:', error);
            // Optionally show toast error
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                    Interview Simulator
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Practice coding interviews with AI-powered feedback and real-time constraints.
                </p>
            </motion.div>

            <div className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-xl dark:shadow-none space-y-8">

                {/* Duration */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <Clock size={16} className="text-blue-500" /> Duration
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                        {[15, 30, 45, 60].map(mins => (
                            <button
                                key={mins}
                                onClick={() => setConfig({ ...config, duration: mins })}
                                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${config.duration === mins
                                    ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500 ring-offset-2 dark:ring-offset-[#1c2128]'
                                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                            >
                                {mins} mins
                            </button>
                        ))}
                    </div>
                </div>

                {/* Difficulty */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Difficulty</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['easy', 'medium', 'hard'].map(diff => (
                            <button
                                key={diff}
                                onClick={() => setConfig({ ...config, difficulty: diff })}
                                className={`py-3 px-4 rounded-xl border text-sm font-medium capitalize transition-all ${config.difficulty === diff
                                    ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500 ring-offset-2 dark:ring-offset-[#1c2128]'
                                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                            >
                                {diff}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Language</label>
                    <div className="grid grid-cols-5 gap-3">
                        {['javascript', 'python', 'java', 'cpp', 'go'].map(lang => (
                            <button
                                key={lang}
                                onClick={() => setConfig({ ...config, language: lang })}
                                className={`py-3 px-2 rounded-xl border text-sm font-medium capitalize transition-all ${config.language === lang
                                    ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500 ring-offset-2 dark:ring-offset-[#1c2128]'
                                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                            >
                                {lang === 'cpp' ? 'C++' : lang}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question Count */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Number of Questions</label>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
                        <input
                            type="range" min="1" max="5" step="1"
                            value={config.questionCount}
                            onChange={(e) => setConfig({ ...config, questionCount: parseInt(e.target.value) })}
                            className="w-full accent-blue-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xl font-bold text-gray-900 dark:text-white w-8 text-center">{config.questionCount}</span>
                    </div>
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4 flex gap-3 text-sm text-yellow-800 dark:text-yellow-200/80">
                <AlertCircle size={20} className="shrink-0 text-yellow-600 dark:text-yellow-500" />
                <p>
                    Ensure <strong>Ollama</strong> is running locally for AI question generation and evaluation.
                </p>
            </div>

            {/* Start Button */}
            <button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 ring-1 ring-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <Play size={20} fill="currentColor" /> Start Interview
                    </>
                )}
            </button>
        </div>
    );
}
