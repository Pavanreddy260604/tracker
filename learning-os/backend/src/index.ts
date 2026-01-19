// CRITICAL: Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes from './routes/auth.js';
import dailyLogRoutes from './routes/dailyLogs.js';
import dashboardRoutes from './routes/dashboard.js';
import dsaProblemRoutes from './routes/dsaProblems.js';
import backendTopicRoutes from './routes/backendTopics.js';
import projectStudyRoutes from './routes/projectStudies.js';
import aiRoutes from './routes/ai.js';
import roadmapRoutes from './routes/roadmap.js';
import interviewRoutes from './routes/interview.js';


const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting for all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dsa-problems', dsaProblemRoutes);
app.use('/api/backend-topics', backendTopicRoutes);
app.use('/api/project-studies', projectStudyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/interview', interviewRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Learning OS Backend Server                           ║
║                                                           ║
║   Server:     http://localhost:${PORT}                     ║
║   Health:     http://localhost:${PORT}/health              ║
║   API Base:   http://localhost:${PORT}/api                 ║
║                                                           ║
║   Ready to track your learning journey! 📚                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
