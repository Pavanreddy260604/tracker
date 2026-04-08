import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as streakService from '../services/streakService';

export const updateActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const updatedUser = await streakService.updateStreak(userId);
    res.json({ message: 'Streak updated successfully', streak: updatedUser?.streak });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating streak', error: error.message });
  }
};

export const getStreak = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const streak = await streakService.getStreak(userId);
    res.json(streak);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching streak', error: error.message });
  }
};

export const getInternalStreak = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const streak = await streakService.getStreak(userId);
    res.json(streak);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching internal streak', error: error.message });
  }
};
