
import mongoose from 'mongoose';
import { MasterScript } from './src/models/MasterScript';

async function listScripts() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/script-writer';
    await mongoose.connect(mongoUri);

    const scripts = await MasterScript.find().sort({ createdAt: -1 }).limit(10);

    console.log("\n--- RECENT MASTER SCRIPTS ---");
    scripts.forEach(s => {
        console.log(`ID: ${s._id} | Title: ${s.title} | Status: ${s.status} | Chunks: ${s.processedChunks}`);
    });

    await mongoose.disconnect();
    process.exit(0);
}

listScripts().catch(console.error);
