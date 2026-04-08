import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(morgan('short')); // Logging

// Rate Limiting (High capacity: ~55 req/sec per IP, or 1M per 5 hours roughly)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5000, // Limit each IP to 5000 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use(limiter);

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'script-writer',
        timestamp: new Date().toISOString(),
        v: 2
    });
});

// API Routes
import { scriptRoutes } from './routes/script.routes';
import voiceRoutes from './routes/voice.routes';
import { bibleRoutes } from './routes/bible.routes';
import { sceneRoutes } from './routes/scene.routes';
import { characterRoutes } from './routes/character.routes';
import { treatmentRoutes } from './routes/treatment.routes';
import { aiRoutes } from './routes/ai.routes';
import adminRoutes from './routes/admin.routes';
import { healthRoutes } from './routes/health.routes';

// Routes
app.use('/api/script', scriptRoutes);
app.use('/api/script/voice', voiceRoutes);
app.use('/api/script/bible', bibleRoutes);
app.use('/api/script/scene', sceneRoutes);
app.use('/api/script/character', characterRoutes);
app.use('/api/script/treatment', treatmentRoutes);
app.use('/api/script/ai', aiRoutes); // Switch provider, etc.
app.use('/api/script/admin', adminRoutes); // PH 21
app.use('/api/script/health', healthRoutes); // Infrastructure monitoring


// Start server
const startServer = async () => {
    await connectDB();

    // Infrastructure Check: Redis Connectivity
    try {
        const { Redis } = await import('ioredis');
        const redis = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT) || 6379,
            connectTimeout: 2000,
            lazyConnect: true
        });
        await redis.connect();
        console.log('[Infrastructure] Redis Connected Successfully');
        await redis.quit();
    } catch (err) {
        console.warn('\n' + '═'.repeat(60));
        console.warn('⚠️  CRITICAL INFRASTRUCTURE WARNING: REDIS DISCONNECTED');
        console.warn('Description: Background tasks (Discovery, Summary, Queues) will FAIL.');
        console.warn('Action: Please start Redis (e.g., redis-server) to enable full features.');
        console.warn('═'.repeat(60) + '\n');
    }

    const server = app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎬 Script Writer AI Service                              ║
║                                                            ║
║   Server:     http://localhost:${PORT}                      ║
║   Health:     http://localhost:${PORT}/health               ║
║   API Base:   http://localhost:${PORT}/api/script           ║
║                                                            ║
║   Ready to write Hollywood-standard scripts! 🎥            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });

    server.timeout = 120000; // 120 seconds
};

// Only start if run directly
if (require.main === module || !module.parent) {
    startServer().catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
