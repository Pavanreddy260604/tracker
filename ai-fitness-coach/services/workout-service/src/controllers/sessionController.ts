import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as sessionService from '../services/sessionService';
import { signalActivity } from '../utils/activitySignaler';
import { signalEvent } from '../utils/eventSignaler';

export const startSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const { planId, dayIndex } = req.body;
    if (!planId || dayIndex === undefined) {
      res.status(400).json({ message: 'Missing required parameters: planId, dayIndex' });
      return;
    }

    const session = await sessionService.startSession(userId, planId, parseInt(dayIndex));
    
    // Signal activity
    if (token) signalActivity(token);

    res.status(201).json({ message: 'Workout session started successfully', session });
  } catch (error: any) {
    res.status(500).json({ message: 'Error starting workout session', error: error.message });
  }
};

export const logSet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { exerciseId, weight, reps, difficultyRating } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!exerciseId || weight === undefined || reps === undefined) {
      res.status(400).json({ message: 'Missing required parameters: exerciseId, weight, reps' });
      return;
    }

    const { session, suggestion } = await sessionService.logSet(sessionId, exerciseId, {
      weight: parseFloat(weight),
      reps: parseInt(reps),
      difficultyRating: difficultyRating ? parseInt(difficultyRating) : undefined
    });

    // Signal activity
    if (token) signalActivity(token);
    
    // Closed-Loop: Signal Input Event
    const userId = (req.user as any)?.userId;
    if (userId) signalEvent(userId, 'INPUT', { exerciseId, weight, reps });

    res.status(201).json({ message: 'Set logged successfully', session, suggestion });
  } catch (error: any) {
    res.status(400).json({ message: 'Error logging set', error: error.message });
  }
};

export const skipExercise = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { exerciseId, reason } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!exerciseId || !reason) {
      res.status(400).json({ message: 'Missing required parameters: exerciseId, reason' });
      return;
    }

    const session = await sessionService.skipExercise(sessionId, exerciseId, reason);
    
    // Signal activity
    if (token) signalActivity(token);

    res.status(200).json({ message: 'Exercise skipped successfully', session });
  } catch (error: any) {
    res.status(400).json({ message: 'Error skipping exercise', error: error.message });
  }
};

export const completeSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { rating, notes } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    const session = await sessionService.completeSession(sessionId, { rating, notes });
    
    // Signal activity
    if (token) signalActivity(token);
    
    // Closed-Loop: Signal Feedback Event
    const userId = (req.user as any)?.userId;
    if (userId && rating !== undefined) {
      signalEvent(userId, 'FEEDBACK', { sessionId, rating, notes });
    }

    res.status(200).json({ message: 'Workout session completed successfully', session });
  } catch (error: any) {
    res.status(400).json({ message: 'Error completing session', error: error.message });
  }
};

export const getActiveSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const session = await sessionService.getActiveSession(userId);
    if (!session) {
       res.status(404).json({ message: 'No active workout session found' });
       return;
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching active session', error: error.message });
  }
};
export const getInternalVolume = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
       res.status(400).json({ message: 'User ID is required' });
       return;
    }

    const weeklyData = await sessionService.getWeeklyVolume(userId as string);
    res.json(weeklyData);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching weekly volume', error: error.message });
  }
};
