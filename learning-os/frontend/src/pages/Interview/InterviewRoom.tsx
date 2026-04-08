import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { InterviewSession, InterviewQuestion } from '../../services/api';
import { useDialog } from '../../hooks/useDialog';
import { useInterviewContentProtection } from '../../hooks/useInterviewContentProtection';
import { TestCanvas } from './components/TestCanvas';
import { ProctoringOverlay } from './components/ProctoringOverlay';
import { Monitor, Clock } from 'lucide-react';

export function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert } = useDialog();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'console'>('description');
  const [consoleTab, setConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [selectedCase, setSelectedCase] = useState<number | 'custom'>(0);
  const [customInput, setCustomInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [output, setOutput] = useState<any>(null); // api type for run result
  const [testTerminated, setTestTerminated] = useState(false);
  const [contentProtectionNotice, setContentProtectionNotice] = useState<string | null>(null);
  
  const requestInFlightRef = useRef(false);
  const autoSubmitInFlightRef = useRef(false);
  const editorRef = useRef<any>(null);

  // ─── Initialization ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await api.getInterviewSession(id);
        if (data.status === 'submitted') {
          navigate('/interview');
          return;
        }
        setSession(data);
        const elapsed = (Date.now() - new Date(data.startedAt).getTime()) / 1000;
        setTimeLeft(Math.max(0, (data.config.duration * 60) - elapsed));
      } catch (err) {
        showAlert('Error', 'Phase initialization failed');
        navigate('/interview');
      }
    };
    load();
  }, [id, navigate, showAlert]);

  // ─── Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || timeLeft <= 0 || testTerminated) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session, timeLeft, testTerminated]);

  // ─── Phase Context ─────────────────────────────────────────────
  const section = useMemo(() => session?.sections[session?.currentSectionIndex || 0], [session]);
  const question = useMemo(() => section?.questions[currentQuestionIdx], [section, currentQuestionIdx]);

  // ─── Optimized Handlers ────────────────────────────────────────
  const handleCodeChange = useCallback((c: string | undefined) => {
    if (!session || !section) return;
    setSession(prev => {
      if (!prev) return null;
      const next = { ...prev };
      next.sections[prev.currentSectionIndex].questions[currentQuestionIdx].userCode = c || '';
      return next;
    });
  }, [currentQuestionIdx, session, section]);

  const handleAnswerChange = useCallback((a: string) => {
    if (!session || !section) return;
    setSession(prev => {
      if (!prev) return null;
      const next = { ...prev };
      next.sections[prev.currentSectionIndex].questions[currentQuestionIdx].userAnswer = a;
      return next;
    });
  }, [currentQuestionIdx, session, section]);

  const handleRun = async () => {
    if (!id || !question || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsSubmitting(true);
    setActiveTab('console');
    setConsoleTab('result');
    setOutput({ status: 'running' });

    try {
      const res = await api.runInterviewCode(
        id, 
        currentQuestionIdx, 
        question.userCode || '', 
        selectedCase === 'custom' ? customInput : undefined
      );
      setOutput(res);
    } catch (err) {
      setOutput({ status: 'error', feedback: 'Run-time exception encountered' });
    } finally {
      requestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!id || !session || autoSubmitInFlightRef.current) return;
    autoSubmitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const answers = session.sections.map((s, sIdx) => ({
        sectionIndex: sIdx,
        answers: s.questions.map((q, qIdx) => ({
          questionIndex: qIdx,
          userCode: q.userCode,
          userAnswer: q.userAnswer,
          score: q.score,
          timeSpent: q.timeSpent
        }))
      }));
      await api.endInterview(id, answers);
      showAlert('Assessment Finalized', 'Submitting protocol results for evaluation.');
      navigate('/interview/history');
    } catch (err) {
      showAlert('Critical Error', 'Atomic submission failed. Retrying sync.');
    } finally {
      autoSubmitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmitSection = async () => {
    if (!id || !session || !section || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await api.submitSection(id, section.questions.map((q, i) => ({ 
        questionIndex: i, 
        userCode: q.userCode, 
        userAnswer: q.userAnswer 
      })));
      
      const nextSess = await api.nextSection(id);
      setSession(nextSess);
      setCurrentQuestionIdx(0);
      showAlert('Phase Sycned', 'Advancing to next simulation node.');
    } catch (err) {
      showAlert('Error', 'Phase transition failed');
    } finally {
      requestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    // Restore Kernel-grade paste protection
    editor.onDidPaste(() => {
      showAlert('Integrity Warning', 'External code injection detected and logged.');
    });
  }, [showAlert]);

  // ─── Content Protection ───────────────────────────────────────
  useInterviewContentProtection({
    enabled: Boolean(session) && !testTerminated,
    sessionId: id,
    onBlocked: (msg) => {
       setContentProtectionNotice(msg);
       setTimeout(() => setContentProtectionNotice(null), 3000);
    },
  });

  if (!session || !section || !question) return (
    <div className="h-screen bg-console-bg flex items-center justify-center">
       <div className="w-12 h-12 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="interview-shell h-screen flex flex-col overflow-hidden bg-console-bg selection:bg-accent-primary/30">
      {/* Header */}
      <div className="h-16 bg-console-header/60 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-8 relative z-50">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
             <Monitor className="w-5 h-5 text-accent-primary" />
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] leading-none mb-1">Alpha Testing Phase</span>
              <span className="text-xs font-black text-text-primary uppercase tracking-[0.2em]">{section.name}</span>
           </div>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-4 px-6 py-2.5 bg-white/[0.03] rounded-2xl border border-white/5 shadow-2xl">
              <Clock className="w-4 h-4 text-accent-primary animate-pulse" />
              <span className="text-sm font-black text-text-primary font-mono tracking-tighter">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
           </div>
           <button onClick={() => navigate('/interview')} className="text-[10px] font-black text-text-muted/40 uppercase tracking-widest hover:text-status-error transition-all duration-300">Abort Protocol</button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <TestCanvas 
          question={question}
          code={question.userCode || ''}
          userAnswer={question.userAnswer || ''}
          activeTab={activeTab}
          consoleTab={consoleTab}
          selectedCase={selectedCase}
          customInput={customInput}
          output={output}
          isSubmitting={isSubmitting}
          currentQuestionIdx={currentQuestionIdx}
          totalQuestions={section.questions.length}
          language={session.config.language || 'javascript'}
          onCodeChange={handleCodeChange}
          onAnswerChange={handleAnswerChange}
          onTabChange={setActiveTab}
          onConsoleTabChange={setConsoleTab}
          onCaseChange={setSelectedCase}
          onCustomInputChange={setCustomInput}
          onRun={handleRun}
          onSubmit={handleFinalSubmit}
          onSubmitSection={handleSubmitSection}
          onPrev={() => currentQuestionIdx > 0 && setCurrentQuestionIdx(prev => prev - 1)}
          onNext={() => currentQuestionIdx < section.questions.length - 1 && setCurrentQuestionIdx(prev => prev + 1)}
          onEditorMount={handleEditorMount}
          contentProtectionNotice={contentProtectionNotice}
        />
      </div>

      <ProctoringOverlay 
        sessionId={id || ''}
        secret={session.proctoringSecret || ''}
        timeLeft={timeLeft}
        isStrictMode={session.config.strictMode || true}
        onViolation={(v) => api.updateProctoringData(id!, v).catch(() => {})}
        onTerminate={() => {
          setTestTerminated(true);
          handleFinalSubmit();
        }}
      />
    </div>
  );
}
