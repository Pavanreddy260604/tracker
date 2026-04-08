import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function debugPurge() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
  const questions = await mongoose.connection.db.collection('questions').find({}).toArray();
  
  for (const q of questions) {
    console.log(`ID: ${q._id} | Title: ${q.title} | Signatures Keys: ${q.signatures ? Object.keys(q.signatures) : 'NONE'}`);
    if (!q.signatures || Object.keys(q.signatures).length < 5) {
      console.log(`  >> Target for deletion!`);
      await mongoose.connection.db.collection('questions').deleteOne({ _id: q._id });
    }
  }
  
  await mongoose.disconnect();
}

debugPurge();
