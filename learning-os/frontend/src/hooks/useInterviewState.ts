import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { InterviewSession } from '../services/api';

interface PendingChange {
  id: string;
  timestamp: number;
  type: 'code_update' | 'answer_update' | 'submission';
  sectionIndex: number;
  questionIndex: number;
  data: unknown;
  status: 'pending' | 'synced' | 'conflict' | 'error';
}

interface ConflictResolution {
  questionKey: string;
  serverValue: string;
  localValue: string;
  resolved: boolean;
  resolution?: 'server' | 'local' | 'merge';
}

interface UseInterviewStateReturn {
  session: InterviewSession | null;
  isLoading: boolean;
  isSyncing: boolean;
  pendingChanges: PendingChange[];
  conflicts: ConflictResolution[];
  
  // Actions
  updateCode: (sectionIndex: number, questionIndex: number, code: string) => void;
  updateAnswer: (sectionIndex: number, questionIndex: number, answer: string) => void;
  submitQuestion: (sectionIndex: number, questionIndex: number) => Promise<void>;
  resolveConflict: (questionKey: string, resolution: 'server' | 'local' | 'merge') => void;
  
  // Navigation
  currentSection: number;
  currentQuestion: number;
  setCurrentSection: (index: number) => void;
  setCurrentQuestion: (index: number) => void;
  
  // Sync status
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
}

