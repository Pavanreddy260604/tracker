
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { MasterScript } from './src/models/MasterScript';
import { VoiceSample } from './src/models/VoiceSample';

dotenv.config();

async function viewChunks() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);

    const script = await MasterScript.findOne({ title: 'PK' });
    if (!script) {
        console.log("PK Script not found.");
        process.exit(0);
    }

    const samples = await VoiceSample.find({ masterScriptId: script._id }).sort({ chunkIndex: 1 });

    console.log(`\n--- SHOWING ALL ${samples.length} CHUNKS FOR "${script.title}" ---`);
    console.log("------------------------------------------------------------------");

    samples.forEach((sam, i) => {
        const index = String(i + 1).padStart(4, ' ');
        const speaker = (sam.speaker || "UNKNOWN").padEnd(15, ' ');
        console.log(`[${index}] ${speaker}: ${sam.content.trim().substring(0, 120)}${sam.content.length > 120 ? '...' : ''}`);
    });

    console.log("------------------------------------------------------------------");
    await mongoose.disconnect();
    process.exit(0);
}

// Show ALL chunks
viewChunks().catch(console.error);
