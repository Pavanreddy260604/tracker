import React from 'react';
import { cn } from '@/lib/utils';
import { Plus, Clock } from 'lucide-react';

interface QuickFood {
  _id: string;
  name: string;
  calories: number;
}

interface QuickAddSectionProps {
  foods: QuickFood[];
  onQuickAdd: (food: QuickFood) => void;
  className?: string;
}

export const QuickAddSection: React.FC<QuickAddSectionProps> = ({
  foods,
  onQuickAdd,
  className,
}) => {
  if (foods.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center space-x-2 px-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Quick Add</h4>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {foods.map((food) => (
          <button
            key={food._id}
            onClick={() => onQuickAdd(food)}
            className="flex-shrink-0 flex items-center space-x-2 px-4 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <Plus className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-bold text-foreground whitespace-nowrap">{food.name}</span>
            <span className="text-[10px] text-muted-foreground">{food.calories}kcal</span>
          </button>
        ))}
      </div>
    </div>
  );
};
