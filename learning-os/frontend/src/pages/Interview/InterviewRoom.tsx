import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Clock, CheckCircle, XCircle, Play, ChevronRight, ChevronLeft, Save, Maximize, Minimize, Terminal, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession } from '../../services/api';

import { useAI } from '../../contexts/AIContext';

export function InterviewRoom() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setContext } = useAI(); // Global AI Context
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<'description' | 'testCases'>('description');
    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [consoleTab, setConsoleTab] = useState<'output' | 'result'>('output');

    const [output, setOutput] = useState<{
        status: string;
        feedback?: string;
        output?: string;
        score?: number;
        testResults?: any[];
    } | null>(null);

    // Fetch Session
    useEffect(() => {
        const loadSession = async () => {
            try {
                if (!id) return;
                const data = await api.getInterviewSession(id);
                setSession(data);

                // Initialize timer if running
                if (data.status === 'in-progress') {
                    const elapsed = (Date.now() - new Date(data.startedAt).getTime()) / 1000;
                    const remaining = (data.config.duration * 60) - elapsed;
                    setTimeLeft(remaining > 0 ? remaining : 0);
                }

                setCode(data.questions[0]?.userCode || '// Write your solution here\n');
            } catch (err) {
                console.error('Load session error:', err);
                alert('Failed to load session. Please check console.');
            }
        };
        loadSession();
    }, [id]);

    // Timer Tick
    useEffect(() => {
        if (!session || session.status !== 'in-progress' || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, session]);

    // Update code when question changes
    useEffect(() => {
        if (session && session.questions[currentQuestionIdx]) {
            const q = session.questions[currentQuestionIdx];
            let savedDraft = '';
            try {
                savedDraft = localStorage.getItem(`interview_draft_${session._id}_${currentQuestionIdx}`) || '';
            } catch (e) { console.warn('LocalStorage access denied'); }
            const boilerplate = q.description.match(new RegExp(`\`\`\`${session.config.language || 'javascript'}\n([\\s\\S]*?)\n\`\`\``))?.[1] || '// Write your solution here\n';
            const initialCode = savedDraft || q.userCode || boilerplate;
            setCode(initialCode);

            // Restore previous result if exists
            if (q.status !== 'pending') {
                setOutput({ status: q.status === 'solved' ? 'pass' : 'fail', feedback: q.feedback || '', score: q.score || 0 });
                setConsoleOpen(true);
            } else {
                setOutput(null);
                setConsoleOpen(false);
            }

            // Sync with Global AI
            setContext({
                problemName: q.problemName,
                difficulty: q.difficulty,
                description: q.description,
                userCode: initialCode,
                language: session.config.language
            });
        }
    }, [currentQuestionIdx, session?.questions]);

    const handleCodeChange = (newCode: string | undefined) => {
        const val = newCode || '';
        setCode(val);
        if (session) {
            const newQuestions = [...session.questions];
            newQuestions[currentQuestionIdx] = { ...newQuestions[currentQuestionIdx], userCode: val };
            setSession({ ...session, questions: newQuestions });
            try {
                localStorage.setItem(`interview_draft_${session._id}_${currentQuestionIdx}`, val);
            } catch (e) { console.warn('LocalStorage access denied', e); }

            // Sync with Global AI
            setContext((prev: any) => ({ ...prev, userCode: val }));
        }
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRun = async () => {
        setIsSubmitting(true);
        setConsoleOpen(true);
        setConsoleTab('output');
        setOutput({ status: 'running', output: 'Compiling and executing...' });

        try {
            if (!session) return;
            const res = await api.runInterviewCode(session._id, currentQuestionIdx, code);
            setOutput(res as any);
        } catch (error) {
            setOutput({ status: 'fail', feedback: 'Execution Error', score: 0 } as any);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setConsoleOpen(true);
        setConsoleTab('result');
        setOutput({ status: 'running', output: 'Evaluating against hidden test cases...' });

        try {
            if (!session) return;
            const res = await api.submitInterviewCode(session._id, currentQuestionIdx, code);
            setOutput(res);
            const updated = await api.getInterviewSession(session._id);
            setSession(updated);
        } catch (error) {
            setOutput({ status: 'fail', feedback: 'Submission Failed', score: 0 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session) return <div className="h-screen flex items-center justify-center text-gray-500">Loading Environment...</div>;

    const question = session.questions[currentQuestionIdx];

    return (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-300 font-sans overflow-hidden">
            {/* Header */}
            <div className="h-14 bg-white dark:bg-[#1c2128] border-b border-gray-200 dark:border-white/10 px-4 flex items-center justify-between shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Terminal size={18} className="text-blue-500" />
                        CodeRival <span className="text-xs font-normal text-gray-500 px-2 border-l border-gray-600">Enterprise Edition</span>
                    </span>
                    <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-2" />
                    <div className="flex items-center gap-2 text-sm font-mono">
                        <Clock size={14} className={timeLeft < 300 ? 'text-red-500' : 'text-gray-400'} />
                        <span className={timeLeft < 300 ? 'text-red-500 font-bold' : ''}>{formatTime(timeLeft)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleFullScreen} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors" title="Toggle Full Screen">
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isSubmitting}
                        className="px-4 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-md flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                    >
                        <Play size={14} /> Run
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md flex items-center gap-2 text-xs font-bold uppercase tracking-wide shadow-md transition-all disabled:opacity-50"
                    >
                        <CheckCircle size={14} /> Submit
                    </button>
                </div>
            </div>

            {/* Main Split Pane */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Problem Description */}
                <div className="w-5/12 border-r border-gray-200 dark:border-white/10 flex flex-col bg-white dark:bg-[#0d1117]">
                    <div className="flex border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1c2128]">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'description' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                        >
                            Description
                        </button>
                        <button
                            onClick={() => setActiveTab('testCases')}
                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'testCases' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                        >
                            Test Cases
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#0d1117]">
                        <div className="mb-4">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{currentQuestionIdx + 1}. {question.problemName}</h1>
                            <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${question.difficulty === 'hard'
                                ? 'text-red-600 border-red-200 bg-red-50'
                                : question.difficulty === 'medium'
                                    ? 'text-yellow-600 border-yellow-200 bg-yellow-50'
                                    : 'text-green-600 border-green-200 bg-green-50'
                                }`}>
                                {question.difficulty}
                            </span>
                        </div>

                        {activeTab === 'description' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown>{question.description}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {question.testCases?.map((tc, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-[#1c2128] rounded-lg p-3 border border-gray-200 dark:border-white/10">
                                        <div className="text-xs font-mono mb-1 text-gray-500">Input:</div>
                                        <div className="text-sm font-mono bg-white dark:bg-black/20 p-2 rounded mb-2">{tc.input}</div>
                                        <div className="text-xs font-mono mb-1 text-gray-500">Expected:</div>
                                        <div className="text-sm font-mono bg-white dark:bg-black/20 p-2 rounded">{tc.expectedOutput}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="p-2 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1c2128] flex justify-between items-center">
                        <button
                            disabled={currentQuestionIdx === 0}
                            onClick={() => setCurrentQuestionIdx(i => i - 1)}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-mono text-gray-500">Problem {currentQuestionIdx + 1}/{session.questions.length}</span>
                        <button
                            disabled={currentQuestionIdx === session.questions.length - 1}
                            onClick={() => setCurrentQuestionIdx(i => i + 1)}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* RIGHT: Editor & Console */}
                <div className="w-7/12 flex flex-col bg-[#1e1e1e]">
                    <div className="flex-1 relative">
                        <Editor
                            height="100%"
                            defaultLanguage={session.config.language || "javascript"}
                            language={session.config.language || "javascript"}
                            theme="vs-dark"
                            value={code}
                            onChange={handleCodeChange}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                fontFamily: "'JetBrains Mono', monospace",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 16 }
                            }}
                        />
                    </div>

                    {/* Console Panel */}
                    <div className={`transition-all duration-300 ease-in-out bg-[#1c2128] border-t border-white/10 flex flex-col ${consoleOpen ? 'h-[40%]' : 'h-10'}`}>
                        <div
                            className="flex items-center justify-between px-4 h-10 cursor-pointer bg-[#2d333b] hover:bg-[#373e47] shrink-0"
                            onClick={() => setConsoleOpen(!consoleOpen)}
                        >
                            <div className="flex items-center gap-2 text-sm text-gray-300 font-semibold select-none">
                                <span className="transform transition-transform duration-200" style={{ rotate: consoleOpen ? '180deg' : '0deg' }}>
                                    <ChevronRight size={16} className="-rotate-90" />
                                </span>
                                Console
                            </div>
                            {output && (
                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${output.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                    output.status === 'pass' || output.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                    {output.status === 'running' ? 'Executing...' : output.status === 'pass' ? 'Accepted' : 'Wrong Answer'}
                                </span>
                            )}
                        </div>

                        {consoleOpen && (
                            <div className="flex-1 flex overflow-hidden font-mono text-sm">
                                <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar">
                                    {output ? (
                                        <div className="space-y-4">
                                            {output.status === 'running' ? (
                                                <div className="flex items-center gap-2 text-gray-400 animate-pulse">
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                                                    Running Code...
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`p-4 rounded-lg border ${output.status === 'pass' || output.status === 'success'
                                                        ? 'bg-green-500/10 border-green-500/30 text-green-300'
                                                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                                                        }`}>
                                                        <div className="font-bold text-lg mb-2">
                                                            {output.status === 'pass' || output.status === 'success' ? 'Accepted' : 'Wrong Answer'}
                                                        </div>
                                                        {output.score !== undefined && (
                                                            <div className="text-xs uppercase tracking-wide opacity-80 mb-2">Score: {output.score}/100</div>
                                                        )}
                                                        <div className="whitespace-pre-wrap font-mono text-sm opacity-90 leading-relaxed">
                                                            {output.feedback || output.output}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                                            <Terminal size={32} strokeWidth={1.5} />
                                            <p>Run your code to see output here</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
