import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Connect to MongoDB
connectDB();

import * as planController from './controllers/planController';
import * as coachController from './controllers/coachController';
import * as internalFeedbackController from './controllers/internal_feedback_controller';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'coach-service' });
});

// Coach Routes
app.get('/api/v1/coach/today', authenticate, planController.getTodayPlan);
app.post('/api/v1/coach/ask', authenticate, coachController.askCoach);
app.get('/api/v1/coach/conversations/:sessionId', authenticate, coachController.getConversation);

// Internal routes (for closed-loop system)
app.post('/api/v1/internal/coach/events', internalFeedbackController.logEvent);
app.put('/api/v1/internal/coach/feedback/:logId', internalFeedbackController.updateFeedback);

app.listen(PORT, () => {
  console.log(`Coach Service running on port ${PORT}`);
});
