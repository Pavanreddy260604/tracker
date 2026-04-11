import axios from 'axios';

const WORKOUT_SERVICE_URL = process.env.WORKOUT_SERVICE_URL || 'http://localhost:3002';
const NUTRITION_SERVICE_URL = process.env.NUTRITION_SERVICE_URL || 'http://localhost:3003';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export const getTodayOverview = async (userId: string, token: string) => {
  const date = new Date().toISOString().split('T')[0];
  const headers = { Authorization: `Bearer ${token}` };
  // Sunday=0 … Saturday=6
  const dayOfWeek = new Date().getDay();

  const [workoutPlanRes, nutritionRes, profileRes] = await Promise.allSettled([
    axios.get(`${WORKOUT_SERVICE_URL}/api/v1/workouts/active`, { headers }),
    axios.get(`${NUTRITION_SERVICE_URL}/api/v1/nutrition/summary/${date}`, { headers }),
    axios.get(`${AUTH_SERVICE_URL}/api/v1/profile`, { headers }),
  ]);

  // --- Workout plan for today ---
  let workoutType: 'workout' | 'rest' = 'rest';
  let workoutName: string | undefined;
  let exercises: any[] = [];

  if (workoutPlanRes.status === 'fulfilled') {
    const plan = workoutPlanRes.value.data;
    const todayDay = plan?.days?.find((d: any) => d.dayOfWeek === dayOfWeek);
    if (todayDay && todayDay.exercises?.length > 0) {
      workoutType = 'workout';
      workoutName = todayDay.name || "Today's Workout";
      exercises = todayDay.exercises;
    }
  }

  // --- Nutrition targets from user profile ---
  let nutritionTargets = { calories: 2000, protein: 150 };
  if (profileRes.status === 'fulfilled') {
    const profile = profileRes.value.data;
    const cal = profile?.derivedMetrics?.dailyCalorieTarget;
    const pro = profile?.derivedMetrics?.dailyProteinTarget;
    if (cal) nutritionTargets.calories = Math.round(cal);
    if (pro) nutritionTargets.protein = Math.round(pro);
  }

  // --- Nutrition summary (for reference in coach context) ---
  const nutritionSummary =
    nutritionRes.status === 'fulfilled' ? nutritionRes.value.data : null;

  return {
    date,
    workoutType,
    workoutName,
    exercises,
    nutritionTargets,
    nutritionSummary,
  };
};
