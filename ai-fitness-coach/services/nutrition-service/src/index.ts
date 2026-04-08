import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Connect to MongoDB
connectDB();

import * as nutritionController from './controllers/nutritionController';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'nutrition-service' });
});

// Nutrition Routes
app.get('/api/v1/nutrition/food/search', authenticate, nutritionController.searchFood);
app.post('/api/v1/nutrition/log', authenticate, nutritionController.logEntry);
app.get('/api/v1/nutrition/log/:date', authenticate, nutritionController.getDailyLog);
app.get('/api/v1/nutrition/summary/:date', authenticate, nutritionController.getSummary);
app.get('/api/v1/nutrition/quick-add', authenticate, nutritionController.getQuickAdd);

// Internal routes
app.get('/api/v1/internal/nutrition-adherence/:userId', nutritionController.getInternalAdherence);

// Catch-all Nutrition Routes placeholder
app.use('/api/nutrition', (req, res) => {
  res.status(501).json({ message: 'Nutrition endpoints coming soon' });
});

app.listen(PORT, () => {
  console.log(`Nutrition Service running on port ${PORT}`);
});
