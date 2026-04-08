import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  icon?: string;
}

interface EquipmentSelectorProps {
  available: Equipment[];
  selected: string[];
  onChange: (selectedIds: string[]) => void;
  className?: string;
}

export const EquipmentSelector: React.FC<EquipmentSelectorProps> = ({
  available,
  selected,
  onChange,
  className,
}) => {
  const toggleSelection = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Gym Equipment</h3>
        <span className="text-[10px] font-bold text-muted-foreground">{selected.length} / {available.length} Selected</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {available.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleSelection(item.id)}
              className={cn(
                "group relative p-4 pl-10 rounded-2xl text-left transition-all duration-300 border outline-none",
                isSelected 
                  ? "bg-primary/10 border-primary shadow-lg ring-1 ring-primary" 
                  : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              <div className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected ? "bg-primary border-primary" : "border-zinc-200 dark:border-zinc-800"
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className={cn(
                "text-xs font-bold transition-colors",
                isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
