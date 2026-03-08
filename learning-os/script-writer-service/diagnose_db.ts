
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { MasterScript } from './src/models/MasterScript';
import { VoiceSample } from './src/models/VoiceSample';

dotenv.config();

async function diagnose() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    console.log(`[Diagnostic] Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    const masterCount = await MasterScript.countDocuments();
    const sampleCount = await VoiceSample.countDocuments();

    console.log(`\n--- DATABASE DIAGNOSTIC ---`);
    console.log(`MasterScript count: ${masterCount}`);
    console.log(`VoiceSample count: ${sampleCount}`);

    if (masterCount > 0) {
        const scripts = await MasterScript.find().sort({ createdAt: -1 }).limit(5);
        console.log("\n--- RECENT MASTER SCRIPTS ---");
        scripts.forEach(s => {
            console.log(`ID: ${s._id} | Title: ${s.title} | Director: ${s.director}`);
        });

        // Let's also peek at the first 5 samples of the most recent script
        const latestScriptId = scripts[0]._id;
        const samples = await VoiceSample.find({ masterScriptId: latestScriptId }).limit(5);
        console.log(`\n--- TOP 5 SAMPLES FOR "${scripts[0].title}" ---`);
        samples.forEach((sam, i) => {
            console.log(`[${i + 1}] Speaker: ${sam.speaker} | Line: "${sam.content.substring(0, 50)}..."`);
        });
    }

    await mongoose.disconnect();
    process.exit(0);
}

diagnose().catch(console.error);
