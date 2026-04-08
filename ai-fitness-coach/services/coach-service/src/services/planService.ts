import axios from 'axios';

const WORKOUT_SERVICE_URL = process.env.WORKOUT_SERVICE_URL || 'http://localhost:3002';
const NUTRITION_SERVICE_URL = process.env.NUTRITION_SERVICE_URL || 'http://localhost:3003';

export const getTodayOverview = async (userId: string, token: string) => {
  const date = new Date().toISOString().split('T')[0];
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [workoutRes, nutritionRes] = await Promise.allSettled([
      axios.get(`${WORKOUT_SERVICE_URL}/api/v1/sessions/active`, { headers }),
      axios.get(`${NUTRITION_SERVICE_URL}/api/v1/nutrition/summary/${date}`, { headers })
    ]);

    const workout = workoutRes.status === 'fulfilled' ? workoutRes.value.data : { status: 'unavailable', error: 'Workout service unreachable' };
    const nutrition = nutritionRes.status === 'fulfilled' ? nutritionRes.value.data : { status: 'unavailable', error: 'Nutrition service unreachable' };

    return {
      date,
      workout: {
        active: !!workout && workout._id,
        session: workout,
        message: !workout ? 'No active workout session' : 'Workout in progress'
      },
      nutrition: {
        summary: nutrition,
        message: !nutrition ? 'No nutrition logs for today' : 'Daily nutrition tracked'
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to aggregate daily plan: ${error.message}`);
  }
};
