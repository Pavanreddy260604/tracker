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
        timestamp: new Date().toISOString()
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

// Routes
app.use('/api/script', scriptRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/scene', sceneRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/ai', aiRoutes);


// Start server
const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
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
};

startServer();
