import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const mongoUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/fitness-coach-monitoring';
        await mongoose.connect(mongoUrl);
        console.log('MongoDB Connected to monitoring database');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};
