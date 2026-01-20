import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Question } from '../models/Question.js';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedQuestions = async () => {
    try {
        console.log('🌱 Starting Seed...');
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('✅ Connected to MongoDB');

        // Clear existing questions to avoid duplicates
        await Question.deleteMany({});
        console.log('🗑️  Cleared existing questions');

        // Read JSON data
        const dataPath = path.join(__dirname, '../data/questions.json');
        const rawData = fs.readFileSync(dataPath, 'utf-8');
        const questions = JSON.parse(rawData);

        // Insert new data
        await Question.insertMany(questions);
        console.log(`✨ Successfully seeded ${questions.length} questions`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedQuestions();
