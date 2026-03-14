import { connectDB } from './config/db.js';
import { validateAppEnv } from './config/env.js';
import { createApp } from './app.js';

const env = validateAppEnv();
const app = createApp(env);
const PORT = Number(env.PORT) || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`[server] Learning OS backend running on http://localhost:${PORT}`);
            console.log(`[server] Health check: http://localhost:${PORT}/health`);

            // Initialize RAG Cleanup Job (Runs every 24 hours)
            const { chatRagService } = require('./services/chatRag.service.js');
            setInterval(() => {
                console.log('[server] Running scheduled RAG cleanup...');
                chatRagService.cleanupInactive(3).catch((err: any) => console.error('RAG Cleanup failed:', err));
            }, 24 * 60 * 60 * 1000);
        });
    } catch (error) {
        console.error('[server] Failed to start:', error);
        process.exit(1);
    }
};

startServer();

export default app;
