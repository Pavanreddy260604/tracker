import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNutritionSummary, getDailyLog, logNutritionEntry, getQuickAddFoods, deleteNutritionEntry } from '../api/nutritionApi';
import { MacroRings } from '../components/premium/MacroRings';
import { PremiumFoodSearch } from '../components/premium/PremiumFoodSearch';
import { QuickAddSection } from '../components/premium/QuickAddSection';
import { DailyEntryList } from '../components/shared/DailyEntryList';
import { Button } from '../components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const NutritionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [quickAdds, setQuickAdds] = useState<any[]>([]);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const fetchNutritionData = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [sumData, logData, quickData] = await Promise.all([
        getNutritionSummary(dateStr),
        getDailyLog(dateStr),
        getQuickAddFoods().catch(() => []) // Fallback if not implemented
      ]);
      setSummary(sumData);
      setEntries(logData.entries || []);
      setQuickAdds(quickData || []);
    } catch (error) {
      // Handle silently for now
    }
  };

  useEffect(() => {
    fetchNutritionData();
  }, [selectedDate]);

  const handleSelectFood = async (food: any) => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await logNutritionEntry(dateStr, {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        servingSize: food.servingSize
      });
      toast.success(`Logged ${food.name}`);
      fetchNutritionData();
    } catch (error) {
      toast.error("Failed to log food");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteNutritionEntry(id);
      toast.success("Entry removed");
      fetchNutritionData();
    } catch (error) {
      toast.error("Failed to delete entry");
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  const adjustDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    setSelectedDate(next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Nutrition</h1>
            <div className="flex items-center justify-center space-x-2">
              <button onClick={() => adjustDate(-1)} className="p-1 hover:text-primary transition-colors"><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-xs font-bold text-foreground min-w-[120px]">
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <button 
                onClick={() => adjustDate(1)} 
                disabled={selectedDate.toDateString() === new Date().toDateString()}
                className="p-1 hover:text-primary transition-colors disabled:opacity-20"
              ><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => dateInputRef.current?.showPicker()}>
              <Calendar className="h-5 w-5" />
            </Button>
            <input 
              type="date"
              ref={dateInputRef}
              onChange={handleDateChange}
              className="absolute opacity-0 -z-10 pointer-events-none"
              value={selectedDate.toISOString().split('T')[0]}
            />
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-2 lg:items-start">
          {/* Left Column - Macros and Stats */}
          <div className="space-y-8">
            {summary ? (
              <MacroRings 
                calories={{
                  current: summary.remainingCalories,
                  target: summary.targets.calories
                }}
                macros={[
                  { label: 'Protein', current: summary.totals.protein, target: summary.targets.protein, color: '#3b82f6', unit: 'g' },
                  { label: 'Carbs', current: summary.totals.carbohydrates, target: summary.targets.carbohydrates, color: '#f59e0b', unit: 'g' },
                  { label: 'Fats', current: summary.totals.fats, target: summary.targets.fats, color: '#10b981', unit: 'g' },
                ]}
              />
            ) : (
                <div className="h-[400px] w-full bg-muted animate-pulse rounded-3xl" />
            )}

            <div className="hidden lg:block">
               <DailyEntryList entries={entries} onDelete={handleDeleteEntry} />
            </div>
          </div>

          {/* Right Column - Search and Interactions */}
          <div className="space-y-8">
            <div className="space-y-4">
               <h2 className="text-2xl font-black tracking-tighter">Add Nutrition</h2>
               <QuickAddSection foods={quickAdds} onQuickAdd={handleSelectFood} />
               <PremiumFoodSearch onSelect={handleSelectFood} />
            </div>

            <div className="lg:hidden">
               <DailyEntryList entries={entries} onDelete={handleDeleteEntry} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default NutritionScreen;
