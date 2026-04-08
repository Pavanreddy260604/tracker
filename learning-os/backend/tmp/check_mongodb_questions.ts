import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../src/models/Question.js';

dotenv.config({ path: '../.env' });

async function checkQuestions() {
  console.log('--- MongoDB Question Inspection ---');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
    console.log('Connected to MongoDB');
    
    const total = await Question.countDocuments();
    console.log(`Total questions in DB: ${total}`);
    
    const questions = await Question.find();
    let brokenCount = 0;
    
    for (const q of questions) {
      const issues = [];
      if (!q.signatures) issues.push('missing signatures object');
      else {
        if (!q.signatures.javascript) issues.push('missing js signature');
        if (!q.signatures.python) issues.push('missing python signature');
        if (!q.signatures.java) issues.push('missing java signature');
        if (!q.signatures.cpp) issues.push('missing cpp signature');
        if (!q.signatures.go) issues.push('missing go signature');
      }
      
      if (!q.testCases || q.testCases.length === 0) issues.push('no test cases');
      if (!q.slug) issues.push('missing slug');
      
      if (issues.length > 0) {
        brokenCount++;
        console.log(`Broken Question: ${q.title || q._id} | Issues: ${issues.join(', ')}`);
      }
    }
    
    console.log(`Summary: ${brokenCount} broken questions found out of ${total}`);
    
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkQuestions();
