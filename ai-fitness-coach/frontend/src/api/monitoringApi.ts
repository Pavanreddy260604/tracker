import apiClient from './apiClient';

export const getMetricHistory = async (type: 'weight' | 'bodyfat', limit: number = 30) => {
  const response = await apiClient.get('/api/v1/monitoring/history', {
    params: { type, limit }
  });
  return response.data;
};

export const getWeeklyReport = async () => {
  const response = await apiClient.get('/api/v1/monitoring/weekly-report');
  return response.data;
};

export const logMetric = async (type: string, value: number, unit: string) => {
  const response = await apiClient.post('/api/v1/monitoring/metrics', {
    type, value, unit
  });
  return response.data;
};
