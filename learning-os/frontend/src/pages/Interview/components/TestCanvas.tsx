import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal, Code as CodeIcon, ChevronLeft, ChevronRight, CheckCircle, Play } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';
import type { InterviewQuestion, InterviewRunResult } from '../../../services/types';

interface TestCanvasProps {
  question: InterviewQuestion;
  code: string;
  userAnswer: string;
  activeTab: 'description' | 'console';
  consoleTab: 'testcase' | 'result';
  selectedCase: number | 'custom';
  customInput: string;
  output: (InterviewRunResult & { status?: 'pass' }) | { status: 'running' | 'error', feedback?: string, summary?: any } | null;
  isSubmitting: boolean;
  currentQuestionIdx: number;
  totalQuestions: number;
  language: string;
  onCodeChange: (value: string | undefined) => void;
  onAnswerChange: (value: string) => void;
  onTabChange: (tab: 'description' | 'console') => void;
  onConsoleTabChange: (tab: 'testcase' | 'result') => void;
  onCaseChange: (idx: number | 'custom') => void;
  onCustomInputChange: (val: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onSubmitSection: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEditorMount: (editor: any, monaco: any) => void;
  contentProtectionNotice?: string | null;
}

export const TestCanvas = memo(({
  question,
  code,
  userAnswer,
  activeTab,
  consoleTab,
  selectedCase,
  customInput,
  output,
  isSubmitting,
  currentQuestionIdx,
  totalQuestions,
  language,
  onCodeChange,
  onAnswerChange,
  onTabChange,
  onConsoleTabChange,
  onCaseChange,
  onCustomInputChange,
  onRun,
  onSubmit,
  onSubmitSection,
  onPrev,
  onNext,
  onEditorMount,
  contentProtectionNotice
}: TestCanvasProps) => {
  const testCases = question.testCases || [];

  return (
    <div className="h-full flex overflow-hidden bg-console-bg">
      {/* Sidebar: Problem & Console */}
      <div className="w-5/12 flex flex-col border-r border-white/5 bg-console-bg/50 backdrop-blur-3xl z-10">
        <div className="flex p-1.5 bg-console-surface/40 backdrop-blur-md border-b border-white/5">
          <button
            onClick={() => onTabChange('description')}
            className={cn(
              "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all",
              activeTab === 'description' 
                ? 'bg-accent-primary text-white shadow-xl shadow-accent-primary/20' 
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            Problem Protocol
          </button>
          <button
            onClick={() => onTabChange('console')}
            className={cn(
              "flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all",
              activeTab === 'console' 
                ? 'bg-accent-primary text-white shadow-xl shadow-accent-primary/20' 
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            Terminal Output
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          {activeTab === 'description' ? (
            <div data-protected-content="true" className="select-none space-y-8 animate-in fade-in duration-500">
               {/* Question Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary font-black text-xs">
                    {currentQuestionIdx + 1}
                  </span>
                  <h1 className="text-2xl font-black text-text-primary tracking-tight leading-none">
                    {question.problemName}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("font-black uppercase tracking-widest text-[9px]",
                    question.difficulty === 'easy' ? 'bg-status-ok/10 text-status-ok border-status-ok/20' :
                    question.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    'bg-status-error/10 text-status-error border-status-error/20'
                  )}>
                    {question.difficulty || 'medium'}
                  </Badge>
                  <Badge className="bg-white/5 text-white/40 border-white/10 font-black uppercase tracking-widest text-[9px]">
                    {question.type}
                  </Badge>
                </div>
              </div>
              
              <div className="prose prose-invert prose-sm max-w-none text-text-muted font-medium leading-relaxed prose-headings:text-text-primary prose-headings:font-black pb-10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {question.description}
                </ReactMarkdown>
              </div>

              {testCases.length > 0 && (
                <div className="pt-8 border-t border-white/5 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Example Scenarios</h3>
                  <div className="space-y-4">
                    {testCases.slice(0, 2).map((tc, idx) => (
                      <div key={idx} className="bg-console-surface/30 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Scenario {idx + 1}</span>
                        </div>
                        <div className="p-5 space-y-4 bg-console-bg/40">
                          <div>
                             <div className="text-[9px] font-bold text-text-muted uppercase mb-2">Input</div>
                             <pre className="text-xs text-text-primary bg-console-bg border border-white/5 rounded-xl p-4 overflow-x-auto font-mono selection:bg-accent-primary/30">{tc.input}</pre>
                          </div>
                          <div>
                             <div className="text-[9px] font-bold text-text-muted uppercase mb-2">Expected Out</div>
                             <pre className="text-xs text-status-ok bg-status-ok/5 border border-status-ok/20 rounded-xl p-4 overflow-x-auto font-mono selection:bg-accent-primary/30">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full space-y-6">
              <div className="flex p-1 bg-console-surface/40 rounded-2xl border border-white/5 h-12">
                <button
                  onClick={() => onConsoleTabChange('testcase')}
                  className={cn("flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    consoleTab === 'testcase' ? 'bg-console-surface-3 text-text-primary shadow-sm' : 'text-text-muted'
                  )}
                >
                  Simulation Inputs
                </button>
                <button
                  onClick={() => onConsoleTabChange('result')}
                  className={cn("flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    consoleTab === 'result' ? 'bg-console-surface-3 text-text-primary shadow-sm' : 'text-text-muted'
                  )}
                >
                  Kernel Logs
                </button>
              </div>

              <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait">
                  {consoleTab === 'testcase' ? (
                    <motion.div 
                      key="testcase"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-wrap gap-2">
                        {testCases.map((_, idx) => (
                          <button key={idx} onClick={() => onCaseChange(idx)}
                            className={cn("px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border",
                              selectedCase === idx ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary' : 'bg-console-bg border-white/5 text-text-muted'
                            )}
                          >
                            Scenario {idx + 1}
                          </button>
                        ))}
                        <button onClick={() => onCaseChange('custom')}
                          className={cn("px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border",
                            selectedCase === 'custom' ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary' : 'bg-console-bg border-white/5 text-text-muted'
                          )}
                        >
                          Manual Input
                        </button>
                      </div>
                      
                      {selectedCase === 'custom' ? (
                        <textarea 
                           value={customInput}
                           onChange={(e) => onCustomInputChange(e.target.value)}
                           placeholder="Enter custom simulation input JSON..."
                           className="w-full h-64 bg-console-bg border border-white/5 rounded-2xl p-5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-primary/30 resize-none selection:bg-accent-primary/30"
                        />
                      ) : (
                        <div className="space-y-4">
                           <div className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-40">Environment Variable Injection</div>
                           <pre className="p-5 bg-console-bg border border-white/5 rounded-2xl text-xs font-mono text-text-primary overflow-auto h-64 selection:bg-accent-primary/30 tracking-tight leading-relaxed">{testCases[selectedCase as number]?.input || '// No input defined for this scenario'}</pre>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="h-full space-y-6"
                    >
                      {!output ? (
                        <div className="h-64 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                           <Terminal size={40} className="mb-4 text-accent-primary" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Awaiting Subprocess Execution</span>
                        </div>
                      ) : output.status === 'running' ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                           <div className="w-12 h-12 border-4 border-accent-primary/10 border-t-accent-primary rounded-full animate-spin" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary animate-pulse">Running Simulation...</span>
                        </div>
                      ) : (
                        <div className={cn("p-10 rounded-[3rem] border space-y-8 animate-in zoom-in-95 duration-500",
                          ((output as any).status === 'pass') ? 'bg-status-ok/[0.03] border-status-ok/20' : 'bg-status-error/[0.03] border-status-error/20'
                        )}>
                           <div className="flex items-center justify-between">
                             <div className={cn("text-3xl font-black uppercase tracking-tighter leading-none",
                                ((output as any).status === 'pass') ? 'text-status-ok' : 'text-status-error'
                             )}>
                                {((output as any).status === 'pass') ? 'Accepted' : 'Runtime Error'}
                             </div>
                             <div className="w-12 h-12 rounded-full flex items-center justify-center border border-current opacity-20">
                                <Terminal size={20} />
                             </div>
                           </div>
                           
                           {output.summary && (
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2 opacity-50">Test Consistency</div>
                                    <div className="text-2xl font-black text-text-primary tracking-tighter">{output.summary.passed} / {output.summary.total}</div>
                                 </div>
                                 <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2 opacity-50">Phase Score</div>
                                    <div className="text-2xl font-black text-text-primary tracking-tighter">{Math.round((output.summary.passed / output.summary.total) * 100)}%</div>
                                 </div>
                              </div>
                           )}

                           {output.feedback && (
                              <div className="space-y-3">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-40 px-1">Compiler Output</div>
                                 <pre className="p-6 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap selection:bg-accent-primary/40 shadow-2xl">{output.feedback}</pre>
                              </div>
                           )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Question Navigation Footer */}
        <div className="h-24 border-t border-white/5 p-6 bg-console-surface/10 backdrop-blur-2xl flex items-center justify-between">
          <button onClick={onPrev} disabled={currentQuestionIdx === 0}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/[0.05] transition-all disabled:opacity-20 active:scale-95 group">
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Prev Phase
          </button>
          <div className="flex gap-2">
             {Array.from({length: totalQuestions}).map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500", i === currentQuestionIdx ? "bg-accent-primary w-8" : "bg-white/10 w-2")} />
             ))}
          </div>
          <button onClick={onNext} disabled={currentQuestionIdx === totalQuestions - 1}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/[0.05] transition-all disabled:opacity-20 active:scale-95 group">
            Next Phase <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Workspace: Editor or Input */}
      <div className="w-7/12 flex flex-col bg-console-bg relative">
        {/* Editor Controls */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-console-header/40 backdrop-blur-2xl z-20">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                <CodeIcon size={16} className="text-accent-primary" />
             </div>
             <span className="text-[10px] font-black text-text-primary uppercase tracking-[0.25em]">{language} Run-time Environment</span>
          </div>
          <div className="flex items-center gap-3">
             <Button onClick={onRun} isLoading={isSubmitting} variant="secondary" className="h-11 px-8 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/5 shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                <Play className="w-3.5 h-3.5 mr-2" fill="currentColor" /> Compute Logic
             </Button>
             <Button onClick={onSubmit} isLoading={isSubmitting} className="h-11 px-8 bg-status-ok/10 border-status-ok/20 text-status-ok hover:bg-status-ok/20 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                <CheckCircle className="w-3.5 h-3.5 mr-2" /> Global Sync
             </Button>
          </div>
        </div>

        <div className="flex-1 relative group">
          {question.type === 'coding' || question.type === 'sql' ? (
            <Editor
              height="100%"
              defaultLanguage={question.type === 'sql' ? 'sql' : language}
              language={question.type === 'sql' ? 'sql' : language}
              theme="vs-dark"
              value={code}
              onChange={onCodeChange}
              onMount={onEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 32 },
                smoothScrolling: true,
                cursorBlinking: 'expand',
                cursorSmoothCaretAnimation: 'on',
                lineNumbersMinChars: 4,
                scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'hidden',
                }
              }}
            />
          ) : (
            <div className="h-full p-12 bg-console-bg/30 relative">
               <textarea 
                  value={userAnswer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="Initialize architectural response protocol..."
                  className="w-full h-full bg-black/20 text-text-primary p-12 rounded-[4rem] border border-white/5 focus:border-accent-primary/20 focus:outline-none font-mono text-sm leading-[1.8] resize-none custom-scrollbar shadow-2xl selection:bg-accent-primary/30"
               />
               <div className="absolute top-16 right-16 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl">
                  <Terminal size={20} className="text-accent-primary opacity-20" />
               </div>
            </div>
          )}

          {/* Toast / Notice Overlay */}
          <AnimatePresence>
             {contentProtectionNotice && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 20 }}
                 className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-status-error/90 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-2xl flex items-center gap-4 text-white"
               >
                 <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                    <CheckCircle size={20} />
                 </div>
                 <div className="text-xs font-black uppercase tracking-widest">{contentProtectionNotice}</div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>

        {/* Global Action Footer */}
        <div className="h-24 border-t border-white/5 flex items-center justify-between px-10 bg-console-surface/40 backdrop-blur-2xl z-20">
           <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-30">Simulation State</span>
              <div className="text-xs font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-3">
                 <span className="text-accent-primary">PHASE 0{currentQuestionIdx + 1}</span> 
                 <span className="opacity-20">/</span> 
                 <span className="opacity-40">0{totalQuestions}</span>
              </div>
           </div>
           <Button onClick={onSubmitSection} isLoading={isSubmitting} className="h-14 px-12 bg-accent-primary text-white text-[11px] font-black uppercase tracking-widest rounded-3xl shadow-2xl shadow-accent-primary/25 hover:scale-[1.05] active:scale-95 transition-all group overflow-hidden relative">
              <span className="relative z-10 flex items-center gap-3">
                Commit Protocol & Advance <ChevronRight size={18} className="group-hover:translate-x-2 transition-transform duration-500" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
           </Button>
        </div>
      </div>
    </div>
  );
});
