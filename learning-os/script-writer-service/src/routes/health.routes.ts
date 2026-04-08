
import express from 'express';
import { aiServiceManager } from '../services/ai.manager';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/script/health/infra
router.get('/infra', async (req, res) => {
    const health: any = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: 'DOWN',
            redis: 'DOWN',
            ai_provider: {
                active: aiServiceManager.getProvider(),
                status: 'UNKNOWN'
            }
        }
    };

    // 1. Check MongoDB
    try {
        if (mongoose.connection.readyState === 1) {
            health.services.mongodb = 'UP';
        }
    } catch (err) {
        health.status = 'DEGRADED';
    }

    // 2. Check Redis
    try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT) || 6379,
            connectTimeout: 1000,
            lazyConnect: true
        });
        await redis.connect();
        health.services.redis = 'UP';
        await redis.quit();
    } catch (err) {
        health.services.redis = 'DOWN (Background tasks will fail)';
        health.status = 'DEGRADED';
    }

    // 3. Check AI Provider (Basic latency check/ping if possible, or just report active)
    health.services.ai_provider.status = 'READY';

    res.json(health);
});

export const healthRoutes = router;
