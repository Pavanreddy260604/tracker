import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Connect to MongoDB
connectDB();

import * as metricController from './controllers/metricController';
import * as reportController from './controllers/reportController';
import { authenticate } from './middlewares/auth';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'monitoring-service' });
});

// Metric Routes
app.post('/api/v1/monitoring/metrics', authenticate, metricController.logMetric);
app.get('/api/v1/monitoring/history', authenticate, metricController.getHistory);

// Report Routes
app.get('/api/v1/monitoring/weekly-report', authenticate, reportController.getWeeklyReport);
app.get('/api/v1/monitoring/progress', authenticate, reportController.getProgressStatus);

app.listen(PORT, () => {
  console.log(`Monitoring Service running on port ${PORT}`);
});
