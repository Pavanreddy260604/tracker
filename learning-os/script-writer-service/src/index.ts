import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
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

// API Routes (to be added)
app.get('/api/script/templates', (req, res) => {
    res.json({
        success: true,
        data: {
            formats: [
                { id: 'film', name: 'Feature Film', description: '90-180 minutes' },
                { id: 'short', name: 'Short Film', description: '5-30 minutes' },
                { id: 'youtube', name: 'YouTube Video', description: '3-20 minutes' },
                { id: 'reel', name: 'Reel/Short', description: '15-90 seconds' },
                { id: 'commercial', name: 'Commercial', description: '15-60 seconds' },
                { id: 'tv-episode', name: 'TV Episode', description: '22-60 minutes' }
            ],
            styles: [
                { id: 'classic', name: 'Classic Screenplay', description: 'Traditional three-act structure, balanced dialogue and action' },
                { id: 'dialogue-driven', name: 'Dialogue-Driven', description: 'Character conversations carry the story, minimal action' },
                { id: 'visual-minimal', name: 'Visual/Minimal Dialogue', description: 'Show don\'t tell, imagery over words' },
                { id: 'non-linear', name: 'Non-Linear Narrative', description: 'Flashbacks, time jumps, puzzle structure' },
                { id: 'documentary', name: 'Documentary Style', description: 'Interviews, voiceover, found footage feel' },
                { id: 'action-heavy', name: 'Action-Heavy', description: 'Fast pacing, detailed action sequences' },
                { id: 'experimental', name: 'Experimental', description: 'Breaking conventions, unique formatting' }
            ]
        }
    });
});

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
