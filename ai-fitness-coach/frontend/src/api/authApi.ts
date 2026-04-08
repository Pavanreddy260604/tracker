import apiClient from './apiClient';

export const login = async (credentials: any) => {
  const response = await apiClient.post('/api/v1/auth/login', credentials);
  return response.data;
};

export const register = async (userData: any) => {
  const response = await apiClient.post('/api/v1/auth/register', userData);
  return response.data;
};

export const getProfile = async () => {
  const response = await apiClient.get('/api/v1/auth/profile');
  return response.data;
};
