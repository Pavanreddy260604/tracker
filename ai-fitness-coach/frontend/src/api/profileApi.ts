import apiClient from './apiClient';

export const getProfile = async () => {
  const response = await apiClient.get('/api/v1/profile');
  return response.data;
};

export const updateProfile = async (data: any) => {
  const response = await apiClient.put('/api/v1/profile', data);
  return response.data;
};

export const getCoachSettings = async () => {
  const response = await apiClient.get('/api/v1/profile/coach-settings');
  return response.data;
};

export const updateCoachSettings = async (data: any) => {
  const response = await apiClient.put('/api/v1/profile/coach-settings', data);
  return response.data;
};

export const getAvailableEquipment = async () => {
  const response = await apiClient.get('/api/v1/profile/equipment');
  return response.data;
};
