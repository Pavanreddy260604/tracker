import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, CheckCircle, Play, ChevronRight, ChevronLeft, Maximize, Minimize, Terminal } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession, InterviewTestResult } from '../../services/api';

import { useAI } from '../../contexts/AIContext';
import { useDialog } from '../../hooks/useDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';

export function InterviewRoom() {
    const { id } = useParams();
    const { setContext } = useAI(); // Global AI Context
    const { dialog, showAlert, closeDialog } = useDialog();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<'description' | 'testCases'>('description');
    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [consoleOpen, setConsoleOpen] = useState(true);
    const [consoleTab, setConsoleTab] = useState<'testcase' | 'result'>('testcase');
    const [selectedCase, setSelectedCase] = useState<number | 'custom'>(0);
    const [customInput, setCustomInput] = useState('');
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
    const CONSOLE_HEIGHT = 260;

    type OutputState = {
        status: 'running' | 'success' | 'fail' | 'error' | 'pass';
        feedback?: string;
        output?: string;
        score?: number;
        summary?: { passed: number; total: number };
        testResults?: InterviewTestResult[];
    };

    const [output, setOutput] = useState<OutputState | null>(null);

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
                showAlert('Error', 'Failed to load session. Please check console.');
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

    // Keep Monaco theme in sync with light/dark mode
    useEffect(() => {
        const updateTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setEditorTheme(isDark ? 'vs-dark' : 'vs');
        };
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

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

            // Reset testcase UI
            setSelectedCase(q.testCases && q.testCases.length > 0 ? 0 : 'custom');
            setCustomInput('');
            setActiveResultIndex(0);

            // Restore previous result if exists
            if (q.status !== 'pending') {
                setOutput({
                    status: q.status === 'solved' ? 'pass' : 'fail',
                    feedback: q.feedback || '',
                    score: q.score || 0
                });
                setConsoleTab('testcase');
            } else {
                setOutput(null);
                setConsoleTab('testcase');
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

    useEffect(() => {
        if (session) {
            setConsoleOpen(true);
        }
    }, [session?._id]);

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
        setConsoleTab('result');
        setOutput({ status: 'running', output: 'Compiling and executing...' });

        try {
            if (!session) return;
            if (selectedCase === 'custom' && customInput.trim().length === 0) {
                setOutput({ status: 'error', feedback: 'Please enter custom input to run.' });
                return;
            }
            const res = await api.runInterviewCode(
                session._id,
                currentQuestionIdx,
                code,
                selectedCase === 'custom' ? customInput : undefined
            );
            setOutput({ status: res.status, summary: res.summary, testResults: res.testResults });
            setActiveResultIndex(0);
        } catch (error) {
            setOutput({ status: 'error', feedback: 'Execution Error', score: 0 });
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
            setOutput({
                status: res.status,
                feedback: res.feedback,
                score: res.score,
                summary: res.summary,
                testResults: res.testResults
            });
            setActiveResultIndex(0);
            const updated = await api.getInterviewSession(session._id);
            setSession(updated);
        } catch (error) {
            setOutput({ status: 'fail', feedback: 'Submission Failed', score: 0 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session) return <div className="interview-shell interview-empty">Loading Environment...</div>;

    const question = session.questions[currentQuestionIdx];
    const publicCases = question.testCases || [];
    const selectedPublicCase = typeof selectedCase === 'number' ? publicCases[selectedCase] : null;
    const resultCases = output?.testResults || [];
    const activeResult = resultCases[activeResultIndex];
    const hasRuntimeError = resultCases.some((res) => Boolean(res.error));
    const displayStatus = output?.status === 'running'
        ? 'running'
        : hasRuntimeError
            ? 'error'
            : output?.status;

    const renderConsoleContent = () => (
        <div className="flex-1 flex overflow-hidden text-sm">
            <div className="interview-console-body">
                {consoleTab === 'testcase' ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {publicCases.map((_, idx) => (
                                <button
                                    key={`case-${idx}`}
                                    type="button"
                                    onClick={() => setSelectedCase(idx)}
                                    className={`interview-case ${selectedCase === idx ? 'is-active' : ''}`}
                                >
                                    Case {idx + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSelectedCase('custom')}
                                className={`interview-case ${selectedCase === 'custom' ? 'is-active' : ''}`}
                            >
                                Custom
                            </button>
                        </div>

                        <div className="sw-muted text-xs">
                            Input format: one JSON value per line (each line is one argument).
                        </div>

                        {selectedCase === 'custom' ? (
                            <div className="space-y-3">
                                <div className="sw-label">Custom Input</div>
                                <textarea
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    placeholder={'Example:\n[2,7,11,15]\n9'}
                                    className="sw-textarea sw-textarea-compact sw-code-textarea"
                                />
                                <div className="sw-muted text-xs">
                                    Run will execute only the custom input when selected.
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                <div>
                                    <div className="sw-label">Input</div>
                                    <pre className="sw-code-block">{selectedPublicCase?.input || 'No input available.'}</pre>
                                </div>
                                <div>
                                    <div className="sw-label">Expected Output</div>
                                    <pre className="sw-code-block">{selectedPublicCase?.expectedOutput || 'No expected output.'}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!output ? (
                            <div className="h-full flex flex-col items-center justify-center sw-muted gap-2">
                                <Terminal size={32} strokeWidth={1.5} />
                                <p>Run your code to see output here</p>
                            </div>
                        ) : displayStatus === 'running' ? (
                            <div className="flex items-center gap-2 sw-muted animate-pulse">
                                <span className="w-2 h-2 bg-[color:var(--sw-accent)] rounded-full animate-bounce" />
                                Running Code...
                            </div>
                        ) : (
                            <>
                                <div className={`interview-result ${displayStatus === 'pass' || displayStatus === 'success'
                                    ? 'is-success'
                                    : displayStatus === 'error' ? 'is-warning' : 'is-danger'
                                    }`}>
                                    <div className="font-bold text-lg mb-2">
                                        {displayStatus === 'pass' || displayStatus === 'success'
                                            ? 'Accepted'
                                            : displayStatus === 'error'
                                                ? 'Runtime Error'
                                                : 'Wrong Answer'}
                                    </div>
                                    {output.summary && (
                                        <div className="text-xs uppercase tracking-wide opacity-80 mb-2">
                                            Passed {output.summary.passed}/{output.summary.total} test cases
                                        </div>
                                    )}
                                    {output.score !== undefined && (
                                        <div className="text-xs uppercase tracking-wide opacity-80 mb-2">Score: {output.score}/100</div>
                                    )}
                                    {output.feedback && (
                                        <div className="whitespace-pre-wrap text-xs opacity-90 leading-relaxed">{output.feedback}</div>
                                    )}
                                </div>

                                {resultCases.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {resultCases.map((res, idx) => {
                                                const displayIndex = (res.index ?? idx) + 1;
                                                const label = res.isCustom ? 'Custom' : res.isHidden ? `Hidden ${displayIndex}` : `Case ${displayIndex}`;
                                                const statusColor = res.error
                                                    ? 'is-warning'
                                                    : res.passed === false
                                                        ? 'is-danger'
                                                        : 'is-success';
                                                return (
                                                    <button
                                                        key={`result-${idx}`}
                                                        type="button"
                                                        onClick={() => setActiveResultIndex(idx)}
                                                        className={`interview-case ${statusColor} ${activeResultIndex === idx ? 'is-active' : ''}`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {activeResult && (
                                            <div className="grid gap-3">
                                                <div>
                                                    <div className="sw-label">Input</div>
                                                    <pre className="sw-code-block">
                                                        {activeResult.input ?? (activeResult.isHidden ? 'Hidden test case' : '-')}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <div className="sw-label">Expected Output</div>
                                                    <pre className="sw-code-block">
                                                        {activeResult.expected ?? (activeResult.isHidden ? 'Hidden test case' : '-')}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <div className="sw-label">Your Output</div>
                                                    <pre className="sw-code-block">
                                                        {activeResult.error
                                                            ? `Runtime Error: ${activeResult.error}`
                                                            : activeResult.actual ?? (activeResult.isHidden ? 'Hidden test case' : '-')}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="interview-shell">
            <div className="interview-topbar">
                <div className="flex items-center gap-4">
                    <span className="interview-brand">
                        <Terminal size={18} />
                        CodeRival <span className="interview-brand-sub">Enterprise Edition</span>
                    </span>
                    <div className="interview-divider" />
                    <div className="interview-timer-row">
                        <Clock size={14} className={timeLeft < 300 ? 'interview-timer is-danger' : 'interview-timer'} />
                        <span className={timeLeft < 300 ? 'interview-timer is-danger' : 'interview-timer'}>{formatTime(timeLeft)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleFullScreen} className="sw-icon-button" title="Toggle Full Screen">
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isSubmitting}
                        className="sw-btn sw-btn-secondary"
                    >
                        <Play size={14} /> Run
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="sw-btn sw-btn-success"
                    >
                        <CheckCircle size={14} /> Submit
                    </button>
                </div>
            </div>

            {/* Main Split Pane */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                <div className="interview-pane w-5/12 flex flex-col min-h-0">
                    <div className="interview-pane-tabs">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`interview-tab ${activeTab === 'description' ? 'is-active' : ''}`}
                        >
                            Description
                        </button>
                        <button
                            onClick={() => setActiveTab('testCases')}
                            className={`interview-tab ${activeTab === 'testCases' ? 'is-active' : ''}`}
                        >
                            Test Cases
                        </button>
                    </div>

                    <div className="interview-pane-body">
                        <div className="mb-4">
                            <h1 className="sw-section-title">{currentQuestionIdx + 1}. {question.problemName}</h1>
                            <span className={`sw-badge ${question.difficulty === 'hard'
                                ? 'is-danger'
                                : question.difficulty === 'medium'
                                    ? 'is-warning'
                                    : 'is-success'
                                }`}>
                                {question.difficulty}
                            </span>
                        </div>

                        {activeTab === 'description' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.description}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {question.testCases?.map((tc, idx) => (
                                    <div key={idx} className="sw-card sw-card-muted p-3">
                                        <div className="sw-mono-label">Input</div>
                                        <div className="sw-code-block">{tc.input}</div>
                                        <div className="sw-mono-label mt-3">Expected</div>
                                        <div className="sw-code-block">{tc.expectedOutput}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="interview-pane-footer">
                        <button
                            disabled={currentQuestionIdx === 0}
                            onClick={() => setCurrentQuestionIdx(i => i - 1)}
                            className="sw-icon-button sw-icon-button-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="sw-muted text-xs font-mono">Problem {currentQuestionIdx + 1}/{session.questions.length}</span>
                        <button
                            disabled={currentQuestionIdx === session.questions.length - 1}
                            onClick={() => setCurrentQuestionIdx(i => i + 1)}
                            className="sw-icon-button sw-icon-button-sm"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="interview-editor-pane w-7/12 flex flex-col min-h-0 min-w-0">
                    <div className="flex-1 relative min-h-0">
                        <Editor
                            height="100%"
                            defaultLanguage={session.config.language || "javascript"}
                            language={session.config.language || "javascript"}
                            theme={editorTheme}
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

                    <div
                        className={`interview-console ${consoleOpen ? 'is-open' : 'is-collapsed'} transition-[height] duration-200 ease-out`}
                        style={{
                            height: consoleOpen ? CONSOLE_HEIGHT : 48,
                            minHeight: 48,
                            flexShrink: 0
                        }}
                    >
                        <div
                            className="interview-console-header"
                            onClick={() => {
                                if (!consoleOpen) setConsoleOpen(true);
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setConsoleOpen((prev) => !prev);
                                    }}
                                    className="interview-console-toggle"
                                    aria-expanded={consoleOpen}
                                >
                                    <span className="transform transition-transform duration-200" style={{ rotate: consoleOpen ? '180deg' : '0deg' }}>
                                        <ChevronRight size={16} className="-rotate-90" />
                                    </span>
                                    Console
                                </button>
                                <div className="interview-console-tabs">
                                    <button
                                        type="button"
                                        onClick={() => setConsoleTab('testcase')}
                                        className={`interview-console-tab ${consoleTab === 'testcase' ? 'is-active' : ''}`}
                                    >
                                        Testcase
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConsoleTab('result')}
                                        className={`interview-console-tab ${consoleTab === 'result' ? 'is-active' : ''}`}
                                    >
                                        Result
                                    </button>
                                </div>
                            </div>
                            {output && (
                                <span className={`sw-badge ${displayStatus === 'running' ? 'is-info' :
                                    displayStatus === 'pass' || displayStatus === 'success' ? 'is-success' :
                                        displayStatus === 'error' ? 'is-warning' : 'is-danger'
                                    }`}>
                                    {displayStatus === 'running'
                                        ? 'Executing...'
                                        : displayStatus === 'pass' || displayStatus === 'success'
                                            ? 'Accepted'
                                            : displayStatus === 'error'
                                                ? 'Runtime Error'
                                                : 'Wrong Answer'}
                                </span>
                            )}
                        </div>

                        {consoleOpen && renderConsoleContent()}
                    </div>
                </div>
            </div>

            <AlertDialog
                isOpen={dialog.isOpen && dialog.type === 'alert'}
                onClose={closeDialog}
                title={dialog.title}
                description={dialog.description}
            />
        </div>
    );
}
