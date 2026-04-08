import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Exercise {
  exerciseId: string;
  name: string;
  sets: number;
}

interface DailyPlanCardProps {
  type: 'workout' | 'rest';
  workoutName?: string;
  exercises?: Exercise[];
  className?: string;
}

export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({
  type,
  workoutName,
  exercises = [],
  className,
}) => {
  const navigate = useNavigate();

  if (type === 'rest') {
    return (
      <Card className={cn(
        "relative p-6 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4",
        "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800",
        className
      )}>
        <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-3 text-zinc-400">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Rest Day</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Time to recover and grow. Stay active with light walking!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "group relative overflow-hidden p-6 transition-all duration-300",
      "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
      "hover:ring-2 hover:ring-primary/20",
      className
    )}>
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-start justify-between">
        <div className="space-y-4 w-full">
          <div className="flex items-center space-x-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Dumbbell className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {workoutName || "Today's Grind"}
            </h3>
          </div>

          <div className="space-y-3">
            {exercises.slice(0, 3).map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ex.name}</span>
                <span className="font-medium text-foreground">{ex.sets} Sets</span>
              </div>
            ))}
            {exercises.length > 3 && (
              <p className="text-xs text-muted-foreground italic">
                + {exercises.length - 3} more exercises
              </p>
            )}
          </div>

          <Button 
            className="w-full mt-4 group/btn" 
            onClick={() => navigate('/workout')}
          >
            Start Session
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
