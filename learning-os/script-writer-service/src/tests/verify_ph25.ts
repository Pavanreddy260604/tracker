
import mongoose from 'mongoose';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Character } from '../models/Character';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

async function testAdvancedCoherence() {
    console.log('Starting Phase 25/26 Verification: Ultimate Coherence...');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log('Connected to MongoDB.');

        // 1. Setup Test Data
        const testUser = await User.findOneAndUpdate(
            { email: 'nolan@example.com' },
            {
                email: 'nolan@example.com',
                name: 'Christopher Nolan',
                scriptInterests: {
                    directors: ['Christopher Nolan', 'Quentin Tarantino'],
                    genres: ['Sci-Fi', 'Thriller'],
                    styles: ['Non-Linear', 'Visual-Minimal']
                }
            },
            { upsert: true, new: true }
        );

        const testChar = await Character.findOneAndUpdate(
            { name: 'KOBB' },
            {
                name: 'KOBB',
                currentStatus: 'Searching for the truth in a dream within a dream.',
                heldItems: ['A small silver spinning top']
            },
            { upsert: true, new: true }
        );

        console.log('Setup test data (User & Character).');

        // 2. Trigger Advanced Generation
        const request = {
            userId: testUser._id.toString(),
            idea: 'Kobb finds himself in a library. He realizes he has the wrong totem.',
            format: 'film' as any,
            style: 'non-linear' as any,
            characterIds: [testChar._id.toString()],
            useAdvancedCoherence: true
        };

        console.log('\n--- ADVANCED GENERATION START ---');
        let fullOutput = '';
        const generator = scriptGenerator.generateScript(request);

        for await (const chunk of generator) {
            process.stdout.write(chunk);
            fullOutput += chunk;
        }
        console.log('\n--- ADVANCED GENERATION END ---\n');

        // 3. Verification Logic
        const hasSummary = fullOutput.includes('STORY_CONTEXT_SUMMARY:');
        const hasPlan = fullOutput.includes('SCENE_PLAN:');
        const hasScript = fullOutput.includes('SCENE_SCRIPT:');
        const hasCharUpdate = fullOutput.includes('CHARACTER_MEMORY_UPDATE (JSON):');
        const hasPlotUpdate = fullOutput.includes('PLOT_STATE_UPDATE (JSON):');

        if (hasSummary && hasPlan && hasScript && hasCharUpdate && hasPlotUpdate) {
            console.log('✅ SUCCESS: All Coherence sections present.');
        } else {
            console.log('❌ ERROR: Missing one or more Coherence sections.');
            console.log('Output keys found:', { hasSummary, hasPlan, hasScript, hasCharUpdate, hasPlotUpdate });
        }

        // Check for specific character context injection
        if (fullOutput.toLowerCase().includes('kobb')) {
            console.log('✅ SUCCESS: Character context (Kobb) correctly utilized.');
        }

    } catch (err) {
        console.error('❌ ERROR during verification:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testAdvancedCoherence();
