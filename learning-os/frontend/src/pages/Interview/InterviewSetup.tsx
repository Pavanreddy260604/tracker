import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Plus, Trash2, Settings, Code2, AlertCircle, Sparkles, Shield, Activity, Camera } from 'lucide-react';
import { api } from '../../services/api';
import { useDialog } from '../../hooks/useDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

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
    const [hasCameraAccess, setHasCameraAccess] = useState(false); // OFF by default — user must toggle ON (user gesture needed for getUserMedia)
    const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied' | 'checking'>('pending');
    const permissionStreamRef = useRef<MediaStream | null>(null);

    const requestCameraPermission = useCallback(async () => {
        setCameraPermission('checking');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // Keep stream ref so we can stop it on unmount / when camera disabled
            permissionStreamRef.current = stream;
            setCameraPermission('granted');
        } catch {
            setCameraPermission('denied');
        }
    }, []);

    const stopPermissionStream = useCallback(() => {
        if (permissionStreamRef.current) {
            permissionStreamRef.current.getTracks().forEach(t => t.stop());
            permissionStreamRef.current = null;
        }
    }, []);

    const handleCameraToggle = useCallback(() => {
        if (hasCameraAccess) {
            // Turning OFF
            setHasCameraAccess(false);
            setCameraPermission('pending');
            stopPermissionStream();
        } else {
            // Turning ON — request permission immediately
            setHasCameraAccess(true);
            requestCameraPermission();
        }
    }, [hasCameraAccess, requestCameraPermission, stopPermissionStream]);

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

    // Cleanup permission stream on unmount
    useEffect(() => {
        return () => stopPermissionStream();
    }, [stopPermissionStream]);

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
                hasCameraAccess,
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
        <div className="max-w-6xl mx-auto space-y-12 pb-32 pt-8">
            <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-3 text-accent-primary font-black uppercase tracking-[0.3em] text-[10px]">
                    <Sparkles size={14} className="animate-pulse" />
                    Interview Environment Architect
                </div>
                <h1 className="text-5xl lg:text-6xl font-black text-text-primary tracking-tighter leading-none">
                    Session <span className="text-accent-primary">Configuration</span>
                </h1>
                <p className="text-text-muted text-lg max-w-2xl font-medium tracking-tight leading-relaxed">
                    Design your perfect technical evaluation. Fine-tune every section or leverage AI to balance difficulty and systemic coverage.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-8">
                    <div className="interview-card p-8 sticky top-8 bg-console-surface/40 backdrop-blur-2xl border-white/5 shadow-elevation-2">
                        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                            <Settings size={18} className="text-accent-primary" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Global Parameters</h3>
                        </div>

                        {/* Duration */}
                        <div className="space-y-4 mb-8">
                            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <Clock size={14} className="text-accent-primary" /> Duration Matrix
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {[30, 45, 60, 90].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setTotalDuration(mins)}
                                        className={cn(
                                            "h-12 flex items-center justify-center rounded-xl font-bold transition-all border",
                                            totalDuration === mins 
                                                ? 'bg-accent-primary text-white border-accent-primary shadow-lg shadow-accent-primary/20 scale-105' 
                                                : 'bg-console-bg/50 text-text-muted border-white/5 hover:border-white/10'
                                        )}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="space-y-4 mb-8">
                            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <Code2 size={14} className="text-accent-primary" /> Runtime Protocol
                            </label>
                            <Select
                                value={language}
                                onChange={(v) => setLanguage(v)}
                                options={[
                                    { value: 'javascript', label: 'JavaScript' },
                                    { value: 'python', label: 'Python' },
                                    { value: 'java', label: 'Java' },
                                    { value: 'cpp', label: 'C++' },
                                    { value: 'go', label: 'Go' },
                                ]}
                                className="h-12 bg-console-bg/50 border-white/5"
                            />
                        </div>

                        {/* Proctoring Settings */}
                        <div className="space-y-6 pt-6 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                                        <Shield size={14} className="text-accent-primary" /> Strict Mode
                                    </label>
                                    <p className="text-[10px] text-text-muted font-medium">Activate systemic integrity checks</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setStrictMode(!strictMode);
                                        if (!strictMode) setEnforceFullscreen(true);
                                    }}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-all",
                                        strictMode ? 'bg-accent-primary shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.3)]' : 'bg-console-surface-3'
                                    )}
                                >
                                    <span className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        strictMode ? 'translate-x-6' : 'translate-x-1'
                                    )} />
                                </button>
                            </div>

                            {strictMode && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center justify-between pl-4 border-l-2 border-accent-primary/20 py-1"
                                >
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Lock Fullscreen</label>
                                        <p className="text-[9px] text-text-muted opacity-60 italic">Mandatory focus protocol</p>
                                    </div>
                                    <button
                                        onClick={() => setEnforceFullscreen(!enforceFullscreen)}
                                        className={cn(
                                            "relative inline-flex h-5 w-9 items-center rounded-full transition-all",
                                            enforceFullscreen ? 'bg-accent-primary/80' : 'bg-console-surface-3'
                                        )}
                                    >
                                        <span className={cn(
                                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                            enforceFullscreen ? 'translate-x-5' : 'translate-x-1'
                                        )} />
                                    </button>
                                </motion.div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                                        <Camera size={14} className="text-accent-primary" /> Camera Monitor
                                    </label>
                                    <p className="text-[10px] text-text-muted font-medium">Capture real-time video proctoring</p>
                                </div>
                                <button
                                    onClick={handleCameraToggle}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-all",
                                        hasCameraAccess ? 'bg-accent-primary shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.3)]' : 'bg-console-surface-3'
                                    )}
                                >
                                    <span className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        hasCameraAccess ? 'translate-x-6' : 'translate-x-1'
                                    )} />
                                </button>
                            </div>

                            {/* Camera Permission Status */}
                            {hasCameraAccess && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="pl-4 border-l-2 border-accent-primary/20"
                                >
                                    {cameraPermission === 'checking' && (
                                        <div className="flex items-center gap-2 text-text-muted">
                                            <div className="w-3 h-3 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Requesting access...</span>
                                        </div>
                                    )}
                                    {cameraPermission === 'granted' && (
                                        <div className="flex items-center gap-2 text-status-ok">
                                            <div className="w-2 h-2 bg-status-ok rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Camera & Mic Ready</span>
                                        </div>
                                    )}
                                    {cameraPermission === 'denied' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-status-error">
                                                <AlertCircle size={12} />
                                                <span className="text-[10px] font-black uppercase tracking-wider">Permission Denied</span>
                                            </div>
                                            <p className="text-[9px] text-text-muted font-medium leading-relaxed">
                                                Click the camera/lock icon in your browser's address bar to allow access, then retry.
                                            </p>
                                            <button
                                                onClick={requestCameraPermission}
                                                className="text-[9px] font-black text-accent-primary uppercase tracking-wider hover:underline"
                                            >
                                                Retry Permission
                                            </button>
                                        </div>
                                    )}
                                    {cameraPermission === 'pending' && (
                                        <div className="flex items-center gap-2 text-text-muted/60">
                                            <span className="text-[9px] font-bold uppercase tracking-wider italic">Permission will be requested on toggle</span>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Question Builder */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="interview-card p-10 bg-console-surface/30 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] -rotate-12 transition-transform duration-1000 group-hover:rotate-0 group-hover:scale-110">
                            <Sparkles size={160} />
                        </div>

                        <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-text-primary tracking-tight flex items-center gap-3 italic">
                                    <Activity size={24} className="text-accent-primary" />
                                    Sequence Architecture
                                </h2>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Module Count: {sections.length}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <AnimatePresence mode="popLayout">
                                {sections.map((section, idx) => (
                                    <motion.div
                                        key={section.id}
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                        className="relative p-8 bg-console-bg/40 rounded-[2rem] border border-white/5 hover:border-accent-primary/20 transition-all duration-500 group/section"
                                    >
                                        <div className="flex items-start justify-between gap-6 mb-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary font-black text-lg shadow-inner">
                                                    {idx + 1}
                                                </div>
                                                <div className="space-y-1">
                                                    <Input
                                                        value={section.name}
                                                        onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                                                        className="h-auto p-0 bg-transparent border-none text-xl font-black text-text-primary focus:ring-0 placeholder:text-text-muted/50"
                                                        placeholder="Phase Name"
                                                    />
                                                </div>
                                            </div>

                                            {sections.length > 1 && (
                                                <button
                                                    onClick={() => removeSection(section.id)}
                                                    className="p-3 text-text-muted hover:text-status-error hover:bg-status-error/10 rounded-xl transition-all opacity-0 group-hover/section:opacity-100"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Section Type */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Modal Type</label>
                                                <Select
                                                    value={section.type}
                                                    onChange={(v) => handleSectionTypeChange(section.id, v as SectionType)}
                                                    options={SECTION_TYPE_OPTIONS}
                                                    className="h-14 bg-console-bg border-white/5 rounded-2xl"
                                                />
                                            </div>

                                            {/* Difficulty */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Intensity Level</label>
                                                <div className="flex p-1.5 bg-console-bg rounded-2xl border border-white/5 h-14">
                                                    {['easy', 'medium', 'hard'].map(diff => (
                                                        <button
                                                            key={diff}
                                                            onClick={() => updateSection(section.id, 'difficulty', diff)}
                                                            className={cn(
                                                                "flex-1 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                                                                section.difficulty === diff 
                                                                    ? 'bg-console-surface-3 text-text-primary shadow-sm' 
                                                                    : 'text-text-muted hover:text-text-secondary'
                                                            )}
                                                        >
                                                            {diff}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Topics */}
                                            <div className="md:col-span-2 space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1 flex justify-between items-center">
                                                    Spectral Coverage
                                                    <span className="text-accent-primary font-bold">{section.topics?.length || 0} Topics</span>
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(TOPICS_BY_SECTION_TYPE[section.type] || []).map(topic => (
                                                        <button
                                                            key={topic}
                                                            onClick={() => {
                                                                const currentTopics = section.topics || [];
                                                                const newTopics = currentTopics.includes(topic)
                                                                    ? currentTopics.filter(t => t !== topic)
                                                                    : [...currentTopics, topic];
                                                                updateSection(
                                                                    section.id,
                                                                    'topics',
                                                                    newTopics.length ? newTopics : getDefaultTopicsForType(section.type)
                                                                );
                                                            }}
                                                            className={cn(
                                                                "px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all border",
                                                                section.topics?.includes(topic)
                                                                    ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.1)]'
                                                                    : 'bg-console-bg border-white/5 text-text-muted hover:border-white/20'
                                                            )}
                                                        >
                                                            {topic}
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
                            onClick={addSection}
                            className="mt-8 w-full h-16 rounded-[1.5rem] border-2 border-dashed border-white/5 bg-white/[0.02] flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-text-muted hover:bg-white/[0.04] hover:border-white/10 hover:text-text-primary transition-all duration-300"
                        >
                            <Plus size={20} className="text-accent-primary" /> 
                            Execute New Phase
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-gradient-to-t from-console-bg via-console-bg/90 to-transparent pointer-events-none">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 pointer-events-auto">
                    <div className="flex items-center gap-4 p-4 bg-console-surface/80 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-2xl max-w-xl">
                        <AlertCircle size={20} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider leading-relaxed">
                            AI protocols will synthesize tailored evaluation matrices. System security records are active. Bypassing integrity safeguards triggers immediate termination.
                        </p>
                    </div>
                    
                    <Button
                        onClick={handleStart}
                        isLoading={isLoading}
                        size="lg"
                        className="w-full md:w-auto px-12 h-16 rounded-2xl font-black text-lg tracking-tight bg-gradient-to-r from-accent-primary to-accent-dark shadow-xl shadow-accent-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                    >
                        Initialize Simulation <Play size={18} fill="currentColor" className="ml-2" />
                    </Button>
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
