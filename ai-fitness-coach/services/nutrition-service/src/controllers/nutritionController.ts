import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as nutritionService from '../services/nutritionService';
import { signalActivity } from '../utils/activitySignaler';
import { signalEvent } from '../utils/eventSignaler';

export const searchFood = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
       res.status(400).json({ message: 'Search query "q" is required' });
       return;
    }

    const results = await nutritionService.searchFood(query, req.query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: 'Error searching food', error: error.message });
  }
};

export const logEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const { date, entryData } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!entryData) {
       res.status(400).json({ message: 'Entry data is required' });
       return;
    }

    const logDate = date ? new Date(date) : new Date();
    const updatedLog = await nutritionService.logNutritionEntry(userId, logDate, entryData);
    
    // Signal activity
    if (token) signalActivity(token);

    // Closed-Loop: Signal Input Event
    if (userId) signalEvent(userId, 'INPUT', { date: logDate, entryData });

    res.status(201).json({ message: 'Nutrition entry logged successfully', log: updatedLog });
  } catch (error: any) {
    res.status(400).json({ message: 'Error logging nutrition entry', error: error.message });
  }
};

export const getDailyLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const { date } = req.params as { date: string };
    const logDate = date ? new Date(date) : new Date();
    const log = await nutritionService.getDailyLog(userId, logDate);
    
    if (!log) {
       res.status(404).json({ message: 'No nutrition log found for this date' });
       return;
    }

    res.json(log);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching daily log', error: error.message });
  }
};

export const getSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const { date } = req.params as { date: string };
    const logDate = date ? new Date(date) : new Date();
    
    // Accept targets from query parameters or use defaults
    const targets = {
      calories: parseFloat(req.query.targetCalories as string) || 2000,
      protein: parseFloat(req.query.targetProtein as string) || 150,
      carbohydrates: parseFloat(req.query.targetCarbohydrates as string) || 200,
      fats: parseFloat(req.query.targetFats as string) || 60
    };

    const summary = await nutritionService.getNutritionSummary(userId, logDate, targets);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching nutrition summary', error: error.message });
  }
};

export const getQuickAdd = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const quickAddFoods = await nutritionService.getQuickAddFoods(userId);
    res.json(quickAddFoods);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching quick add foods', error: error.message });
  }
};

export const getInternalAdherence = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
       res.status(400).json({ message: 'User ID is required' });
       return;
    }

    const weeklyData = await nutritionService.getWeeklyAdherence(userId as string);
    res.json(weeklyData);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching weekly adherence', error: error.message });
  }
};
