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
            const questionCount = questions.length;
            const aggregatedTopics = Array.from(new Set(questions.flatMap(q => q.topics)));
            const difficultyMix = questions.length === 1 ? questions[0].difficulty : 'mixed';

            const response = await api.startInterview({
                duration,
                language,
                questionCount,
                difficulty: difficultyMix,
                topics: aggregatedTopics,
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
        <div className="sw-page max-w-5xl mx-auto space-y-8 pb-32">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="sw-page-title">Interview Simulator</h1>
                <p className="sw-page-subtitle max-w-2xl">
                    Design your perfect technical interview. Configure each question or let AI balance difficulty and topics.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="sw-card p-6 sticky top-6">
                        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[color:var(--border-subtle)]">
                            <Settings size={18} className="sw-accent-text" />
                            <span className="sw-section-title">Session Settings</span>
                        </div>

                        {/* Duration */}
                        <div className="mb-6">
                            <label className="sw-label flex items-center gap-2">
                                <Clock size={14} /> Duration (mins)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[30, 45, 60, 90].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setDuration(mins)}
                                        className={`sw-option ${duration === mins ? 'is-active' : ''}`}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div>
                            <label className="sw-label flex items-center gap-2">
                                <Code2 size={14} /> Language
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="sw-select"
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
                    <div className="sw-card p-6">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[color:var(--border-subtle)]">
                            <h2 className="sw-section-title flex items-center gap-2">
                                <Sparkles size={18} className="sw-accent-text" />
                                Question Configuration
                            </h2>
                            <span className="sw-muted text-sm">{questions.length} Questions</span>
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence>
                                {questions.map((q, idx) => (
                                    <motion.div
                                        key={q.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="sw-card sw-card-muted p-4"
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="sw-step-indicator">
                                                    {idx + 1}
                                                </span>
                                                <h3 className="sw-item-title">Question {idx + 1}</h3>
                                            </div>

                                            {questions.length > 1 && (
                                                <button
                                                    onClick={() => removeQuestion(q.id)}
                                                    className="sw-icon-button sw-icon-button-sm"
                                                    aria-label="Remove question"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Difficulty Select */}
                                            <div>
                                                <label className="sw-label">Difficulty</label>
                                                <div className="sw-segment">
                                                    {['easy', 'medium', 'hard'].map(diff => (
                                                        <button
                                                            key={diff}
                                                            onClick={() => updateQuestion(q.id, 'difficulty', diff)}
                                                            className={`sw-segment-item ${q.difficulty === diff ? 'is-active' : ''} is-${diff}`}
                                                        >
                                                            {diff}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Topics Select */}
                                            <div>
                                                <label className="sw-label">
                                                    Topics <span className="sw-muted font-normal ml-1">({q.topics.length})</span>
                                                </label>
                                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                    {categories.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => toggleTopic(q.id, cat)}
                                                            className={`sw-chip ${q.topics.includes(cat) ? 'is-active' : ''}`}
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
                            className="sw-btn sw-btn-secondary w-full justify-center border-dashed"
                        >
                            <Plus size={18} /> Add Another Question
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="interview-footer">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm sw-muted">
                        <AlertCircle size={18} className="sw-accent-text" />
                        <span>AI will generate tailored questions for each slot.</span>
                    </div>
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="sw-btn sw-btn-primary"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Begin Interview <Play size={16} fill="currentColor" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
