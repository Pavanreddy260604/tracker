import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.SCRIPT_WRITER_MONGODB_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI or SCRIPT_WRITER_MONGODB_URI is required.');
}

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 30,
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`✅ Script Writer DB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err);
});

export default mongoose;