export function useInterviewState(sessionId: string): UseInterviewStateReturn {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const syncInProgressRef = useRef(false);
  const draftQueueRef = useRef<Map<string, string>>(new Map());

  // Query for session data with polling
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['interview', sessionId],
    queryFn: () => api.getInterviewSession(sessionId),
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 5000,
    retry: 3
  });

  // Sync status derived from pending changes
  const syncStatus = pendingChanges.some(c => c.status === 'pending') 
    ? 'syncing' 
    : pendingChanges.some(c => c.status === 'error') 
      ? 'error' 
      : 'idle';
  
  const isSyncing = syncStatus === 'syncing';

  // Detect conflicts on data refresh
  useEffect(() => {
    if (!session) return;

    // Check for conflicts with pending changes
    for (const change of pendingChanges) {
      if (change.status !== 'pending') continue;
      
      const section = session.sections[change.sectionIndex];
      if (!section) continue;
      
      const question = section.questions[change.questionIndex];
      if (!question) continue;

      const serverValue = question.userCode || question.userAnswer || '';
      const localValue = change.data as string;

      if (serverValue !== localValue && serverValue !== '' && localValue !== '') {
        // Conflict detected
        const questionKey = `${change.sectionIndex}-${change.questionIndex}`;
        
        setConflicts(prev => {
          if (prev.some(c => c.questionKey === questionKey && !c.resolved)) {
            return prev;
          }
          return [...prev, {
            questionKey,
            serverValue,
            localValue,
            resolved: false
          }];
        });

        // Mark change as conflict
        setPendingChanges(prev => 
          prev.map(c => c.id === change.id ? { ...c, status: 'conflict' } : c)
        );
      }
    }
  }, [session, pendingChanges]);

  // Optimistic code update mutation
  const codeMutation = useMutation({
    mutationFn: async ({
      sectionIndex,
      questionIndex,
      code
    }: {
      sectionIndex: number;
      questionIndex: number;
      code: string;
    }) => {
      // Save to server
      await api.updateDraft(sessionId, questionIndex, code);
      return { sectionIndex, questionIndex, code };
    },
    onMutate: async ({ sectionIndex, questionIndex, code }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['interview', sessionId] });

      // Snapshot previous value
      const previousSession = queryClient.getQueryData<InterviewSession>(['interview', sessionId]);

      // Optimistically update
      queryClient.setQueryData<InterviewSession>(['interview', sessionId], (old) => {
        if (!old) return old;
        
        const newSections = [...old.sections];
        const section = { ...newSections[sectionIndex] };
        const questions = [...section.questions];
        questions[questionIndex] = { ...questions[questionIndex], userCode: code };
        section.questions = questions;
        newSections[sectionIndex] = section;
        
        return { ...old, sections: newSections };
      });

      // Add to pending changes
      const changeId = `code-${Date.now()}-${Math.random()}`;
      setPendingChanges(prev => [...prev, {
        id: changeId,
        timestamp: Date.now(),
        type: 'code_update',
        sectionIndex,
        questionIndex,
        data: code,
        status: 'pending'
      }]);

      // Save to local draft queue
      const draftKey = `interview_draft_${sessionId}_${sectionIndex}_${questionIndex}`;
      draftQueueRef.current.set(draftKey, code);

      return { previousSession, changeId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSession) {
        queryClient.setQueryData(['interview', sessionId], context.previousSession);
      }

      // Mark change as error
      if (context?.changeId) {
        setPendingChanges(prev =>
          prev.map(c => c.id === context.changeId ? { ...c, status: 'error' } : c)
        );
      }
    },
    onSuccess: (data, variables, context) => {
      // Mark change as synced
      if (context?.changeId) {
        setPendingChanges(prev =>
          prev.filter(c => c.id !== context.changeId)
        );
      }
      setLastSyncTime(new Date());
    }
  });

  // Answer update (for system design/behavioral)
  const answerMutation = useMutation({
    mutationFn: async ({
      sectionIndex,
      questionIndex,
      answer
    }: {
      sectionIndex: number;
      questionIndex: number;
      answer: string;
    }) => {
      await api.updateDraft(sessionId, questionIndex, undefined, answer);
      return { sectionIndex, questionIndex, answer };
    },
    onMutate: async ({ sectionIndex, questionIndex, answer }) => {
      await queryClient.cancelQueries({ queryKey: ['interview', sessionId] });
      const previousSession = queryClient.getQueryData<InterviewSession>(['interview', sessionId]);

      queryClient.setQueryData<InterviewSession>(['interview', sessionId], (old) => {
        if (!old) return old;
        
        const newSections = [...old.sections];
        const section = { ...newSections[sectionIndex] };
        const questions = [...section.questions];
        questions[questionIndex] = { ...questions[questionIndex], userAnswer: answer };
        section.questions = questions;
        newSections[sectionIndex] = section;
        
        return { ...old, sections: newSections };
      });

      const changeId = `answer-${Date.now()}-${Math.random()}`;
      setPendingChanges(prev => [...prev, {
        id: changeId,
        timestamp: Date.now(),
        type: 'answer_update',
        sectionIndex,
        questionIndex,
        data: answer,
        status: 'pending'
      }]);

      return { previousSession, changeId };
    },
    onError: (err, variables, context) => {
      if (context?.previousSession) {
        queryClient.setQueryData(['interview', sessionId], context.previousSession);
      }
      if (context?.changeId) {
        setPendingChanges(prev =>
          prev.map(c => c.id === context.changeId ? { ...c, status: 'error' } : c)
        );
      }
    },
    onSuccess: (data, variables, context) => {
      if (context?.changeId) {
        setPendingChanges(prev => prev.filter(c => c.id !== context.changeId));
      }
      setLastSyncTime(new Date());
    }
  });

  // Batch sync drafts on navigation
  useEffect(() => {
    const syncDrafts = async () => {
      if (syncInProgressRef.current || draftQueueRef.current.size === 0) return;
      
      syncInProgressRef.current = true;
      
      try {
        for (const [key, value] of draftQueueRef.current) {
          const match = key.match(/interview_draft_${sessionId}_(\d+)_(\d+)/);
          if (match) {
            const sectionIndex = parseInt(match[1]);
            const questionIndex = parseInt(match[2]);
            
            await api.updateDraft(sessionId, questionIndex, value);
          }
        }
        
        // Clear synced drafts
        draftQueueRef.current.clear();
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('[useInterviewState] Batch sync failed:', error);
      } finally {
        syncInProgressRef.current = false;
      }
    };

    // Sync on section/question change
    const handleBeforeUnload = () => {
      if (draftQueueRef.current.size > 0) {
        // Use sendBeacon or sync XHR for unload
        const data = JSON.stringify({
          sessionId,
          drafts: Array.from(draftQueueRef.current.entries())
        });
        navigator.sendBeacon?.('/api/interview/sync-drafts', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Periodic sync
    const interval = setInterval(syncDrafts, 10000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
    };
  }, [sessionId]);

  // Action methods
  const updateCode = useCallback((
    sectionIndex: number,
    questionIndex: number,
    code: string
  ) => {
    codeMutation.mutate({ sectionIndex, questionIndex, code });
  }, [codeMutation]);

  const updateAnswer = useCallback((
    sectionIndex: number,
    questionIndex: number,
    answer: string
  ) => {
    answerMutation.mutate({ sectionIndex, questionIndex, answer });
  }, [answerMutation]);

  const submitQuestion = useCallback(async (
    sectionIndex: number,
    questionIndex: number
  ): Promise<void> => {
    // First sync any pending changes
    if (draftQueueRef.current.size > 0) {
      await codeMutation.mutateAsync({
        sectionIndex,
        questionIndex,
        code: draftQueueRef.current.get(
          `interview_draft_${sessionId}_${sectionIndex}_${questionIndex}`
        ) || ''
      });
    }

    // Then submit
    await api.submitInterviewCode(sessionId, questionIndex);
    
    // Invalidate cache to get updated state
    await queryClient.invalidateQueries({ queryKey: ['interview', sessionId] });
  }, [sessionId, codeMutation, queryClient]);

  const resolveConflict = useCallback((
    questionKey: string,
    resolution: 'server' | 'local' | 'merge'
  ) => {
    const conflict = conflicts.find(c => c.questionKey === questionKey);
    if (!conflict) return;

    const [sectionIndex, questionIndex] = questionKey.split('-').map(Number);

    if (resolution === 'server') {
      // Accept server value - update local state
      queryClient.setQueryData<InterviewSession>(['interview', sessionId], (old) => {
        if (!old) return old;
        
        const newSections = [...old.sections];
        const section = { ...newSections[sectionIndex] };
        const questions = [...section.questions];
        
        // Determine if this is code or answer
        const question = questions[questionIndex];
        if (question.type === 'coding' || question.type === 'sql') {
          questions[questionIndex] = { ...question, userCode: conflict.serverValue };
        } else {
          questions[questionIndex] = { ...question, userAnswer: conflict.serverValue };
        }
        
        section.questions = questions;
        newSections[sectionIndex] = section;
        
        return { ...old, sections: newSections };
      });
    } else if (resolution === 'local') {
      // Keep local value - re-sync to server
      if (session?.sections[sectionIndex]?.questions[questionIndex]?.type === 'coding') {
        codeMutation.mutate({ sectionIndex, questionIndex, code: conflict.localValue });
      } else {
        answerMutation.mutate({ sectionIndex, questionIndex, answer: conflict.localValue });
      }
    }

    // Mark conflict as resolved
    setConflicts(prev =>
      prev.map(c =>
        c.questionKey === questionKey
          ? { ...c, resolved: true, resolution }
          : c
      )
    );

    // Remove from pending changes
    setPendingChanges(prev =>
      prev.filter(c => 
        !(c.sectionIndex === sectionIndex && c.questionIndex === questionIndex && c.status === 'conflict')
      )
    );
  }, [conflicts, session, sessionId, queryClient, codeMutation, answerMutation]);

  return {
    session: session || null,
    isLoading,
    isSyncing,
    pendingChanges,
    conflicts,
    updateCode,
    updateAnswer,
    submitQuestion,
    resolveConflict,
    currentSection,
    currentQuestion,
    setCurrentSection,
    setCurrentQuestion,
    syncStatus,
    lastSyncTime
  };
}
