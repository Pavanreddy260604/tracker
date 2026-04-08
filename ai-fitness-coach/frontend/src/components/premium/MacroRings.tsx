import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface MacroStat {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
}

interface MacroRingsProps {
  calories: { current: number; target: number };
  macros: MacroStat[];
  className?: string;
}

const Ring = ({ size, stroke, progress, color, className }: any) => {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn("transform -rotate-90", className)}>
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
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

export const MacroRings: React.FC<MacroRingsProps> = ({
  calories,
  macros,
  className,
}) => {
  const calProgress = Math.min((calories.current / calories.target) * 100, 100);

  return (
    <Card className={cn(
      "p-8 flex flex-col items-center space-y-8 transition-all duration-300",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-xl",
      className
    )}>
      <div className="relative flex items-center justify-center">
        {/* Outer Calorie Ring */}
        <Ring 
          size={200} 
          stroke={12} 
          progress={calProgress} 
          color="hsl(var(--primary))" 
        />
        
        {/* Inner Macro Rings (Stacked/Nested) */}
        <div className="absolute inset-0 flex items-center justify-center">
            {macros.map((macro, i) => (
               <Ring 
                key={macro.label}
                size={160 - (i * 30)} 
                stroke={8} 
                progress={Math.min((macro.current / macro.target) * 100, 100)} 
                color={macro.color}
                className="absolute"
              />
            ))}
        </div>

        {/* Center Text */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black text-foreground">{calories.current}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">kcal left</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full pt-4">
        {macros.map((macro) => {
          const isProteinDeficit = macro.label === 'Protein' && macro.current < macro.target * 0.8;
          return (
            <div key={macro.label} className="flex flex-col items-center space-y-1 relative">
              <div className="flex items-center space-x-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: macro.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{macro.label}</span>
              </div>
              <p className="text-sm font-black text-foreground">{macro.current}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">{macro.unit}</span></p>
              {isProteinDeficit && (
                <div className="absolute -top-1 -right-2 transform translate-x-1/2 -translate-y-1/2 group" title="Protein is below 80% target!">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping absolute opacity-75" />
                  <div className="h-2 w-2 rounded-full bg-amber-500 relative" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
