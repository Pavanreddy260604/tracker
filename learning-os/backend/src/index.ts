import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { connectDB } from './config/db.js';
import { validateAppEnv } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { csrfProtection } from './middleware/csrf.js';

import authRoutes from './routes/auth.js';
import dailyLogRoutes from './routes/dailyLogs.js';
import dashboardRoutes from './routes/dashboard.js';
import dsaProblemRoutes from './routes/dsaProblems.js';
import backendTopicRoutes from './routes/backendTopics.js';
import projectStudyRoutes from './routes/projectStudies.js';
import aiRoutes from './routes/ai.js';
import roadmapRoutes from './routes/roadmap.js';
import interviewRoutes from './routes/interview.js';
import chatRoutes from './routes/chat.js';
import { activityRoutes } from './routes/activityRoutes.js';

const env = validateAppEnv();
const app = express();
const PORT = Number(env.PORT) || 5000;

app.use(helmet());
app.use(
    cors({
        origin: env.FRONTEND_URL.split(',').map(url => url.trim()),
        credentials: true,
    })
);

app.use(cookieParser());

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Ensure auth routes (specifically refresh) have custom limits or bypasses to prevent session drop on rapid navigation
app.use('/api/auth/refresh', authRoutes); // Handled sequentially, bypasses global apiLimiter
app.use('/api', apiLimiter);
app.use('/api', csrfProtection);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dsa-problems', dsaProblemRoutes);
app.use('/api/backend-topics', backendTopicRoutes);
app.use('/api/project-studies', projectStudyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/activity', activityRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`[server] Learning OS backend running on http://localhost:${PORT}`);
            console.log(`[server] Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('[server] Failed to start:', error);
        process.exit(1);
    }
};

startServer();

export default app;
