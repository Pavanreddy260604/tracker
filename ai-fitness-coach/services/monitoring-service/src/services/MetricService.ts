import { UserMetric, IUserMetric } from '../models/Metric';

export const logMetric = async (userId: string, type: 'weight' | 'bodyfat', value: number, unit: string) => {
  const metric = new UserMetric({
    userId,
    type,
    value,
    unit,
    timestamp: new Date()
  });
  return metric.save();
};

export const getMetricHistory = async (userId: string, type?: 'weight' | 'bodyfat', limit: number = 30) => {
  const query: any = { userId };
  if (type) query.type = type;
  
  return UserMetric.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

export const getLatestMetric = async (userId: string, type: 'weight' | 'bodyfat') => {
  return UserMetric.findOne({ userId, type })
    .sort({ timestamp: -1 });
};
