import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Flame, Snowflake } from 'lucide-react';

interface StreakDisplayProps {
  count: number;
  hasFreeze: boolean;
  isFreezeActive: boolean;
  className?: string;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  count,
  hasFreeze,
  isFreezeActive,
  className,
}) => {
  const milestones = [7, 14, 30, 50, 100, 365];
  const isMilestone = milestones.includes(count);

  return (
    <Card className={cn(
      "group relative overflow-hidden p-6 transition-all duration-500",
      "bg-gradient-to-br from-orange-500/10 to-transparent dark:from-orange-500/20",
      "border-orange-200/50 dark:border-orange-800/50 hover:border-orange-500/50",
      className
    )}>
      {/* Background Icon Watermark */}
      <Flame className="absolute -bottom-6 -right-6 h-32 w-32 text-orange-500/5 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-12" />

      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-orange-500/20 rounded-full animate-pulse" />
          <div className={cn(
            "relative rounded-full bg-orange-500 p-4 text-white shadow-xl transform transition-transform group-hover:scale-110",
            isMilestone ? "shadow-yellow-400/50 ring-4 ring-yellow-400 animate-pulse" : "shadow-orange-500/40"
          )}>
            <Flame className={cn("h-10 w-10", count > 0 ? "animate-bounce" : "opacity-50")} />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className={cn(
            "text-5xl font-black tracking-tighter drop-shadow-sm",
            isMilestone ? "bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-transparent bg-clip-text animate-text" : "text-foreground"
          )}>
            {count}
          </h2>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500/80">
            Day Streak
          </p>
        </div>

        {hasFreeze && (
          <button className={cn(
            "flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
            isFreezeActive 
              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20 cursor-default" 
              : "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 cursor-pointer"
          )}
          onClick={(e) => {
            if (!isFreezeActive) {
              e.preventDefault();
              alert("Freeze feature coming in Task 25!"); // Placeholder
            }
          }}>
            <Snowflake className="h-3 w-3" />
            <span>{isFreezeActive ? 'Streak Frozen' : 'Use Freeze'}</span>
          </button>
        )}
      </div>

      {isMilestone && (
        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-yellow-500 animate-pulse">
          🏆 Milestone Reached!
        </p>
      )}

      {count === 0 && !isMilestone && (
        <p className="mt-4 text-center text-xs text-muted-foreground italic">
          Start today to begin your streak!
        </p>
      )}
    </Card>
  );
};
