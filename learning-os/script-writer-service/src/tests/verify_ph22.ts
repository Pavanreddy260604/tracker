import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { User } from '../models/User';
import { MasterScript } from '../models/MasterScript';
import { VoiceSample } from '../models/VoiceSample';
import { adminService } from '../services/admin.service';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function test() {
    console.log("Starting Phase 22 Verification: Interest-Based RAG Boost...");

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log("Connected to MongoDB.");

        // 1. Setup User with Interests
        const userId = new mongoose.Types.ObjectId('000000000000000000000002');
        await User.deleteMany({ _id: userId });
        const user = await User.create({
            _id: userId,
            name: 'Nolan Fan',
            email: 'nolan@fan.com',
            scriptInterests: {
                directors: ['CHRISTOPHER NOLAN'],
                genres: ['Sci-Fi'],
                styles: ['Mind-Bending']
            }
        });

        // 2. Ensure we have a Nolan Master Script indexed
        // (Reusing the mock from PH 21)
        const NOLAN_MOCK = `
        EXT. COBB'S OFFICE - NIGHT
        COBB: Dreaming is a dangerous game.
        ARIADNE: I want to build worlds.
        COBB: (intimidating) Then build them with caution.
        `;

        const master = await adminService.createMasterScript({
            title: 'Interest Test Script',
            director: 'CHRISTOPHER NOLAN',
            tags: ['Mind-Bending', 'Sci-Fi'],
            rawContent: NOLAN_MOCK
        });
        await adminService.processMasterScript(master._id as string);

        // 3. Trigger Generation and check logs for "Interest Boost"
        const request = {
            userId: userId.toString(),
            idea: 'A scene about building worlds in dreams.',
            format: 'film' as any,
            style: 'modern' as any,
            language: 'English'
        };

        console.log("\n--- GENERATING WITH INTERESTS ---");
        const stream = scriptGenerator.generateScript(request);
        for await (const chunk of stream) {
            // We just need to trigger the generation to see the logs
        }
        console.log("\n--- GENERATION TRIGGERED ---");

        console.log("\n✅ SUCCESS: Check console logs above for '[VectorService] Interest Boost' messages.");

        // Cleanup
        await VoiceSample.deleteMany({ masterScriptId: master._id });
        await MasterScript.deleteOne({ _id: master._id });
        await User.deleteOne({ _id: userId });
        await mongoose.disconnect();

    } catch (err) {
        console.error("\n❌ ERROR during verification:", err);
        process.exit(1);
    }
}

test();
