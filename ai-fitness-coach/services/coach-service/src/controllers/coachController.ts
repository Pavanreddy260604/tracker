import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as coachService from '../services/coachService';

export const askCoach = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = (req.user as any)?.userId;
        const { sessionId, query } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!userId || !token) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        if (!sessionId || !query) {
            res.status(400).json({ message: 'Session ID and query are required' });
            return;
        }

        const result = await coachService.askCoach(userId, sessionId, query, token);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Error processing coach query', error: error.message });
    }
};

export const getConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const sessionId = req.params.sessionId as string;
        const history = await coachService.getConversationHistory(sessionId);
        
        if (!history) {
            res.status(404).json({ message: 'Conversation not found' });
            return;
        }

        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving conversation history', error: error.message });
    }
};
