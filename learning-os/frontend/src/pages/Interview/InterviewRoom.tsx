import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Clock, CheckCircle, XCircle, Play, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession } from '../../services/api';

export function InterviewRoom() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [output, setOutput] = useState<{
        status: string;
        feedback?: string;
        output?: string;
        score?: number
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

                // Load saved code if any
                setCode(data.questions[0]?.userCode || '// Write your solution here\n');
            } catch (err) {
                console.error('Load session error:', err);
                // navigate('/interview'); // Optional: redirect on error
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
                    // Optionally auto-submit
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
            // If userCode is empty/null, use the boilerplate from description or default
            // Priority: LocalDraft > DB UserCode > Boilerplate
            const savedDraft = localStorage.getItem(`interview_draft_${session._id}_${currentQuestionIdx}`);
            const boilerplate = q.description.match(new RegExp(`\`\`\`${session.config.language || 'javascript'}\n([\\s\\S]*?)\n\`\`\``))?.[1] || '// Write your solution here\n';

            const initialCode = savedDraft || q.userCode || boilerplate;
            setCode(initialCode);
            setOutput(q.status !== 'pending' ? { status: q.status === 'solved' ? 'pass' : 'fail', feedback: q.feedback || '', score: q.score || 0 } : null);
        }
    }, [currentQuestionIdx, session?.questions]); // Dependency on session.questions structure effectively

    const handleCodeChange = (newCode: string | undefined) => {
        const val = newCode || '';
        setCode(val);
        // Update local session state to preserve draft when switching questions
        if (session) {
            const newQuestions = [...session.questions];
            newQuestions[currentQuestionIdx] = { ...newQuestions[currentQuestionIdx], userCode: val };
            setSession({ ...session, questions: newQuestions });

            // Save draft to localStorage to survive refreshes
            localStorage.setItem(`interview_draft_${session._id}_${currentQuestionIdx}`, val);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRun = async () => {
        setIsSubmitting(true);
        setOutput(null);
        try {
            if (!session) return;
            // Dry Run: Check output against test cases, no grading
            const res = await api.runInterviewCode(session._id, currentQuestionIdx, code);
            // Polymorphic output state: for Run it has { output, status }, for Submit it has { feedback, score, status }
            // We need to adapt the type or cast slightly. Assuming output state can handle both.
            // Let's update the State type in next step or use flexible type here.
            setOutput(res as any);
        } catch (error) {
            console.error('Run code error', error);
            setOutput({ status: 'fail', feedback: 'Execution Error', score: 0 } as any);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setOutput(null);
        try {
            if (!session) return;
            // Submit: Full Grading
            const res = await api.submitInterviewCode(session._id, currentQuestionIdx, code);
            setOutput(res);

            // Refresh session to sync status
            const updated = await api.getInterviewSession(session._id);
            setSession(updated);
        } catch (error) {
            console.error('Submit code error', error);
            setOutput({ status: 'fail', feedback: 'Submission Failed', score: 0 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinish = async () => {
        if (confirm('Are you sure you want to end the interview?')) {
            try {
                if (!session) return;
                await api.endInterview(session._id);
                navigate('/interview');
            } catch (e) { console.error(e); }
        }
    };

    if (!session) return <div className="p-10 text-center text-gray-500">Loading Session...</div>;

    const question = session.questions[currentQuestionIdx];

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-300 font-sans transition-colors duration-200">
            {/* Header / Action Bar */}
            <div className="h-14 bg-white dark:bg-[#1c2128] border-b border-gray-200 dark:border-white/10 px-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-gray-100 dark:bg-black/20 p-1.5 rounded text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
                            <Clock size={16} />
                        </div>
                        <span className={`font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRun}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
                    >
                        <Play size={14} className={isSubmitting ? "animate-pulse" : ""} /> Run
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 text-xs font-semibold uppercase tracking-wide shadow-md shadow-green-900/20 transition-all disabled:opacity-50"
                    >
                        <CheckCircle size={14} /> Submit
                    </button>
                </div>
            </div>

            {/* Split Pane Container */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Description & Tabs */}
                <div className="w-5/12 border-r border-gray-200 dark:border-white/10 flex flex-col bg-white dark:bg-[#0d1117]">
                    {/* Tabs Header */}
                    <div className="flex border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1c2128]/50">
                        <button className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-white dark:bg-[#0d1117]">
                            Description
                        </button>
                        <button className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent transition-colors">
                            Test Cases
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-[#0d1117]">
                        <div className="flex justify-between items-start mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{question.problemName}</h1>
                            <span className={`text-[10px] px-2.5 py-1 rounded-full border uppercase font-bold tracking-wider ${question.difficulty === 'hard'
                                    ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-400/30 bg-red-50 dark:bg-red-400/10'
                                    : question.difficulty === 'medium'
                                        ? 'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-400/30 bg-yellow-50 dark:bg-yellow-400/10'
                                        : 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-400/30 bg-green-50 dark:bg-green-400/10'
                                }`}>
                                {question.difficulty}
                            </span>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-blue-50 dark:prose-code:bg-blue-500/10 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-100 dark:prose-pre:bg-[#1c2128] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/10">
                            <ReactMarkdown>{question.description}</ReactMarkdown>
                        </div>
                    </div>

                    {/* Navigation Footer */}
                    <div className="p-3 border-t border-gray-200 dark:border-white/10 flex justify-between bg-gray-50 dark:bg-[#1c2128]">
                        <button
                            disabled={currentQuestionIdx === 0}
                            onClick={() => setCurrentQuestionIdx(i => i - 1)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-xs font-medium text-gray-500 py-2">
                            Problem {currentQuestionIdx + 1} of {session.questions.length}
                        </span>
                        <button
                            disabled={currentQuestionIdx === session.questions.length - 1}
                            onClick={() => setCurrentQuestionIdx(i => i + 1)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL: Editor & Console */}
                <div className="w-7/12 flex flex-col bg-white dark:bg-[#0d1117]">
                    {/* Editor */}
                    <div className="flex-1 relative border-b border-gray-200 dark:border-white/10">
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
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                lineNumbers: 'on',
                                renderLineHighlight: 'line',
                                padding: { top: 16 }
                            }}
                        />
                    </div>

                    {/* Console / Output Panel */}
                    <div className="h-[200px] flex flex-col bg-gray-50 dark:bg-[#0d1117]">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#1c2128] border-b border-gray-200 dark:border-white/10">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-400"></span> Console
                            </span>
                            {output && (
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${output.status === 'pass' || output.status === 'success'
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                        : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                    }`}>
                                    {output.status === 'success' ? 'Ready' : output.status}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-white dark:bg-[#0d1117]">
                            {output ? (
                                <div className="space-y-3">
                                    <div className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{output.feedback || output.output}</div>
                                    {output.score !== undefined && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-white/10 text-right">
                                            <span className="text-xs text-gray-500 uppercase tracking-wide mr-2">Score</span>
                                            <span className={`text-lg font-bold ${output.score >= 70 ? 'text-green-500' : 'text-red-500'}`}>
                                                {output.score}/100
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                    <div className="p-3 border border-dashed border-gray-300 dark:border-white/20 rounded-xl bg-gray-50 dark:bg-white/5">
                                        <Play size={20} className="text-gray-400" fill="currentColor" />
                                    </div>
                                    <p className="text-xs font-medium uppercase tracking-wide">Run code to see output</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
