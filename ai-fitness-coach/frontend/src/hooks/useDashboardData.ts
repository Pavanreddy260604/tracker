import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const response = await apiClient.get('/api/v1/coach/today');
        setPlan(response.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, []);

  return { plan, loading, error };
};

export const useStreak = () => {
  const [streak, setStreak] = useState<{ current: number; hasFreeze: boolean; isFreezeActive: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const response = await apiClient.get('/api/v1/auth/streak');
        setStreak(response.data);
      } catch (err: any) {
        console.error('Failed to fetch streak', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStreak();
  }, []);

  return { streak, loading };
};

export const useNutritionProgress = () => {
  const [progress, setProgress] = useState<{ currentCalories: number; currentProtein: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await apiClient.get(`/api/v1/nutrition/summary/${today}`);
        setProgress({
          currentCalories: response.data.currentCalories || 0,
          currentProtein: response.data.currentProtein || 0
        });
      } catch (err: any) {
        console.error('Failed to fetch nutrition progress', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  return { progress, loading };
};
