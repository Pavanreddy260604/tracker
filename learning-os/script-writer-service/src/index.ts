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
                { id: 'nolan', name: 'Christopher Nolan', description: 'Non-linear, complex, thought-provoking' },
                { id: 'tarantino', name: 'Quentin Tarantino', description: 'Snappy dialogue, chapter-based, pop culture' },
                { id: 'spielberg', name: 'Steven Spielberg', description: 'Emotional, family themes, adventure' },
                { id: 'wes-anderson', name: 'Wes Anderson', description: 'Symmetrical, quirky, deadpan humor' },
                { id: 'scorsese', name: 'Martin Scorsese', description: 'Gritty, character-driven, voiceover' },
                { id: 'fincher', name: 'David Fincher', description: 'Dark, meticulous, psychological' },
                { id: 'villeneuve', name: 'Denis Villeneuve', description: 'Visual, slow-burn, minimalist dialogue' }
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
