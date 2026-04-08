import axios from 'axios';

const COACH_SERVICE_URL = process.env.COACH_SERVICE_URL || 'http://localhost:3004';

export const signalEvent = async (userId: string, type: 'INPUT' | 'DECISION' | 'FEEDBACK', data: any) => {
  try {
    await axios.post(`${COACH_SERVICE_URL}/api/v1/internal/coach/events`, {
      userId,
      type,
      data
    });
  } catch (error: any) {
    console.error(`Failed to signal ${type} event to coach-service:`, error.message);
    // Non-blocking error
  }
};
