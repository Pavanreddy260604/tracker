import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';

export interface TodayPlan {
  workoutType: 'workout' | 'rest';
  workoutName?: string;
  exercises?: any[];
  nutritionTargets: {
    calories: number;
    protein: number;
  };
}

export const useTodayPlan = () => {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/coach/today');
      setPlan(response.data);
    } catch (err: any) {
      setError(err.message);
      // Provide a sensible fallback so UI doesn't break
      setPlan({ workoutType: 'rest', nutritionTargets: { calories: 2000, protein: 150 } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, loading, error, refetch: fetchPlan };
};

export const useStreak = () => {
  const [streak, setStreak] = useState<{ current: number; longest: number; hasFreeze: boolean; isFreezeActive: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/v1/auth/streak');
      const data = response.data;
      setStreak({
        current: data.current ?? data.streak?.current ?? 0,
        longest: data.longest ?? data.streak?.longest ?? 0,
        hasFreeze: data.freezeAvailable ?? !(data.streak?.freezeUsed),
        isFreezeActive: data.streak?.freezeUsed ?? false,
      });
    } catch (err: any) {
      console.error('Failed to fetch streak', err);
      setStreak({ current: 0, longest: 0, hasFreeze: false, isFreezeActive: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  return { streak, loading, refetch: fetchStreak };
};

export const useNutritionProgress = () => {
  const [progress, setProgress] = useState<{ currentCalories: number; currentProtein: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiClient.get(`/api/v1/nutrition/summary/${today}`);
      const data = response.data;
      setProgress({
        currentCalories: data.totals?.calories ?? 0,
        currentProtein: data.totals?.protein ?? 0,
      });
    } catch (err: any) {
      console.error('Failed to fetch nutrition progress', err);
      setProgress({ currentCalories: 0, currentProtein: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return { progress, loading, refetch: fetchProgress };
};
