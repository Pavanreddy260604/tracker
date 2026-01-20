import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../models/Question.js';

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';

async function check() {
    await mongoose.connect(MONGODB_URI);
    const count = await Question.countDocuments();
    const questions = await Question.find({}, 'title difficulty slug');
    console.log(`\n📊 Total Questions in DB: ${count}`);
    console.log('--------------------------------');
    questions.forEach(q => console.log(`[${q.difficulty}] ${q.title} (${q.slug})`));
    console.log('--------------------------------');
    process.exit(0);
}
check();
