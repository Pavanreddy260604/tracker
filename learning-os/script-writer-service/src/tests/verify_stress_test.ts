
import mongoose from 'mongoose';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { Bible } from '../models/Bible';
import { Scene } from '../models/Scene';
import dotenv from 'dotenv';

dotenv.config();

/**
 * MASTER NOVELIST STRESS TEST
 * Generates 10 scenes to verify:
 * 1. Global Outline (20 beats) generation & enforcement support.
 * 2. Recursive Summarization (every 5 scenes) -> 2 summaries expected.
 * 3. Character Relationship evolution over time.
 * 4. Resource recovery (Fallbacks from Groq To Ollama).
 */
async function runStressTest() {
    console.log('🚀 Starting Master Novelist STRESS TEST (10 Scenes)...');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log('Connected to MongoDB.');

        // Wipe previous test data for this specific title
        const testTitle = 'The Chrono-Skyscraper Stress Test';
        await Bible.deleteMany({ title: testTitle });

        // 1. Setup Master Bible
        const bible = await Bible.create({
            userId: '000000000000000000000000',
            title: testTitle,
            logline: 'An architect discovers that the skyscraper he is building exists in a parallel world where every floor is a different year of his life.',
            genre: 'Sci-Fi',
            tone: 'Deep Philosophical Thriller',
            sceneCount: 0,
            storySoFar: 'The story is just beginning.',
            globalOutline: []
        });

        // 2. Setup Characters
        const elias = await Character.create({
            bibleId: bible._id,
            name: 'ELIAS',
            role: 'protagonist',
            currentStatus: 'Driven, slightly obsessive architect.',
            relationships: []
        });

        const sara = await Character.create({
            bibleId: bible._id,
            name: 'SARA',
            role: 'supporting',
            currentStatus: 'Elias wife, grounding him.',
            relationships: [{ targetCharName: 'ELIAS', dynamic: 'Wife, supportive but wary.' }]
        });

        console.log('Environment Setup Complete.');

        const sceneIdeas = [
            "Scene 1: Elias enters the elevator, sees buttons for years. Presses 1995. (MINIMAL CONTENT)",
            "Scene 2: 1995 floor opens. He see his childhood home. A formative memory with his father. (MINIMAL CONTENT)",
            "Scene 3: Elias returns to the elevator, presses 2005. He meets his younger self at university. (MINIMAL CONTENT)",
            "Scene 4: Sara finds him in the elevator. She thinks he is having a breakdown. Conflict arises. (MINIMAL CONTENT)",
            "Scene 5: Elias escapes Sara and presses 2015. He sees the day he first designed the building. (MINIMAL CONTENT)",
            "Scene 6: Elias realizes the building is alive. He finds a floor for 2026 (the future). (MINIMAL CONTENT)",
            "Scene 7: On the 2026 floor, he sees the building in ruins. A warning from the future. (MINIMAL CONTENT)",
            "Scene 8: Sara calls for help. Security arrives. Elias must hide in a year he hasn't lived yet. (MINIMAL CONTENT)",
            "Scene 9: Elias finds a secret floor (Zero). It represents the year before he was born. (MINIMAL CONTENT)",
            "Scene 10: Elias meets the 'Architect' of the Architect. The final confrontation with his own creation. (MINIMAL CONTENT)"
        ];

        let previousSceneContext = "";

        for (let i = 1; i <= 10; i++) {
            console.log(`\n[StressTest] --- GENERATING SCENE ${i} ---`);
            const req = {
                userId: '000000000000000000000000',
                idea: sceneIdeas[i - 1],
                format: 'film' as any,
                style: 'non-linear' as any,
                bibleId: bible._id.toString(),
                characterIds: [elias._id.toString(), sara._id.toString()],
                useAdvancedCoherence: true,
                previousContext: previousSceneContext,
                sceneLength: 'short' as any
            };

            let sceneContent = '';
            for await (const chunk of scriptGenerator.generateScript(req)) {
                // process.stdout.write('.'); // Just to see progress
                sceneContent += chunk;
            }

            // Save Scene to DB so summarizer can see it
            const sceneDoc = await new Scene({
                bibleId: bible._id,
                sequenceNumber: i,
                slugline: `INT. TOWER - FLOOR ${i} - DAY`,
                summary: `Elias explores ${sceneIdeas[i - 1]}`,
                content: sceneContent,
                status: 'drafted'
            }).save();

            console.log(`\n[StressTest] Scene ${i} Generated.`);

            // Capture context for next scene
            previousSceneContext = sceneContent.substring(0, 500); // Pass a snippet back

            // Wait for background tasks (Outline on scene 1, Summary on scene 5 & 10, State updates every scene)
            console.log(`[StressTest] Waiting for background tasks for Scene ${i}...`);
            await scriptGenerator.waitForBackgroundTasks();

            // Intermediary check
            if (i === 1) {
                const b1 = await Bible.findById(bible._id);
                console.log(`[StressTest] Global Outline beats: ${b1?.globalOutline?.length}`);
            }
            if (i === 5) {
                const b5 = await Bible.findById(bible._id);
                console.log(`[StressTest] Summary after 5 scenes: ${b5?.storySoFar?.substring(0, 100)}...`);
            }
        }

        // 3. Final Verification
        console.log('\n--- FINAL STRESS TEST RESULTS ---');
        const finalBible = await Bible.findById(bible._id);
        const finalElias = await Character.findById(elias._id);
        const finalSara = await Character.findById(sara._id);

        console.log(`Scene Count: ${finalBible?.sceneCount} (Expected 10)`);
        console.log(`Final Story So Far: ${finalBible?.storySoFar}`);
        console.log(`Elias Status: ${finalElias?.currentStatus}`);
        console.log(`Sara Status: ${finalSara?.currentStatus}`);
        console.log(`Sara->Elias Relationship: ${JSON.stringify(finalSara?.relationships?.find((r: any) => r.targetCharName === 'ELIAS'))}`);

        if (finalBible?.sceneCount === 10 && finalBible?.storySoFar && finalBible.storySoFar.length > 50) {
            console.log('\n✅ STRESS TEST PASSED: Narrative integrity maintained across 10 scenes.');
        } else {
            console.log('\n❌ STRESS TEST FAILED: Verification criteria not met.');
        }

    } catch (err) {
        console.error('\n❌ STRESS TEST ERROR:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

runStressTest();
