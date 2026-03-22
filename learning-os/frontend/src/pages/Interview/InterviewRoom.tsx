import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, CheckCircle, Play, ChevronRight, ChevronLeft, Terminal, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import type { InterviewSession, InterviewTestResult } from '../../services/api';

import { useDialog } from '../../hooks/useDialog';
import { safeStorage } from '../../lib/safeStorage';
import { useSecureProctoring } from '../../hooks/useSecureProctoring';
import type { SecureViolation } from '../../hooks/useSecureProctoring';
import { useInterviewContentProtection } from '../../hooks/useInterviewContentProtection';
import { FullscreenLockdown } from '../../components/FullscreenLockdown';

export function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useDialog();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'console'>('description');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [consoleTab, setConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [selectedCase, setSelectedCase] = useState<number | 'custom'>(0);
  const [customInput, setCustomInput] = useState('');
  const [output, setOutput] = useState<{
    status: 'running' | 'success' | 'fail' | 'error' | 'pass';
    feedback?: string;
    score?: number;
    summary?: { passed: number; total: number };
    testResults?: InterviewTestResult[];
  } | null>(null);
  const [testTerminated, setTestTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [contentProtectionNotice, setContentProtectionNotice] = useState<string | null>(null);
  const autoSubmitInFlightRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const proctoringSyncDisabledRef = useRef(false);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    // Ensure editor remains interactive while explicitly blocking paste.
    editor.updateOptions({ readOnly: false });
    editor.focus();

    const domNode = editor.getDomNode() as HTMLElement | null;
    if (!domNode) return;

    const preventPaste = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const preventPasteShortcut = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase();
      const isPasteShortcut = (event.ctrlKey || event.metaKey) && key === 'v';
      const isShiftInsert = event.shiftKey && key === 'insert';
      if (isPasteShortcut || isShiftInsert) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    domNode.addEventListener('paste', preventPaste, true);
    domNode.addEventListener('keydown', preventPasteShortcut, true);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {});
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {});

    editor.onDidDispose(() => {
      domNode.removeEventListener('paste', preventPaste, true);
      domNode.removeEventListener('keydown', preventPasteShortcut, true);
    });
  }, []);

  const isStrictMode = session?.config.strictMode ?? true;
  const MAX_VIOLATIONS = 2;

  const handleViolation = useCallback(async (violation: SecureViolation) => {
    if (!id || proctoringSyncDisabledRef.current) {
      return;
    }
    api.updateProctoringData(id, {
      violationType: violation.type,
      violationMessage: violation.message,
      timestamp: new Date(violation.timestamp).toISOString(),
      clientProof: violation.clientProof,
      sequenceNumber: violation.sequenceNumber,
      mouseTrail: violation.mouseTrail,
      keystrokeDynamics: violation.keystrokeDynamics
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const lowerMessage = message.toLowerCase();
      if (
        (lowerMessage.includes('/proctoring') && lowerMessage.includes('not found')) ||
        lowerMessage.includes('404')
      ) {
        proctoringSyncDisabledRef.current = true;
        return;
      }
      console.error(error);
    });
  }, [id]);

  const handleTerminate = useCallback(async () => {
    if (!session || testTerminated) return;
    
    setTestTerminated(true);
    setTerminationReason('Test terminated due to proctoring violations');
    
    try {
      await autoSubmitAll();
      showAlert('Test Terminated', 'Your test has been terminated due to multiple proctoring violations.');
    } catch (error) {
      showAlert('Test Terminated', 'Your test has been terminated.');
    }
    
    setTimeout(() => {
      navigate('/interview');
    }, 3000);
  }, [session, testTerminated, id, navigate, showAlert]);

  const proctoringSecret = session?.proctoringSecret || '';

  const {
    violations,
    violationCount,
    isLocked,
    enterFullscreen
  } = useSecureProctoring({
    sessionId: id || '',
    secret: proctoringSecret,
    onViolation: handleViolation,
    onTerminate: handleTerminate,
    maxViolations: MAX_VIOLATIONS,
    enableKeystrokeTracking: true,
    enableMouseTracking: true,
    enableIntegrityChecks: true
  });

  useInterviewContentProtection({
    enabled: Boolean(session) && !testTerminated,
    sessionId: id,
    onBlocked: (message, action) => {
      if (action.startsWith('shortcut_') || action.startsWith('clipboard_')) return;
      setContentProtectionNotice(message);
    },
  });

  useEffect(() => {
    if (!contentProtectionNotice) return;
    const timer = window.setTimeout(() => setContentProtectionNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [contentProtectionNotice]);

  const autoSubmitAll = async (sourceSession?: InterviewSession | null) => {
    const sessionToSubmit = sourceSession ?? session;
    if (!sessionToSubmit || !id || autoSubmitInFlightRef.current) return;

    autoSubmitInFlightRef.current = true;
    try {
      if (sessionToSubmit.status !== 'submitted') {
        const sectionAnswers = sessionToSubmit.sections.map((section, sectionIdx) => ({
          sectionIndex: sectionIdx,
          answers: section.questions.map((q, qIdx) => ({
            questionIndex: qIdx,
            userCode: q.type === 'coding' || q.type === 'sql' ? q.userCode : undefined,
            userAnswer: q.type === 'system-design' || q.type === 'behavioral' ? q.userAnswer : undefined,
            score: q.score,
            timeSpent: q.timeSpent
          }))
        }));
        await api.endInterview(id, sectionAnswers);
      }
    } catch (error) {
      console.error('Failed to end interview:', error);
    } finally {
      autoSubmitInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      if (!id) return;
      try {
        const data = await api.getInterviewSession(id);
        if (data.status === 'submitted') {
          showAlert('Test Already Submitted', 'This test is already submitted. Start a new one to continue.');
          navigate('/interview');
          return;
        }
        setSession(data);
        setCurrentSectionIdx(data.currentSectionIndex);
        
        if (data.status === 'start') {
          const elapsed = (Date.now() - new Date(data.startedAt).getTime()) / 1000;
          const remaining = (data.config.duration * 60) - elapsed;
          setTimeLeft(Math.max(0, remaining));
        }
        
        if (data.sections.length > 0 && data.sections[0].questions.length > 0) {
          const firstQ = data.sections[0].questions[0];
          if (firstQ.type === 'coding' || firstQ.type === 'sql') {
            setCode(firstQ.userCode || '// Write your solution here\n');
          } else {
            setUserAnswer(firstQ.userAnswer || '');
          }
        }
      } catch (err) {
        console.error('Load session error:', err);
        showAlert('Error', 'Failed to load session');
      }
    };
    loadSession();
  }, [id, showAlert, navigate]);

  useEffect(() => {
    if (!session || session.status !== 'start' || timeLeft <= 0 || testTerminated) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTerminate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, session, testTerminated, handleTerminate]);

  useEffect(() => {
    if (!session) return;
    const section = session.sections[currentSectionIdx];
    if (!section || !section.questions[currentQuestionIdx]) return;
    
    const question = section.questions[currentQuestionIdx];
    const draftKey = `interview_draft_${session._id}_${currentSectionIdx}_${currentQuestionIdx}`;
    const savedDraft = safeStorage.getItem(draftKey) as string;
    
    if (question.type === 'coding' || question.type === 'sql') {
      setCode(savedDraft || question.userCode || '// Write your solution here\n');
    } else {
      setUserAnswer(savedDraft || question.userAnswer || '');
    }
    
    setOutput(null);
    setActiveTab('description');
    setConsoleTab('testcase');
  }, [currentQuestionIdx, currentSectionIdx, session]);

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    
    if (session) {
      const draftKey = `interview_draft_${session._id}_${currentSectionIdx}_${currentQuestionIdx}`;
      safeStorage.setItem(draftKey, newCode);
      
      const newSections = [...session.sections];
      newSections[currentSectionIdx].questions[currentQuestionIdx].userCode = newCode;
      setSession({ ...session, sections: newSections });
    }
  };

  const handleAnswerChange = (value: string) => {
    setUserAnswer(value);
    
    if (session) {
      const draftKey = `interview_draft_${session._id}_${currentSectionIdx}_${currentQuestionIdx}`;
      safeStorage.setItem(draftKey, value);
      
      const newSections = [...session.sections];
      newSections[currentSectionIdx].questions[currentQuestionIdx].userAnswer = value;
      setSession({ ...session, sections: newSections });
    }
  };

  const handleRun = async () => {
    if (!session || !id || isSubmitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsSubmitting(true);
    setActiveTab('console');
    setConsoleTab('result');
    setOutput({ status: 'running' });
    
    try {
      const result = await api.runInterviewCode(
        id,
        currentQuestionIdx,
        question.type === 'coding' || question.type === 'sql' ? code : '',
        selectedCase === 'custom' ? customInput : undefined,
        question.type === 'system-design' || question.type === 'behavioral' ? userAnswer : undefined
      );
      setOutput({
        status: result.status,
        feedback: result.feedback,
        summary: result.summary,
        testResults: result.testResults
      });
    } catch (error) {
      setOutput({ status: 'error', feedback: 'Execution failed' });
    } finally {
      requestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitCurrentQuestion = async (): Promise<InterviewSession | null> => {
    if (!session || !id) return null;

    const activeSection = session.sections[currentSectionIdx];
    const activeQuestion = activeSection?.questions[currentQuestionIdx];
    if (!activeQuestion) return null;

    setActiveTab('console');
    setConsoleTab('result');
    setOutput({ status: 'running' });

    const result = await api.submitInterviewCode(
      id,
      currentQuestionIdx,
      activeQuestion.type === 'coding' || activeQuestion.type === 'sql' ? code : '',
      activeQuestion.type === 'system-design' || activeQuestion.type === 'behavioral' ? userAnswer : undefined
    );

    setOutput({
      status: result.status,
      feedback: result.feedback,
      score: result.score,
      summary: result.summary,
      testResults: result.testResults
    });

    const updated = await api.getInterviewSession(id);
    setSession(updated);
    return updated;
  };

  const handleSubmit = async () => {
    if (!session || !id || isSubmitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const latestSession = await submitCurrentQuestion();
      await autoSubmitAll(latestSession);

      if (isStrictMode && isLocked && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }

      showAlert('Test Submitted', 'Your test has been submitted successfully.');
      navigate('/interview');
    } catch (error) {
      setOutput({ status: 'error', feedback: 'Test submission failed' });
      showAlert('Error', 'Failed to submit test');
    } finally {
      requestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmitSection = async () => {
    if (!session || !id || isSubmitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsSubmitting(true);
    
    try {
      const updatedAfterQuestion = await submitCurrentQuestion();
      if (!updatedAfterQuestion) {
        return;
      }

      const liveSectionIndex = updatedAfterQuestion.currentSectionIndex;
      const liveSection = updatedAfterQuestion.sections[liveSectionIndex];
      const isLastQuestionInSection = currentQuestionIdx >= liveSection.questions.length - 1;
      const hasNextSection = liveSectionIndex < updatedAfterQuestion.sections.length - 1;

      if (!isLastQuestionInSection) {
        setCurrentQuestionIdx(prev => prev + 1);
        return;
      }

      if (!hasNextSection) {
        showAlert('Final Question Reached', 'You are on the final question. Click "Submit Test" to finish.');
        return;
      }

      const answers = liveSection.questions.map((q, idx) => ({
        questionIndex: idx,
        userCode: q.type === 'coding' || q.type === 'sql' ? q.userCode : undefined,
        userAnswer: q.type === 'system-design' || q.type === 'behavioral' ? q.userAnswer : undefined,
        score: q.score,
        timeSpent: q.timeSpent
      }));

      await api.submitSection(id, answers);
      const nextSectionSession = await api.nextSection(id);
      setSession(nextSectionSession);
      setCurrentSectionIdx(nextSectionSession.currentSectionIndex);
      setCurrentQuestionIdx(0);

      if (nextSectionSession.sections[nextSectionSession.currentSectionIndex]?.questions[0]) {
        const nextQ = nextSectionSession.sections[nextSectionSession.currentSectionIndex].questions[0];
        if (nextQ.type === 'coding' || nextQ.type === 'sql') {
          setCode(nextQ.userCode || '// Write your solution here\n');
        } else {
          setUserAnswer(nextQ.userAnswer || '');
        }
      }
    } catch (error) {
      setOutput({ status: 'error', feedback: 'Failed to submit and continue' });
      showAlert('Error', 'Failed to submit and continue');
    } finally {
      requestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const goToNextQuestion = () => {
    const section = session?.sections[currentSectionIdx];
    if (section && currentQuestionIdx < section.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-console-bg flex items-center justify-center">
        <div className="text-text-tertiary">Loading test environment...</div>
      </div>
    );
  }

  if (testTerminated) {
    return (
      <div className="fixed inset-0 z-[99999] bg-red-950 flex flex-col items-center justify-center">
        <AlertTriangle className="w-20 h-20 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Test Terminated</h1>
        <p className="text-red-200 text-lg mb-2">{terminationReason}</p>
        <p className="text-red-300">Redirecting to results...</p>
      </div>
    );
  }

  const section = session.sections[currentSectionIdx];
  const question = section.questions[currentQuestionIdx];
  const testCases = question.testCases || [];

  const TestInterface = (
    <div className="h-full flex">
      <div className="w-5/12 border-r border-border-subtle/30 flex flex-col bg-console-bg">
        <div className="flex border-b border-border-subtle/30">
          <button
            onClick={() => setActiveTab('description')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'description' ? 'text-text-primary border-b-2 border-accent-primary bg-console-surface-2/40' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Problem
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'console' ? 'text-text-primary border-b-2 border-accent-primary bg-console-surface-2/40' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Console
          </button>
        </div>

        <div className="px-4 py-2 border-b border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] leading-relaxed text-amber-200">
            Proprietary interview questions and rules are protected. Copying, sharing, or bypassing safeguards may result in account termination.
          </p>
          {contentProtectionNotice && (
            <p className="mt-1 text-[11px] text-status-error">
              {contentProtectionNotice}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'description' ? (
            <div data-protected-content="true" className="select-none">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-text-primary mb-2">
                  {currentQuestionIdx + 1}. {question.problemName}
                </h1>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  question.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                  question.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {question.difficulty}
                </span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {question.description}
                </ReactMarkdown>
              </div>

              {testCases.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Example Test Cases</h3>
                  <div className="space-y-3">
                    {testCases.slice(0, 2).map((tc, idx) => (
                      <div key={idx} className="bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Input:</div>
                        <pre className="text-sm text-slate-200 bg-slate-900 rounded p-2 overflow-x-auto">{tc.input}</pre>
                        <div className="text-xs text-slate-400 mt-2 mb-1">Expected:</div>
                        <pre className="text-sm text-green-400 bg-slate-900 rounded p-2 overflow-x-auto">{tc.expectedOutput}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setConsoleTab('testcase')}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    consoleTab === 'testcase' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Test Cases
                </button>
                <button
                  onClick={() => setConsoleTab('result')}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    consoleTab === 'result' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Result
                </button>
              </div>

              {consoleTab === 'testcase' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {testCases.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCase(idx)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          selectedCase === idx ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedCase('custom')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedCase === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {selectedCase === 'custom' ? (
                    <div>
                      <label className="text-sm text-text-tertiary block mb-2">Custom Input</label>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter input..."
                        className="w-full h-32 bg-console-bg border border-border-subtle/50 rounded-lg p-3 text-sm text-text-secondary focus:outline-none focus:border-accent-primary/50"
                      />
                    </div>
                  ) : (
                    <div data-protected-content="true" className="space-y-3 select-none">
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">Input:</div>
                        <pre className="text-sm text-text-secondary bg-console-bg border border-border-subtle/30 rounded p-2">{testCases[selectedCase as number]?.input || ''}</pre>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">Expected:</div>
                        <pre className="text-sm text-status-ok bg-console-bg border border-border-subtle/30 rounded p-2">{testCases[selectedCase as number]?.expectedOutput || ''}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!output ? (
                    <div className="text-slate-500 text-center py-8">
                      <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Run your code to see results</p>
                    </div>
                  ) : output.status === 'running' ? (
                    <div className="text-blue-400 animate-pulse">
                      <Clock className="w-5 h-5 inline mr-2" />
                      Running...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg ${
                        output.status === 'pass' || output.status === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                        output.status === 'error' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                        'bg-red-500/20 border border-red-500/30'
                      }`}>
                        <div className="font-semibold text-lg mb-2">
                          {output.status === 'pass' || output.status === 'success' ? 'Accepted' :
                           output.status === 'error' ? 'Runtime Error' : 'Wrong Answer'}
                        </div>
                        {output.summary && (
                          <div className="text-sm opacity-80">
                            Passed {output.summary.passed}/{output.summary.total} test cases
                          </div>
                        )}
                        {output.score !== undefined && (
                          <div className="text-sm opacity-80">
                            Score: {output.score}/100
                          </div>
                        )}
                        {output.feedback && (
                          <div className="text-sm mt-2 opacity-90 whitespace-pre-wrap">{output.feedback}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle/30 p-4 flex items-center justify-between">
          <button
            onClick={goToPrevQuestion}
            disabled={currentQuestionIdx === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-console-surface border border-border-subtle/30 text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-console-surface-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-text-tertiary">
            Question {currentQuestionIdx + 1} of {section.questions.length}
          </span>
          <button
            onClick={goToNextQuestion}
            disabled={currentQuestionIdx === section.questions.length - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-console-surface border border-border-subtle/30 text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-console-surface-2 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-7/12 flex flex-col bg-console-bg">
        <div className="h-12 border-b border-border-subtle/30 flex items-center justify-between px-4 bg-console-header/40">
          <div className="text-sm text-text-tertiary">
            {question.type === 'sql' ? 'SQL' : session.config.language?.toUpperCase() || 'JAVASCRIPT'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-console-surface border border-border-subtle/30 text-text-secondary rounded-lg hover:bg-console-surface-2 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-status-ok text-white rounded-lg opacity-90 hover:opacity-100 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Test
            </button>
          </div>
        </div>

        <div className="flex-1">
          {question.type === 'coding' || question.type === 'sql' ? (
            <Editor
              height="100%"
              defaultLanguage={question.type === 'sql' ? 'sql' : session.config.language || 'javascript'}
              language={question.type === 'sql' ? 'sql' : session.config.language || 'javascript'}
              theme={document.documentElement.classList.contains('light') ? 'vs' : 'vs-dark'}
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16 },
                lineNumbers: 'on',
                roundedSelection: false,
                scrollbar: {
                  useShadows: false,
                  verticalHasArrows: false,
                  horizontalHasArrows: false,
                  vertical: 'auto',
                  horizontal: 'auto'
                }
              }}
            />
          ) : (
            <textarea
              value={userAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              placeholder="Type your answer here..."
              className="w-full h-full bg-console-bg text-text-secondary p-6 resize-none focus:outline-none font-mono text-sm"
            />
          )}
        </div>

        <div className="h-14 border-t border-border-subtle/30 flex items-center justify-between px-4 bg-console-header/20">
          <div className="text-sm text-text-tertiary">
            Section {currentSectionIdx + 1} of {session.sections.length}: {section.name}
          </div>
          <button
            onClick={handleSubmitSection}
            disabled={isSubmitting}
            className="px-6 py-2 bg-accent-primary text-[color:var(--text-on-accent)] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 font-medium"
          >
            {currentQuestionIdx < section.questions.length - 1
              ? 'Submit & Next Question'
              : currentSectionIdx < session.sections.length - 1
                ? 'Submit Section & Continue'
                : 'Submit Question'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isStrictMode) {
    return (
      <FullscreenLockdown
        isActive={true}
        testName={session.config.difficulty + ' Assessment'}
        timeLeft={timeLeft}
        violations={violations}
        violationCount={violationCount}
        maxViolations={MAX_VIOLATIONS}
        onEnterFullscreen={enterFullscreen}
        onViolation={(message) => showAlert('Proctoring Violation', message)}
      >
        {TestInterface}
      </FullscreenLockdown>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Terminal className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium">{session.config.difficulty} Assessment</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 font-mono">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      {TestInterface}
    </div>
  );
}
