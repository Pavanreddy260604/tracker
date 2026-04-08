import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, Plus, Utensils, X, Loader2 } from 'lucide-react';
import { searchFood } from '@/api/nutritionApi';

interface FoodItem {
  _id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
}

interface PremiumFoodSearchProps {
  onSelect: (food: FoodItem) => void;
  className?: string;
}

export const PremiumFoodSearch: React.FC<PremiumFoodSearchProps> = ({ onSelect, className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchFood(query);
        setResults(data);
      } catch (error) {
        console.error('Search failed', error);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Search for a food..." 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          className="h-14 pl-12 pr-12 rounded-2xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-xl focus:ring-2 focus:ring-primary/20 transition-all text-lg font-medium"
        />
        {query && (
          <button 
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (query.length >= 2 || loading) && (
        <Card className="absolute top-full mt-3 w-full z-50 overflow-hidden bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl">
          <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground italic space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Searching database...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((food) => (
                <button
                  key={food._id}
                  onClick={() => {
                    onSelect(food);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                      <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground group-hover:text-primary transition-colors">{food.name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{food.servingSize}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground">{food.calories} <span className="text-[10px] font-normal text-muted-foreground">kcal</span></p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[10px] text-blue-500 font-bold">P: {food.protein}g</span>
                      <span className="text-[10px] text-amber-500 font-bold">C: {food.carbs}g</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center space-y-3">
                <Utensils className="h-10 w-10 opacity-10" />
                <p className="text-sm">No foods found matching "{query}"</p>
              </div>
            )}
          </div>
          {results.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center">
                 <Plus className="h-3 w-3 mr-1" />
                 Don't see it? Add custom item
               </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
