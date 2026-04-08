import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

import * as profileController from './controllers/profileController';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

import * as streakController from './controllers/streakController';

// Profile Routes
app.get('/api/v1/profile', authenticate, profileController.getProfile);
app.put('/api/v1/profile', authenticate, profileController.updateProfile);
app.post('/api/v1/profile', authenticate, profileController.createProfile);

// Streak Routes
app.post('/api/v1/auth/activity', authenticate, streakController.updateActivity);
app.get('/api/v1/auth/streak', authenticate, streakController.getStreak);
app.get('/api/v1/internal/auth/streak/:userId', streakController.getInternalStreak);

// Auth Routes placeholder
app.use('/api/auth', (req, res) => {
  res.status(501).json({ message: 'Auth endpoints coming soon' });
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
