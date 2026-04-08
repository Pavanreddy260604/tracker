import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Service URLs from environment variables
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const WORKOUT_SERVICE_URL = process.env.WORKOUT_SERVICE_URL || 'http://localhost:3002';
const NUTRITION_SERVICE_URL = process.env.NUTRITION_SERVICE_URL || 'http://localhost:3003';
const COACH_SERVICE_URL = process.env.COACH_SERVICE_URL || 'http://localhost:3004';
const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL || 'http://localhost:3005';

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

// Auth & Profile routes → auth-service
app.use('/api/v1/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
}));
app.use('/api/v1/profile', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
}));

// Workout routes → workout-service
app.use('/api/v1/sessions', createProxyMiddleware({
  target: WORKOUT_SERVICE_URL,
  changeOrigin: true,
}));
app.use('/api/v1/exercises', createProxyMiddleware({
  target: WORKOUT_SERVICE_URL,
  changeOrigin: true,
}));
app.use('/api/v1/workouts', createProxyMiddleware({
  target: WORKOUT_SERVICE_URL,
  changeOrigin: true,
}));
app.use('/api/v1/substitutions', createProxyMiddleware({
  target: WORKOUT_SERVICE_URL,
  changeOrigin: true,
}));

// Nutrition routes → nutrition-service
app.use('/api/v1/nutrition', createProxyMiddleware({
  target: NUTRITION_SERVICE_URL,
  changeOrigin: true,
}));

// Coach routes → coach-service
app.use('/api/v1/coach', createProxyMiddleware({
  target: COACH_SERVICE_URL,
  changeOrigin: true,
}));

// Monitoring routes → monitoring-service
app.use('/api/v1/monitoring', createProxyMiddleware({
  target: MONITORING_SERVICE_URL,
  changeOrigin: true,
}));

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
