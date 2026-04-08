import axios from 'axios';
import * as metricService from './MetricService';

const WORKOUT_SERVICE_URL = process.env.WORKOUT_SERVICE_URL || 'http://localhost:3002';
const NUTRITION_SERVICE_URL = process.env.NUTRITION_SERVICE_URL || 'http://localhost:3003';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export interface WeeklyReport {
  userId: string;
  startDate: Date;
  endDate: Date;
  metrics: {
    startWeight: number;
    currentWeight: number;
    weightChange: number;
  };
  workoutSummary: {
    totalVolume: number;
    sessionCount: number;
  };
  nutritionSummary: {
    avgCalories: number;
    daysLogged: number;
  };
  streak: {
    current: number;
    longest: number;
  };
  status: 'progressing' | 'stagnant' | 'regressing';
}

export const generateWeeklyReport = async (userId: string): Promise<WeeklyReport> => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  // 1. Fetch weight metrics
  const history = await metricService.getMetricHistory(userId, 'weight', 30);
  const currentWeight = history.length > 0 ? history[0].value : 0;
  const startWeight = history.length > 7 ? history[7].value : (history.length > 0 ? history[history.length - 1].value : 0);
  const weightChange = Number((currentWeight - startWeight).toFixed(1));

  // 2. Fetch workout summary (Internal call)
  let workoutSummary = { totalVolume: 0, sessionCount: 0 };
  try {
    const response = await axios.get(`${WORKOUT_SERVICE_URL}/api/v1/internal/workout-volume/${userId}`);
    workoutSummary = response.data;
  } catch (error) {
    console.error('Failed to fetch workout summary:', error);
  }

  // 3. Fetch nutrition summary (Internal call)
  let nutritionSummary = { avgCalories: 0, daysLogged: 0 };
  try {
    const response = await axios.get(`${NUTRITION_SERVICE_URL}/api/v1/internal/nutrition-adherence/${userId}`);
    nutritionSummary = response.data;
  } catch (error) {
    console.error('Failed to fetch nutrition summary:', error);
  }

  // 4. Fetch streak (from auth service)
  let streak = { current: 0, longest: 0 };
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/v1/internal/auth/streak/${userId}`);
    streak = response.data;
  } catch (error) {
    console.error('Failed to fetch streak info:', error);
  }

  // 5. Detect Status
  const status = detectProgressStatus(weightChange, workoutSummary.totalVolume);

  return {
    userId,
    startDate,
    endDate,
    metrics: {
      startWeight,
      currentWeight,
      weightChange
    },
    workoutSummary,
    nutritionSummary,
    streak,
    status
  };
};

export const detectProgressStatus = (weightChange: number, totalVolume: number): 'progressing' | 'stagnant' | 'regressing' => {
  // Simple heuristic for now: 
  // If weight is stable and volume is > 0, it's progressing (building muscle/toning)
  // If weight is regressing (based on goal, but here we'll assume weight loss is usually positive)
  
  if (totalVolume > 0) {
    return 'progressing';
  }
  
  if (Math.abs(weightChange) < 0.2 && totalVolume === 0) {
    return 'stagnant';
  }

  return 'progressing'; // Default to positive reinforcement
};
