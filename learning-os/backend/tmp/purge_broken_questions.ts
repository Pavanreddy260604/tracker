import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../src/models/Question.js';

dotenv.config({ path: '../.env' });

async function purgeBrokenQuestions() {
  console.log('--- Purging Broken Questions ---');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
    console.log('Connected to MongoDB');
    
    // Find questions missing signatures
    const broken = await Question.find({ 'signatures.javascript': { $exists: false } });
    console.log(`Found ${broken.length} broken questions to delete`);
    
    for (const q of broken) {
      console.log(`Deleting: ${q.title} (${q.slug})`);
      await Question.deleteOne({ _id: q._id });
    }
    
    console.log('Purge complete');
    
  } catch (err) {
    console.error('Purge failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

purgeBrokenQuestions();
