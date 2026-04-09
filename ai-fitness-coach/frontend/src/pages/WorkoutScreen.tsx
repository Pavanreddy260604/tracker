import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getActiveSession,
  logSet as apiLogSet,
  completeSession as apiCompleteSession,
  substituteExercise,
  skipExercise,
} from '../api/workoutApi';
import { ActiveExerciseCard } from '../components/premium/ActiveExerciseCard';
import { SubstitutionModal } from '../components/premium/SubstitutionModal';
import { RestTimer } from '../components/premium/RestTimer';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseSet {
  setNumber: number;
  weight: number;
  reps: number;
  difficultyRating?: number;
  completedAt?: string;
}

interface SessionExercise {
  exerciseId: string;
  name?: string;
  plannedSets: number;
  sets: ExerciseSet[];
  skipped: boolean;
  skipReason?: string;
}

interface Session {
  _id: string;
  planId: string;
  exercises: SessionExercise[];
  status: 'active' | 'completed' | 'abandoned';
}

const WorkoutScreen: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isSubbing, setIsSubbing] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const skipInProgress = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const active = await getActiveSession();
        setSession(active);
      } catch (error: any) {
        if (error.response?.status === 404) {
          // No active session — show empty state, let user navigate to home to start one
        } else {
          toast.error('Failed to load session', { description: error?.response?.data?.message });
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogSet = async (data: { weight: number; reps: number; difficultyRating?: number }) => {
    if (!session) return;
    const currentEx = session.exercises[currentExerciseIndex];
    try {
      const response = await apiLogSet(session._id, currentEx.exerciseId, data);
      setSession(response.session);

      if (response.suggestion) {
        toast.info('AI Suggestion', { description: response.suggestion, duration: 5000 });
      }

      setShowRestTimer(true);
    } catch (error: any) {
      toast.error('Failed to log set', { description: error?.response?.data?.message });
    }
  };

  const handleSkip = async () => {
    if (!session || skipInProgress.current) return;
    skipInProgress.current = true;
    const currentEx = session.exercises[currentExerciseIndex];
    try {
      const response = await skipExercise(session._id, currentEx.exerciseId, 'Skipped by user');
      setSession(response.session);
      toast.success('Exercise skipped');
      if (currentExerciseIndex < session.exercises.length - 1) {
        setCurrentExerciseIndex(idx => idx + 1);
      }
    } catch (error: any) {
      toast.error('Failed to skip exercise', { description: error?.response?.data?.message });
    } finally {
      skipInProgress.current = false;
    }
  };

  const handleComplete = async () => {
    if (!session || completing) return;
    setCompleting(true);
    try {
      await apiCompleteSession(session._id, { rating: 3 });
      toast.success('Workout Complete!', {
        description: 'Great work today. The AI is processing your session data.',
      });
      navigate('/', { state: { workoutCompleted: true } });
    } catch (error: any) {
      toast.error('Failed to complete session', { description: error?.response?.data?.message });
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center space-x-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground font-medium">Loading session...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 text-center space-y-4 pb-24">
        <XCircle className="h-16 w-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">No Active Session</h2>
        <p className="text-muted-foreground">Start a session from the home screen to begin tracking.</p>
        <Button onClick={() => navigate('/')}>Back Home</Button>
      </div>
    );
  }

  const currentEx = session.exercises[currentExerciseIndex];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Active Session</h1>
          <p className="text-xs font-medium text-emerald-500">Syncing Live</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleComplete} disabled={completing}>
          {completing ? (
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          )}
        </Button>
      </header>

      {/* Progress Overview */}
      <div className="flex justify-between items-center px-2">
        <div className="flex space-x-1">
          {session.exercises.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === currentExerciseIndex
                  ? 'bg-primary w-12'
                  : i < currentExerciseIndex
                  ? 'bg-emerald-500/50 w-8'
                  : 'bg-zinc-200 dark:bg-zinc-800 w-8'
              )}
            />
          ))}
        </div>
        <span className="text-xs font-bold text-muted-foreground">
          {currentExerciseIndex + 1} / {session.exercises.length}
        </span>
      </div>

      <main className="max-w-md mx-auto relative">
        {showRestTimer ? (
          <RestTimer
            durationSeconds={currentEx?.plannedSets ? 90 : 60}
            onComplete={() => setShowRestTimer(false)}
            onSkip={() => setShowRestTimer(false)}
          />
        ) : (
          <ActiveExerciseCard
            exerciseId={currentEx.exerciseId}
            name={currentEx.name || `Exercise ${currentExerciseIndex + 1}`}
            targetSets={currentEx.plannedSets}
            loggedSets={currentEx.sets}
            onLogSet={handleLogSet}
            onSubstitute={() => setIsSubbing(true)}
            onSkip={handleSkip}
          />
        )}

        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            disabled={currentExerciseIndex === 0}
            onClick={() => setCurrentExerciseIndex(idx => idx - 1)}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="ghost"
            disabled={currentExerciseIndex === session.exercises.length - 1}
            onClick={() => setCurrentExerciseIndex(idx => idx + 1)}
          >
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>

      <SubstitutionModal
        exerciseId={currentEx.exerciseId}
        exerciseName={currentEx.name || `Exercise ${currentExerciseIndex + 1}`}
        isOpen={isSubbing}
        onOpenChange={setIsSubbing}
        onConfirm={async (subId) => {
          if (!session) return;
          try {
            const response = await substituteExercise(session._id, currentEx.exerciseId, subId);
            setSession(response.session);
            setIsSubbing(false);
            toast.success('Exercise swapped!');
          } catch (error: any) {
            toast.error('Failed to substitute exercise', { description: error?.response?.data?.message });
          }
        }}
      />
    </div>
  );
};

export default WorkoutScreen;
