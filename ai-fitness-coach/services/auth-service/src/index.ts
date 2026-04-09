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
import * as authController from './controllers/authController';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

import * as streakController from './controllers/streakController';

// Auth Routes
app.post('/api/v1/auth/register', authController.register);
app.post('/api/v1/auth/login', authController.login);

// Profile Routes
app.get('/api/v1/profile', authenticate, profileController.getProfile);
app.put('/api/v1/profile', authenticate, profileController.updateProfile);
app.post('/api/v1/profile', authenticate, profileController.createProfile);

// Coach settings (stored in user profile)
app.get('/api/v1/profile/coach-settings', authenticate, profileController.getCoachSettings);
app.put('/api/v1/profile/coach-settings', authenticate, profileController.updateCoachSettings);
app.get('/api/v1/profile/equipment', authenticate, profileController.getAvailableEquipment);

// Streak Routes
app.post('/api/v1/auth/activity', authenticate, streakController.updateActivity);
app.get('/api/v1/auth/streak', authenticate, streakController.getStreak);
app.get('/api/v1/internal/auth/streak/:userId', streakController.getInternalStreak);

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
