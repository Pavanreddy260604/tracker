import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Connect to MongoDB
connectDB();

import * as exerciseController from './controllers/exerciseController';
import * as workoutController from './controllers/workoutController';
import * as sessionController from './controllers/sessionController';
import * as substitutionController from './controllers/substitutionController';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'workout-service' });
});

// Exercise Routes
app.get('/api/v1/exercises', exerciseController.listExercises);
app.get('/api/v1/exercises/:id', exerciseController.getExerciseById);
app.get('/api/v1/exercises/:id/alternatives', exerciseController.getAlternatives);

// Workout Generation Routes
app.post('/api/v1/workouts/generate', authenticate, workoutController.generatePlan);
app.get('/api/v1/workouts/active', authenticate, workoutController.getActivePlan);

// Workout Session Routes
app.post('/api/v1/sessions', authenticate, sessionController.startSession);
app.get('/api/v1/sessions/active', authenticate, sessionController.getActiveSession);
app.post('/api/v1/sessions/:sessionId/sets', authenticate, sessionController.logSet);
app.post('/api/v1/sessions/:sessionId/skip', authenticate, sessionController.skipExercise);
app.post('/api/v1/sessions/:sessionId/complete', authenticate, sessionController.completeSession);

// Internal routes (No auth for now, or use API key in production)
app.get('/api/v1/internal/workout-volume/:userId', sessionController.getInternalVolume);

// Substitution Routes
app.get('/api/v1/exercises/:id/substitutes', authenticate, substitutionController.getSubstitutes);
app.post('/api/v1/substitutions/preference', authenticate, substitutionController.recordPreference);

// Workout Routes placeholder
app.use('/api/workouts', (req, res) => {
  res.status(501).json({ message: 'Detailed workout history coming soon' });
});

app.listen(PORT, () => {
  console.log(`Workout Service running on port ${PORT}`);
});
