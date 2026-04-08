import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as substitutionService from '../services/substitutionService';
import { signalEvent } from '../utils/eventSignaler';

export const getSubstitutes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params as { id: string };
        const userId = (req.user as any)?.userId;
        const { userEquipment } = req.query as { userEquipment: string[] };

        if (!id) {
           res.status(400).json({ message: 'Exercise ID is required' });
           return;
        }

        const substitutes = await substitutionService.getAlternatives(id, userId, userEquipment || []);
        
        // Closed-Loop: Signal Decision Event
        if (userId) {
          signalEvent(userId, 'DECISION', { 
            originalExerciseId: id, 
            returnedSubstitutes: substitutes.map(s => ({ id: s.exercise._id, score: s.similarityScore })) 
          });
        }

        res.json(substitutes);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching substitutes', error: error.message });
    }
};

export const recordPreference = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { originalExerciseId, substituteId } = req.body;
        const userId = (req.user as any)?.userId;

        if (!originalExerciseId || !substituteId) {
           res.status(400).json({ message: 'Original and substitute IDs are required' });
           return;
        }

        await substitutionService.recordPreference(userId, originalExerciseId, substituteId);
        res.status(201).json({ message: 'Substitution preference recorded successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error recording substitution preference', error: error.message });
    }
};
