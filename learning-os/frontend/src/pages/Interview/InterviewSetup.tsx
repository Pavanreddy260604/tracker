import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Plus, Trash2, Settings, Code2, AlertCircle, Sparkles, Shield } from 'lucide-react';
import { api } from '../../services/api';
import { useDialog } from '../../hooks/useDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';

interface QuestionConfig {
    id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
}

interface SectionConfig {
    id: string;
    name: string;
    type: 'warm-up' | 'coding' | 'sql' | 'system-design' | 'mixed';
    duration: number; // in minutes
    questionCount: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    topics?: string[];
    questionsConfig?: QuestionConfig[];
}

type SectionType = SectionConfig['type'];

const SECTION_TYPE_OPTIONS: Array<{ value: SectionType; label: string }> = [
    { value: 'warm-up', label: 'Warm-up' },
    { value: 'coding', label: 'Coding' },
    { value: 'sql', label: 'SQL' },
    { value: 'system-design', label: 'System Design' },
    { value: 'mixed', label: 'Mixed' },
];

const TOPICS_BY_SECTION_TYPE: Record<SectionType, string[]> = {
    'warm-up': ['Array', 'String', 'HashTable', 'Stack', 'Queue'],
    coding: ['Array', 'String', 'DP', 'Graph', 'Tree', 'Greedy', 'HashTable', 'Stack', 'Queue', 'Heap'],
    sql: ['Joins', 'Aggregation', 'Window Functions', 'CTE', 'Subqueries', 'Indexing', 'Transactions', 'Schema Design'],
    'system-design': ['Scalability', 'Caching', 'Load Balancing', 'Database Sharding', 'Message Queues', 'Consistency', 'Observability', 'Security'],
    mixed: ['Algorithms', 'SQL', 'System Design', 'Data Modeling', 'Scalability'],
};

const getDefaultTopicsForType = (type: SectionType): string[] => TOPICS_BY_SECTION_TYPE[type].slice(0, 2);

