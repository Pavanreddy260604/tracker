import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Utensils } from 'lucide-react';

interface NutritionProgressProps {
  calories: {
    current: number;
    target: number;
  };
  protein: {
    current: number;
    target: number;
  };
  className?: string;
}

export const NutritionProgress: React.FC<NutritionProgressProps> = ({
  calories,
  protein,
  className,
}) => {
  const calPercentage = Math.min((calories.current / calories.target) * 100, 100);
  const proteinPercentage = Math.min((protein.current / protein.target) * 100, 100);

  return (
    <Card className={cn(
      "p-6 space-y-6 transition-all duration-300",
      "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Utensils className="h-5 w-5 text-orange-500" />
          <h3 className="font-bold tracking-tight text-foreground">Fueling</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Goal</span>
      </div>

      <div className="space-y-6">
        {/* Calories Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Calories</span>
            <span className="font-bold">{calories.current} / {calories.target} kcal</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${calPercentage}%` }}
            />
          </div>
        </div>

        {/* Protein Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Protein</span>
            <span className="font-bold">{protein.current} / {protein.target} g</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${proteinPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
          Consistent macro tracking is verified to increase progress speed by up to 2x. Keep it up!
        </p>
      </div>
    </Card>
  );
};
