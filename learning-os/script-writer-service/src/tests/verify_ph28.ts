
import mongoose from 'mongoose';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { Bible } from '../models/Bible';
import { Scene } from '../models/Scene';
import dotenv from 'dotenv';

dotenv.config();

async function testMasterNovelist() {
    console.log('Starting Phase 28-30 Verification: Master Novelist...');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log('Connected to MongoDB.');

        // 1. Setup Master Bible
        const bible = await Bible.findOneAndUpdate(
            { title: 'The Dream Architect' },
            {
                userId: '000000000000000000000000',
                title: 'The Dream Architect',
                logline: 'An architect discovers that the skyscraper he is building exists in a parallel world where every floor is a different year of his life.',
                genre: 'Sci-Fi',
                tone: 'Philosophical Thriller',
                sceneCount: 0,
                storySoFar: 'The story is just beginning.',
                globalOutline: [] // Reset for fresh test
            },
            { upsert: true, new: true }
        );

        // 2. Setup Characters with Relationships
        const elias = await Character.findOneAndUpdate(
            { name: 'ELIAS' },
            {
                bibleId: bible._id,
                name: 'ELIAS',
                role: 'protagonist',
                currentStatus: 'Confused but driven.',
                relationships: []
            },
            { upsert: true, new: true }
        );

        const sara = await Character.findOneAndUpdate(
            { name: 'SARA' },
            {
                bibleId: bible._id,
                name: 'SARA',
                role: 'supporting',
                currentStatus: 'Concerned for Elias.',
                relationships: [{ targetCharName: 'ELIAS', dynamic: 'Wife, beginning to doubt his sanity.' }]
            },
            { upsert: true, new: true }
        );

        console.log('Setup Bible and Characters.');

        // 3. Generate Scene 1 (Triggers Global Outline)
        console.log('\n--- SCENE 1 (Triggers Global Outline) ---');
        const req1 = {
            userId: '000000000000000000000000',
            idea: 'Elias enters the elevator of the unfinished building and notices a button for the year 1995.',
            format: 'film' as any,
            style: 'non-linear' as any,
            bibleId: bible._id.toString(),
            characterIds: [elias._id.toString(), sara._id.toString()],
            useAdvancedCoherence: true
        };

        let scene1Content = '';
        for await (const chunk of scriptGenerator.generateScript(req1)) {
            scene1Content += chunk;
        }

        // Save Scene 1 to DB correctly so summarizer can see it later
        await new Scene({
            bibleId: bible._id,
            sequenceNumber: 1,
            slugline: 'INT. ELEVATOR - DAY',
            summary: 'Elias discovers the time-traveling elevator buttons.',
            content: scene1Content,
            status: 'drafted'
        }).save();

        // Wait for ALL background tasks (Outline + State)
        await scriptGenerator.waitForBackgroundTasks();

        const updatedBible = await Bible.findById(bible._id);
        if (updatedBible?.globalOutline?.length === 20) {
            console.log('✅ SUCCESS: Global Outline generated (20 beats).');
            console.log('Beats:', updatedBible.globalOutline.slice(0, 2), '...');
        } else {
            console.log('❌ ERROR: Global Outline failed to generate.');
        }

        // 4. Generate 4 more scenes
        console.log('\n--- Generating Scenes 2-5 ---');
        for (let i = 2; i <= 5; i++) {
            console.log(`Generating Scene ${i}...`);
            const req = {
                ...req1,
                idea: `Scene ${i}: Elias explores more floors, each revealing a past memory. Sara tries to pull him out.`,
                sceneLength: 'short' as any
            };

            let content = '';
            for await (const chunk of scriptGenerator.generateScript(req)) {
                content += chunk;
            }

            await new Scene({
                bibleId: bible._id,
                sequenceNumber: i,
                slugline: `INT. FLOOR ${i} - DAY`,
                summary: `Elias explores floor ${i} and interacts with Sara.`,
                content: content,
                status: 'drafted'
            }).save();
        }

        // Final Wait for Recursion + Last states
        await scriptGenerator.waitForBackgroundTasks();

        const finalBible = await Bible.findById(bible._id);
        console.log('\n--- FINAL BIBLE STATE ---');
        console.log('Scene Count:', finalBible?.sceneCount);
        console.log('Story So Far:', finalBible?.storySoFar);

        if (finalBible?.storySoFar && finalBible.storySoFar !== 'The story is just beginning.') {
            console.log('✅ SUCCESS: Recursive Summary updated.');
        } else {
            console.log('❌ ERROR: Recursive Summary failed or still pending.');
        }

        const updatedSara = await Character.findOne({ name: 'SARA' });
        console.log('Sara Relationships:', JSON.stringify(updatedSara?.relationships, null, 2));

    } catch (err) {
        console.error('❌ ERROR during verification:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

testMasterNovelist();
