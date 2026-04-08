import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as workoutGenerator from '../services/workoutGenerator';

export const generatePlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const { goal, availableEquipment, daysPerWeek } = req.body;
    
    if (!goal || !availableEquipment || !daysPerWeek) {
       res.status(400).json({ message: 'Missing required parameters: goal, availableEquipment, daysPerWeek' });
       return;
    }

    const plan = await workoutGenerator.generateWorkoutPlan(userId, {
      goal,
      availableEquipment,
      daysPerWeek: parseInt(daysPerWeek)
    });

    res.status(201).json({ message: 'Workout plan generated successfully', plan });
  } catch (error: any) {
    res.status(500).json({ message: 'Error generating workout plan', error: error.message });
  }
};

export const getActivePlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const plan = await workoutGenerator.getActiveWorkoutPlan(userId);
    if (!plan) {
       res.status(404).json({ message: 'No active workout plan found' });
       return;
    }
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching active plan', error: error.message });
  }
};
