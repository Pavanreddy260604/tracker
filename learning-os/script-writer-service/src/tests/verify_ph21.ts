import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { adminService } from '../services/admin.service';
import { MasterScript } from '../models/MasterScript';
import { VoiceSample } from '../models/VoiceSample';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const NOLAN_MOCK_SCRIPT = `
EXT. COBB'S APARTMENT - DAY

COBB (V.O.)
Dreaming is like building a skyscraper in your mind.

ARIADNE
But how do you keep it from falling?

COBB
(intimidating)
You don't. You let it collapse and see what's left.

EXT. PARIS STREET - DAY

ARIADNE
(pleading)
Show me more. I want to see the edges.

COBB
(deflecting)
The edges are where it gets dangerous, Ariadne.
`;

async function test() {
    console.log("Starting Phase 21 Verification: Director Admin Feed...");

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log("Connected to MongoDB.");

        // 1. Create Master Script Entry
        const master = await adminService.createMasterScript({
            title: 'Inception Style Mock',
            director: 'CHRISTOPHER NOLAN',
            tags: ['Mind-Bending', 'Architectural', 'Neo-Noir'],
            rawContent: NOLAN_MOCK_SCRIPT
        });

        console.log(`Created Master Script: ${master.title} (Status: ${master.status})`);

        // 2. Process the script
        console.log("Processing Master Script...");
        await adminService.processMasterScript((master._id as any).toString());

        // 3. Verify Results
        const updatedMaster = await MasterScript.findById(master._id);
        console.log(`Updated Status: ${updatedMaster?.status}`);
        console.log(`Processed Chunks: ${updatedMaster?.processedChunks}`);

        const samples = await VoiceSample.find({ masterScriptId: master._id });
        console.log(`Total Samples Saved: ${samples.length}`);

        if (updatedMaster?.status === 'indexed' && samples.length > 0) {
            console.log("\n✅ SUCCESS: Master Script ingested and indexed!");

            // Show a sample to verify Tactics/Emotions
            const sample = samples[0];
            console.log("\n--- SAMPLE DATA ---");
            console.log(`Content: "${sample.content}"`);
            console.log(`Tactic: ${sample.tactic}`);
            console.log(`Emotion: ${sample.emotion}`);
        } else {
            console.log("\n❌ FAILURE: Indexing failed.");
        }

        // Cleanup
        await VoiceSample.deleteMany({ masterScriptId: master._id });
        await MasterScript.deleteOne({ _id: master._id });
        await mongoose.disconnect();

    } catch (err) {
        console.error("\n❌ ERROR during verification:", err);
        process.exit(1);
    }
}

test();
