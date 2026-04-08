import React from 'react';
import { cn } from '@/lib/utils';
import { Utensils, Clock, Trash2 } from 'lucide-react';

interface Entry {
  _id: string;
  name: string;
  calories: number;
  protein: number;
  servingSize: string;
  loggedAt?: string;
}

interface DailyEntryListProps {
  entries: Entry[];
  onDelete?: (id: string) => void;
  className?: string;
}

export const DailyEntryList: React.FC<DailyEntryListProps> = ({
  entries,
  onDelete,
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Logged Today</h3>
        <span className="text-[10px] font-bold text-muted-foreground">{entries.length} Items</span>
      </div>

      <div className="space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div 
              key={entry._id}
              className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm animate-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{entry.name}</p>
                  <div className="flex items-center space-x-2 text-[10px] text-muted-foreground font-medium uppercase">
                    <Clock className="h-3 w-3" />
                    <span>{entry.loggedAt ? new Date(entry.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}</span>
                    <span>•</span>
                    <span>{entry.servingSize}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">{entry.calories} <span className="text-[10px] font-normal text-muted-foreground">kcal</span></p>
                  <p className="text-[10px] text-blue-500 font-bold uppercase">P: {entry.protein}g</p>
                </div>
                {onDelete && (
                  <button 
                    onClick={() => onDelete(entry._id)}
                    className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-3xl opacity-50">
             <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Utensils className="h-6 w-6 text-muted-foreground" />
             </div>
             <div className="space-y-1">
                <p className="font-bold text-sm">Empty Stomach?</p>
                <p className="text-xs text-muted-foreground">Search and log your first meal of the day.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
