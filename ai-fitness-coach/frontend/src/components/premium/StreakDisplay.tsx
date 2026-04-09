import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Flame, Snowflake, Trophy } from 'lucide-react';
import apiClient from '@/api/apiClient';
import { toast } from 'sonner';

interface StreakDisplayProps {
  count: number;
  longest?: number;
  hasFreeze: boolean;
  isFreezeActive: boolean;
  onFreezeUsed?: () => void;
  className?: string;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  count,
  longest = 0,
  hasFreeze,
  isFreezeActive,
  onFreezeUsed,
  className,
}) => {
  const [freezeLoading, setFreezeLoading] = useState(false);
  const milestones = [7, 14, 30, 50, 100, 365];
  const isMilestone = milestones.includes(count);

  const handleUseFreeze = async () => {
    if (isFreezeActive || freezeLoading) return;
    setFreezeLoading(true);
    try {
      await apiClient.post('/api/v1/auth/activity', { useFreeze: true });
      toast.success('Streak frozen!', { description: 'Your streak is protected for today.' });
      onFreezeUsed?.();
    } catch (err: any) {
      toast.error('Failed to use freeze', { description: err?.response?.data?.message || 'Please try again.' });
    } finally {
      setFreezeLoading(false);
    }
  };

  return (
    <Card className={cn(
      'group relative overflow-hidden p-6 transition-all duration-500',
      'bg-gradient-to-br from-orange-500/10 to-transparent dark:from-orange-500/20',
      'border-orange-200/50 dark:border-orange-800/50 hover:border-orange-500/50',
      className
    )}>
      {/* Background Icon Watermark */}
      <Flame className="absolute -bottom-6 -right-6 h-32 w-32 text-orange-500/5 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-12" />

      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-orange-500/20 rounded-full animate-pulse" />
          <div className={cn(
            'relative rounded-full bg-orange-500 p-4 text-white shadow-xl transform transition-transform group-hover:scale-110',
            isMilestone ? 'shadow-yellow-400/50 ring-4 ring-yellow-400 animate-pulse' : 'shadow-orange-500/40'
          )}>
            <Flame className={cn('h-10 w-10', count > 0 ? 'animate-bounce' : 'opacity-50')} />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className={cn(
            'text-5xl font-black tracking-tighter drop-shadow-sm',
            isMilestone
              ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-transparent bg-clip-text'
              : 'text-foreground'
          )}>
            {count}
          </h2>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500/80">
            Day Streak
          </p>
          {longest > 0 && (
            <div className="flex items-center justify-center space-x-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Trophy className="h-3 w-3" />
              <span>Best: {longest} days</span>
            </div>
          )}
        </div>

        {hasFreeze && (
          <button
            className={cn(
              'flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all',
              isFreezeActive
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 cursor-default'
                : freezeLoading
                ? 'bg-zinc-500/10 text-zinc-400 cursor-wait opacity-60'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 cursor-pointer'
            )}
            onClick={handleUseFreeze}
            disabled={isFreezeActive || freezeLoading}
          >
            <Snowflake className={cn('h-3 w-3', freezeLoading && 'animate-spin')} />
            <span>{isFreezeActive ? 'Streak Frozen' : freezeLoading ? 'Activating...' : 'Use Freeze'}</span>
          </button>
        )}
      </div>

      {isMilestone && (
        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-yellow-500 animate-pulse">
          🏆 Milestone Reached!
        </p>
      )}

      {count === 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground italic">
          Start today to begin your streak!
        </p>
      )}
    </Card>
  );
};
