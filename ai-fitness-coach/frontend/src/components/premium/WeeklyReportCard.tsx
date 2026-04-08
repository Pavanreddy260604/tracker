import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Target, Award } from 'lucide-react';

interface WeeklyReportCardProps {
  totalVolume: number;
  adherenceScore: number;
  status: 'PROGRESSING' | 'STAGNANT' | 'REGRESSING';
  highlights: string[];
  className?: string;
}

export const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({
  totalVolume,
  adherenceScore,
  status,
  highlights,
  className,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'PROGRESSING': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'REGRESSING': return <TrendingDown className="h-4 w-4 text-rose-500" />;
      default: return <Minus className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'PROGRESSING': return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case 'REGRESSING': return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default: return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent";
    }
  };

  return (
    <Card className={cn(
      "p-6 space-y-6 transition-all duration-300",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-md",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="font-black tracking-tight text-foreground uppercase text-xs">Weekly Performance</h3>
        </div>
        <div className={cn("flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold border", getStatusColor())}>
          {getStatusIcon()}
          <span>{status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Volume</p>
          <p className="text-2xl font-black text-foreground">{totalVolume.toLocaleString()} <span className="text-xs font-normal">kg</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Adherence</p>
          <div className="flex items-baseline space-x-1">
            <p className="text-2xl font-black text-foreground">{adherenceScore}%</p>
            <div className="h-1.5 w-8 rounded-full bg-primary/20 overflow-hidden">
               <div className="h-full bg-primary" style={{ width: `${adherenceScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase text-muted-foreground">
          <Target className="h-3 w-3" />
          <span>Key Highlights</span>
        </div>
        <ul className="space-y-2">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start space-x-3 text-sm text-foreground/80 group">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 group-hover:scale-150 transition-transform" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
