import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Info, RefreshCw, FastForward } from 'lucide-react';

interface Set {
  weight: number;
  reps: number;
  difficultyRating?: number;
}

interface ActiveExerciseCardProps {
  exerciseId: string;
  name: string;
  targetSets: number;
  loggedSets: Set[];
  onLogSet: (data: Set) => Promise<void>;
  onSubstitute: () => void;
  onSkip?: () => void;
  className?: string;
}

export const ActiveExerciseCard: React.FC<ActiveExerciseCardProps> = ({
  name,
  targetSets,
  loggedSets,
  onLogSet,
  onSubstitute,
  onSkip,
  className,
}) => {
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [rpe, setRpe] = useState<string>('3'); // Default 3 (average)
  const [isLogging, setIsLogging] = useState(false);

  const handleLog = async () => {
    if (!weight || !reps) return;
    setIsLogging(true);
    try {
      await onLogSet({
        weight: parseFloat(weight),
        reps: parseInt(reps),
        difficultyRating: parseInt(rpe)
      });
      // Don't reset weight, usually people keep same weight
      setReps('');
    } finally {
      setIsLogging(false);
    }
  };

  const progress = Math.min((loggedSets.length / targetSets) * 100, 100);

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-lg",
      className
    )}>
      {/* Progress Bar Header */}
      <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tight text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">Target: {targetSets} Sets</p>
          </div>
          <div className="flex flex-col space-y-2">
            <Button variant="outline" size="sm" onClick={onSubstitute} className="rounded-full text-[10px] h-8">
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Substitute
            </Button>
            {onSkip && (
              <Button variant="ghost" size="sm" onClick={onSkip} className="rounded-full text-[10px] h-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                <FastForward className="mr-1.5 h-3 w-3" />
                Skip
              </Button>
            )}
          </div>
        </div>

        {/* History of sets */}
        <div className="space-y-2">
          {loggedSets.map((set, i) => (
            <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-left duration-300">
              <span className="font-bold text-primary">Set {i + 1}</span>
              <span className="text-foreground">{set.weight}kg × {set.reps} reps</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">
                RPE {set.difficultyRating}
              </span>
            </div>
          ))}
          {loggedSets.length === 0 && (
            <div className="text-center py-4 border border-dashed rounded-lg text-muted-foreground text-xs">
              Next up: Set 1
            </div>
          )}
        </div>

        {/* Log Input Form */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Weight</label>
            <Input 
              type="number" 
              placeholder="kg" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="text-center h-12 bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Reps</label>
            <Input 
              type="number" 
              placeholder="reps" 
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="text-center h-12 bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">RPE</label>
            <select 
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full rounded-md h-12 bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 px-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <Button 
          className={cn("w-full h-12 font-bold transition-all", loggedSets.length >= targetSets && "bg-emerald-500 hover:bg-emerald-600")}
          onClick={handleLog}
          disabled={isLogging || !weight || !reps}
        >
          {isLogging ? "Logging..." : loggedSets.length >= targetSets ? "Extra Set" : "Log Set"}
          <Check className="ml-2 h-4 w-4" />
        </Button>

        <div className="flex items-center space-x-2 text-[10px] text-muted-foreground bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <Info className="h-3 w-3 text-primary flex-shrink-0" />
          <p>
            RPE 5 = Very hard (Failure). RPE 1 = Very easy (Warmup).
          </p>
        </div>
      </div>
    </Card>
  );
};