export function InterviewSetup() {
    const navigate = useNavigate();
    const { dialog, showAlert, closeDialog } = useDialog();
    const [isLoading, setIsLoading] = useState(false);

    // Global Config
    const [totalDuration, setTotalDuration] = useState(90); // 90 minutes for protracted test
    const [language, setLanguage] = useState('javascript');
    const [strictMode, setStrictMode] = useState(true);
    const [enforceFullscreen, setEnforceFullscreen] = useState(true);

    // Section Config List
    const [sections, setSections] = useState<SectionConfig[]>([
        {
            id: '1',
            name: 'Warm-up',
            type: 'warm-up',
            duration: 10,
            questionCount: 2,
            difficulty: 'easy',
            topics: ['Array', 'String'],
            questionsConfig: [
                { id: 'q1', difficulty: 'easy', topics: ['Array'] },
                { id: 'q2', difficulty: 'easy', topics: ['String'] }
            ]
        },
        {
            id: '2',
            name: 'Core Coding',
            type: 'coding',
            duration: 40,
            questionCount: 3,
            difficulty: 'medium',
            topics: ['Array', 'DP', 'Tree'],
            questionsConfig: [
                { id: 'q3', difficulty: 'medium', topics: ['Array'] },
                { id: 'q4', difficulty: 'medium', topics: ['DP'] },
                { id: 'q5', difficulty: 'hard', topics: ['Tree'] }
            ]
        },
        {
            id: '3',
            name: 'SQL',
            type: 'sql',
            duration: 20,
            questionCount: 2,
            difficulty: 'medium',
            topics: ['Joins', 'Aggregation'],
            questionsConfig: []
        },
        {
            id: '4',
            name: 'System Design',
            type: 'system-design',
            duration: 20,
            questionCount: 1,
            difficulty: 'hard',
            topics: ['Scalability', 'Caching'],
            questionsConfig: []
        }
    ]);

    // Force cache refresh
    console.log('InterviewSetup component loaded');

    const addSection = () => {
        const newType: SectionType = 'sql';

        setSections([
            ...sections,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: `Section ${sections.length + 1}`,
                type: newType,
                duration: 20,
                questionCount: 2,
                difficulty: 'medium',
                topics: getDefaultTopicsForType(newType),
                questionsConfig: []
            }
        ]);
    };

    const removeSection = (id: string) => {
        if (sections.length > 1) {
            setSections(sections.filter(s => s.id !== id));
        }
    };

    const updateSection = (id: string, field: keyof SectionConfig, value: any) => {
        setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSectionTypeChange = (id: string, nextType: SectionType) => {
        setSections(prev =>
            prev.map((section) => {
                if (section.id !== id) return section;

                const allowedTopics = TOPICS_BY_SECTION_TYPE[nextType];
                const retainedTopics = (section.topics || []).filter(topic => allowedTopics.includes(topic));
                const topics = retainedTopics.length > 0 ? retainedTopics : getDefaultTopicsForType(nextType);

                return {
                    ...section,
                    type: nextType,
                    topics,
                    questionCount: nextType === 'system-design'
                        ? 1
                        : Math.max(section.questionCount || 1, 1),
                };
            })
        );
    };

    const handleStart = async () => {
        setIsLoading(true);
        try {
            // Prepare sections config for API
            const sectionsConfig = sections.map(section => {
                const { id, ...sectionData } = section;
                return {
                    ...sectionData,
                    questionsConfig: sectionData.questionsConfig?.map(q => {
                        const { id, ...questionData } = q;
                        return questionData;
                    })
                };
            });

            const response = await api.startInterview({
                duration: totalDuration,
                sectionCount: sections.length,
                difficulty: sections.every(s => s.difficulty === sections[0].difficulty) ? sections[0].difficulty as 'easy' | 'medium' | 'hard' | 'mixed' : 'mixed',
                language,
                strictMode,
                enforceFullscreen,
                sectionsConfig
            });

            navigate(`/interview/${response._id}`);
        } catch (error) {
            console.error('Failed to start:', error);
            showAlert('Setup Failed', 'Failed to start interview. Please check if backend is running.');
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
                                        onClick={() => setTotalDuration(mins)}
                                        className={`sw-option h-11 flex items-center justify-center transition-all ${totalDuration === mins ? 'is-active' : ''}`}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="mb-6">
                            <label className="sw-label flex items-center gap-2">
                                <Code2 size={14} /> Language
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="sw-select h-11"
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="go">Go</option>
                            </select>
                        </div>

                        {/* Proctoring Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="sw-label flex items-center gap-2">
                                        <Shield size={14} /> Strict Mode
                                    </label>
                                    <p className="text-xs text-text-tertiary mt-1">Enable proctoring and test integrity features</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setStrictMode(!strictMode);
                                        if (!strictMode) setEnforceFullscreen(true);
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${strictMode ? 'bg-accent-primary' : 'bg-console-surface-3'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-[color:var(--text-on-accent)] shadow-sm transition-transform ${strictMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {strictMode && (
                                <div className="flex items-center justify-between pl-4 border-l-2 border-accent-primary/20">
                                    <div>
                                        <label className="sw-label text-sm">Enforce Fullscreen</label>
                                        <p className="text-xs text-text-tertiary">Require fullscreen mode during test</p>
                                    </div>
                                    <button
                                        onClick={() => setEnforceFullscreen(!enforceFullscreen)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enforceFullscreen ? 'bg-accent-primary' : 'bg-console-surface-3'}`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-[color:var(--text-on-accent)] shadow-sm transition-transform ${enforceFullscreen ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            )}
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
                            <span className="sw-muted text-sm">{sections.length} Sections</span>
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence>
                                {sections.map((section, idx) => (
                                    <motion.div
                                        key={section.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="sw-card sw-card-muted p-4"
                                    >
                                        {(() => {
                                            const topicOptions = TOPICS_BY_SECTION_TYPE[section.type] || TOPICS_BY_SECTION_TYPE.coding;
                                            return (
                                                <>
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="sw-step-indicator">
                                                    {idx + 1}
                                                </span>
                                                <h3 className="sw-item-title">{section.name}</h3>
                                            </div>

                                            {sections.length > 1 && (
                                                <button
                                                    onClick={() => removeSection(section.id)}
                                                    className="sw-icon-button sw-icon-button-sm"
                                                    aria-label="Remove section"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Section Type */}
                                            <div>
                                                <label className="sw-label">Section Type</label>
                                                <select
                                                    value={section.type}
                                                    onChange={(e) => handleSectionTypeChange(section.id, e.target.value as SectionType)}
                                                    className="sw-select h-11"
                                                >
                                                    {SECTION_TYPE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Difficulty Select */}
                                            <div>
                                                <label className="sw-label">Difficulty</label>
                                                <div className="sw-segment min-h-[44px]">
                                                    {['easy', 'medium', 'hard'].map(diff => (
                                                        <button
                                                            key={diff}
                                                            onClick={() => updateSection(section.id, 'difficulty', diff)}
                                                            className={`sw-segment-item h-full flex-1 flex items-center justify-center ${section.difficulty === diff ? 'is-active' : ''} is-${diff}`}
                                                        >
                                                            {diff}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Topics Select */}
                                            <div>
                                                <label className="sw-label">
                                                    Topics <span className="sw-muted font-normal ml-1">({section.topics?.length || 0})</span>
                                                </label>
                                                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar -mx-1 px-1">
                                                    {topicOptions.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => {
                                                                const currentTopics = section.topics || [];
                                                                const newTopics = currentTopics.includes(cat)
                                                                    ? currentTopics.filter(t => t !== cat)
                                                                    : [...currentTopics, cat];
                                                                updateSection(
                                                                    section.id,
                                                                    'topics',
                                                                    newTopics.length ? newTopics : getDefaultTopicsForType(section.type)
                                                                );
                                                            }}
                                                            className={`sw-chip whitespace-nowrap h-9 px-4 flex items-center justify-center shrink-0 ${section.topics?.includes(cat) ? 'is-active' : ''}`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                                </>
                                            );
                                        })()}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={addSection}
                            className="sw-btn sw-btn-secondary w-full justify-center border-dashed h-11"
                        >
                            <Plus size={18} /> Add Another Section
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="interview-footer pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm sw-muted">
                        <AlertCircle size={18} className="sw-accent-text" />
                        <span>
                            AI will generate tailored questions for each slot. Interview questions and rules are proprietary and protected. Sharing or bypass attempts may result in account termination.
                        </span>
                    </div>
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="sw-btn sw-btn-primary w-full sm:w-auto h-12 justify-center"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Begin Interview <Play size={16} fill="currentColor" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            <AlertDialog
                isOpen={dialog.isOpen}
                onClose={closeDialog}
                title={dialog.title}
                description={dialog.description}
            />
        </div>
    );
}
