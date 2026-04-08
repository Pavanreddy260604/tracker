import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as metricService from '../services/MetricService';

export const logMetric = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const { type, value, unit } = req.body;
    if (!type || value === undefined || !unit) {
      res.status(400).json({ message: 'Missing required parameters: type, value, unit' });
      return;
    }

    const metric = await metricService.logMetric(userId, type, parseFloat(value), unit);
    res.status(201).json({ message: 'Metric logged successfully', metric });
  } catch (error: any) {
    res.status(400).json({ message: 'Error logging metric', error: error.message });
  }
};

export const getHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const type = req.query.type as 'weight' | 'bodyfat';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    
    const history = await metricService.getMetricHistory(userId, type, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching metric history', error: error.message });
  }
};
