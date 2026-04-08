import apiClient from './apiClient';

export const searchFood = async (query: string) => {
  const response = await apiClient.get('/api/v1/nutrition/food/search', {
    params: { q: query }
  });
  return response.data;
};

export const logNutritionEntry = async (date: string, entryData: any) => {
  const response = await apiClient.post('/api/v1/nutrition/log', {
    date,
    entryData
  });
  return response.data;
};

export const deleteNutritionEntry = async (entryId: string) => {
  const response = await apiClient.delete(`/api/v1/nutrition/log/${entryId}`);
  return response.data;
};


export const getDailyLog = async (date: string) => {
  const response = await apiClient.get(`/api/v1/nutrition/log/${date}`);
  return response.data;
};

export const getNutritionSummary = async (date: string, targets?: any) => {
  const response = await apiClient.get(`/api/v1/nutrition/summary/${date}`, {
    params: targets
  });
  return response.data;
};

export const getQuickAddFoods = async () => {
  const response = await apiClient.get('/api/v1/nutrition/quick-add');
  return response.data;
};
