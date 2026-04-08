import { Request, Response } from 'express';
import * as feedbackService from '../services/feedback_service';

export const logEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, type, data } = req.body;
    if (!userId || !type) {
      res.status(400).json({ message: 'userId and type are required' });
      return;
    }

    const log = await feedbackService.logClosedLoopEvent(userId, type, data);
    res.status(201).json(log);
  } catch (error: any) {
    res.status(500).json({ message: 'Error logging closed-loop event', error: error.message });
  }
};

export const updateFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { logId } = req.params;
    const { userResponse, satisfaction } = req.body;

    if (!logId || satisfaction === undefined) {
      res.status(400).json({ message: 'logId and satisfaction are required' });
      return;
    }

    const updatedLog = await feedbackService.updateFeedback(logId as string, userResponse, satisfaction);
    if (!updatedLog) {
      res.status(404).json({ message: 'Feedback log not found' });
      return;
    }

    res.json(updatedLog);
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating feedback', error: error.message });
  }
};
