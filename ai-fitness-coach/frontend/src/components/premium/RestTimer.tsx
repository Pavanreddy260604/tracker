import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, SkipForward } from 'lucide-react';
import { vibrate } from '@/lib/haptics';

interface RestTimerProps {
  durationSeconds?: number;
  onComplete: () => void;
  onSkip: () => void;
  className?: string;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  durationSeconds = 90,
  onComplete,
  onSkip,
  className,
}) => {
  const [remaining, setRemaining] = useState(durationSeconds);
  // Use a ref so the interval callback always has the latest onComplete without
  // being listed as a useEffect dependency (avoids interval being reset every render).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          vibrate('success');
          onCompleteRef.current();
          return 0;
        }
        if (prev <= 4) vibrate('light');
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  const addTime = () => setRemaining((p) => p + 30);
  const progress = ((durationSeconds - remaining) / durationSeconds) * 100;

  const size = 180;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <Card className={cn(
      'p-8 flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95 duration-500',
      'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl',
      className
    )}>
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Rest Period</h4>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            className="text-zinc-100 dark:text-zinc-800"
          />
          <circle
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn(
            'text-4xl font-black tabular-nums tracking-tight',
            remaining <= 3 ? 'text-primary animate-pulse scale-110' : 'text-foreground'
          )}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">remaining</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Button variant="outline" size="sm" onClick={addTime} className="rounded-full">
          <Plus className="h-3 w-3 mr-1" /> 30s
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip} className="rounded-full text-muted-foreground">
          <SkipForward className="h-3 w-3 mr-1" /> Skip
        </Button>
      </div>
    </Card>
  );
};
