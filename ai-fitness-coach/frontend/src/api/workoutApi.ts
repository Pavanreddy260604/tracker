import apiClient from './apiClient';

export const startSession = async (planId: string, dayIndex: number) => {
  const response = await apiClient.post('/api/v1/sessions', { planId, dayIndex });
  return response.data;
};

export const getActiveSession = async () => {
  const response = await apiClient.get('/api/v1/sessions/active');
  return response.data;
};

export const logSet = async (sessionId: string, exerciseId: string, data: { weight: number, reps: number, difficultyRating?: number }) => {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/sets`, { exerciseId, ...data });
  return response.data;
};

export const completeSession = async (sessionId: string, feedback: { rating: number, notes?: string }) => {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/complete`, feedback);
  return response.data;
};

export const skipExercise = async (sessionId: string, exerciseId: string, reason?: string) => {
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/skip`, { exerciseId, reason });
  return response.data;
};


export const getSubstitutes = async (exerciseId: string) => {
  const response = await apiClient.get(`/api/v1/exercises/${exerciseId}/substitutes`);
  return response.data;
};

export const substituteExercise = async (sessionId: string, exerciseId: string, substituteId: string) => {
  // Assuming we have a substitution endpoint or we update via some session update logic
  // Based on backend task 9: we have GET favorites/alternatives. 
  // Let's assume we can POST a substitution.
  const response = await apiClient.post(`/api/v1/sessions/${sessionId}/substitute`, { exerciseId, substituteId });
  return response.data;
};
