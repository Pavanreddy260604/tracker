import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNutritionSummary, getDailyLog, logNutritionEntry, getQuickAddFoods, deleteNutritionEntry } from '../api/nutritionApi';
import { MacroRings } from '../components/premium/MacroRings';
import { PremiumFoodSearch } from '../components/premium/PremiumFoodSearch';
import { QuickAddSection } from '../components/premium/QuickAddSection';
import { DailyEntryList } from '../components/shared/DailyEntryList';
import { Button } from '../components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const NutritionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [quickAdds, setQuickAdds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingFood, setLoggingFood] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const fetchNutritionData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [sumData, logData, quickData] = await Promise.all([
        getNutritionSummary(dateStr),
        getDailyLog(dateStr).catch(() => ({ entries: [] })),
        getQuickAddFoods().catch(() => []),
      ]);
      setSummary(sumData);
      setEntries(logData?.entries || []);
      setQuickAdds(quickData || []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load nutrition data';
      setError(msg);
      toast.error('Failed to load nutrition data', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchNutritionData();
  }, [fetchNutritionData]);

  const handleSelectFood = async (food: any) => {
    setLoggingFood(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      // Backend expects: { description, servings, calories, protein, carbohydrates, fats }
      await logNutritionEntry(dateStr, {
        description: food.description || food.name || 'Unknown Food',
        servings: food.servings ?? 1,
        calories: Math.round(food.calories ?? food.macros?.calories ?? 0),
        protein: Number((food.protein ?? food.macros?.protein ?? 0).toFixed(1)),
        carbohydrates: Number((food.carbs ?? food.carbohydrates ?? food.macros?.carbs ?? 0).toFixed(1)),
        fats: Number((food.fats ?? food.macros?.fats ?? 0).toFixed(1)),
      });
      toast.success(`Logged ${food.name}`);
      fetchNutritionData();
    } catch (err: any) {
      toast.error('Failed to log food', { description: err?.response?.data?.message });
    } finally {
      setLoggingFood(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteNutritionEntry(id);
      toast.success('Entry removed');
      fetchNutritionData();
    } catch (err: any) {
      toast.error('Failed to delete entry', { description: err?.response?.data?.message });
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value + 'T12:00:00'));
    }
  };

  const adjustDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    setSelectedDate(next);
  };

  // Derive targets safely (backend now returns targets in response)
  const targets = summary?.targets || { calories: 2000, protein: 150, carbohydrates: 200, fats: 60 };
  const totals = summary?.totals || { calories: 0, protein: 0, carbohydrates: 0, fats: 0 };

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500 pb-24">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Nutrition</h1>
            <div className="flex items-center justify-center space-x-2">
              <button onClick={() => adjustDate(-1)} className="p-1 hover:text-primary transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-xs font-bold text-foreground min-w-[120px] text-center">
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <button
                onClick={() => adjustDate(1)}
                disabled={selectedDate.toDateString() === new Date().toDateString()}
                className="p-1 hover:text-primary transition-colors disabled:opacity-20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
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

        {error && (
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchNutritionData} className="ml-auto">Retry</Button>
          </div>
        )}

        <main className="grid gap-8 lg:grid-cols-2 lg:items-start">
          {/* Left Column - Macros and Stats */}
          <div className="space-y-8">
            {loading ? (
              <div className="h-[400px] w-full bg-muted animate-pulse rounded-3xl" />
            ) : (
              <MacroRings
                calories={{ current: totals.calories, target: targets.calories }}
                macros={[
                  { label: 'Protein', current: totals.protein, target: targets.protein, color: '#3b82f6', unit: 'g' },
                  { label: 'Carbs', current: totals.carbohydrates, target: targets.carbohydrates, color: '#f59e0b', unit: 'g' },
                  { label: 'Fats', current: totals.fats, target: targets.fats, color: '#10b981', unit: 'g' },
                ]}
              />
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
              <PremiumFoodSearch onSelect={handleSelectFood} disabled={loggingFood} />
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
