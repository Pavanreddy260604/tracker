import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Character } from '../models/Character';
import { Bible } from '../models/Bible';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function test() {
    console.log("Starting Phase 20 Verification: Continuity Persistence...");

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log("Connected to MongoDB.");

        // 1. Setup Data
        const bible = await Bible.create({
            userId: '000000000000000000000001',
            title: 'Continuity Test Project',
            logline: 'Testing AI memory.',
            genre: 'Drama',
            language: 'English'
        });

        const arjuna = await Character.create({
            bibleId: bible._id,
            name: 'ARJUNA',
            age: 30,
            role: 'protagonist',
            voice: { description: 'Noble' },
            currentStatus: 'Stable',
            heldItems: []
        });

        console.log(`Created Character: ${arjuna.name} (Status: ${arjuna.currentStatus})`);

        // 2. Generate Scene where state changes
        const request = {
            userId: '000000000000000000000001',
            idea: 'ARJUNA is in a fierce battle. He gets wounded on his right shoulder and picks up a divine bow named GANDIVA.',
            format: 'film' as any,
            style: 'modern' as any,
            bibleId: bible._id.toString(),
            characterIds: [arjuna._id.toString()],
            language: 'English'
        };

        console.log("\n--- GENERATING SCENE ---");
        let fullText = '';
        const stream = scriptGenerator.generateScript(request);
        for await (const chunk of stream) {
            fullText += chunk;
            process.stdout.write(chunk);
        }
        console.log("\n--- GENERATION COMPLETE ---");

        // 3. Wait for background state extraction
        console.log("\nWaiting 10 seconds for background state extraction...");
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 4. Verify in DB
        const updatedArjuna = await Character.findById(arjuna._id);
        console.log("\n--- VERIFICATION RESULTS ---");
        console.log(`Character: ${updatedArjuna?.name}`);
        console.log(`New Status: ${updatedArjuna?.currentStatus}`);
        console.log(`Held Items: ${updatedArjuna?.heldItems?.join(', ')}`);

        const success = (updatedArjuna?.currentStatus?.toLowerCase().includes('wound') ||
            updatedArjuna?.currentStatus?.toLowerCase().includes('shoulder')) &&
            updatedArjuna?.heldItems?.includes('GANDIVA');

        if (success) {
            console.log("\n✅ SUCCESS: Continuity state persisted correctly!");
        } else {
            console.log("\n❌ FAILURE: State did not update as expected.");
        }

        // Cleanup
        await Character.deleteOne({ _id: arjuna._id });
        await Bible.deleteOne({ _id: bible._id });
        await mongoose.disconnect();

    } catch (err) {
        console.error("\n❌ ERROR during verification:", err);
        process.exit(1);
    }
}

test();
