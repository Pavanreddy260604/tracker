import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isUp: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  className,
}) => {
  return (
    <Card className={cn(
      "relative overflow-hidden p-6 transition-all duration-300",
      "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border-zinc-200/50 dark:border-zinc-800/50",
      "hover:shadow-xl hover:shadow-zinc-200/20 dark:hover:shadow-zinc-950/20",
      "hover:border-zinc-300 dark:hover:border-zinc-700",
      className
    )}>
      {/* Decorative gradient background */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-3xl transition-all duration-500 group-hover:bg-primary/10" />
      
      <div className="flex items-center justify-between space-x-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground transition-colors">
            {title}
          </p>
          <div className="flex items-baseline space-x-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </h2>
            {trend && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                trend.isUp 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}>
                {trend.isUp ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        
        {icon && (
          <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-sm transition-transform hover:scale-105">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
