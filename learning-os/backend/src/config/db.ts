import mongoose from 'mongoose';
import { getRequiredEnv } from './env.js';

const MONGODB_URI = getRequiredEnv('MONGODB_URI');

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 50,
        });
        console.log(`[db] MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('[db] MongoDB connection error:', error);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    console.log('[db] MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err);
});

export default mongoose;
