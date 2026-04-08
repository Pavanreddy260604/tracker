import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export const signalActivity = async (token: string) => {
  try {
    await axios.post(`${AUTH_SERVICE_URL}/api/v1/auth/activity`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error: any) {
    console.error('Failed to signal activity to auth-service:', error.message);
    // Non-blocking error
  }
};
