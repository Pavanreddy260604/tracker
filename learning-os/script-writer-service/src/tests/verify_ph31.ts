import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Bible } from '../models/Bible';
import { Character } from '../models/Character';
import { Scene } from '../models/Scene';

dotenv.config();

async function testParallelBatch() {
    console.log('Starting Phase 31 Verification: Parallel Block Generation...');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
    console.log('Connected to MongoDB.');

    // 1. Setup/Fetch Bible
    let bible = await Bible.findOne({ title: 'Architect of Shadows' });
    if (!bible) {
        bible = await new Bible({
            userId: new mongoose.Types.ObjectId('000000000000000000000000'),
            title: 'Architect of Shadows',
            logline: 'An architect discovers that the skyscraper he is building exists in a parallel world.',
            genre: 'Sci-Fi',
            storySoFar: 'The architect Elias has just found a door on the 13th floor that does not exist on the blueprints.',
            globalOutline: [
                "INT. 13TH FLOOR HALLWAY - NIGHT: Elias finds the phantom door.",
                "INT. 14TH FLOOR JAZZ CLUB - NIGHT: He enters a 1920s jazz club on the 14th floor.",
                "INT. BACKSTAGE - NIGHT: He meets a woman who claims to be his mother, but younger than him.",
                "INT. BUILDING - NIGHT: The building starts shifting floors like a Rubik's cube."
            ]
        }).save();
    }

    // 2. Setup Characters
    let elias = await Character.findOne({ name: 'Elias' });
    if (!elias) {
        elias = await new Character({
            bibleId: bible._id,
            name: 'Elias',
            role: 'protagonist',
            currentStatus: 'Confused but driven',
            relationships: []
        }).save();
    }

    console.log('\n--- PHASE 31: PARALLEL BLOCK PLANNING (Scenes 5-14) ---');
    const startTime = Date.now();

    // Architect Phase: Plan 10 scenes
    const blockBeats = await scriptGenerator.generateBlockBeatSheet(bible._id.toString(), 5, 10);
    console.log(`[Architect] Planned ${blockBeats.length} scenes.`);
    console.log(JSON.stringify(blockBeats, null, 2));

    if (blockBeats.length === 0) {
        console.error('Failed to generate beat sheet.');
        process.exit(1);
    }

    console.log('\n--- PHASE 31: PARALLEL GENERATION (Workers) ---');
    const generationStartTime = Date.now();

    const results = await scriptGenerator.generateBatch(
        {
            userId: '000000000000000000000000',
            bibleId: bible._id.toString(),
            characterIds: [elias._id.toString()],
            idea: 'Write the next sequence of scenes for the Architect experiment.',
            format: 'film',
            style: 'non-linear'
        },
        blockBeats
    );

    const endTime = Date.now();
    const architectDuration = (generationStartTime - startTime) / 1000;
    const workerDuration = (endTime - generationStartTime) / 1000;
    const totalDuration = (endTime - startTime) / 1000;

    console.log('\n--- VERIFICATION RESULTS ---');
    console.log(`Architect Planning: ${architectDuration.toFixed(2)}s`);
    console.log(`Worker Generation (Parallel): ${workerDuration.toFixed(2)}s`);
    console.log(`Total Batch Time (10 Scenes): ${totalDuration.toFixed(2)}s`);
    console.log(`Average Time per Scene (Sequential): ${(totalDuration / 10).toFixed(2)}s`);

    const successes = results.filter(r => r.success).length;
    console.log(`Successes: ${successes} / ${blockBeats.length}`);

    if (successes === blockBeats.length) {
        console.log('✅ Phase 31 Verification Successful!');
    } else {
        console.log('❌ Some scenes failed to generate.');
    }

    await mongoose.disconnect();
}

testParallelBatch();
