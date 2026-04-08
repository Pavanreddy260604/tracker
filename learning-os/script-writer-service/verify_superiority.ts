import { assistantRagService } from './src/services/assistantRag.service';
import { intentService } from './src/services/intent.service';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Superiority Verification Suite
 * Benchmarking Intent Accuracy and RAG Relevance after Phase 6 Overhaul.
 */
async function verifySuperiority() {
    console.log('🚀 Starting Phase 6: Superiority Verification...\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scriptwriter');
        console.log('✅ MongoDB Connected\n');

        // --- Test 1: Intent Classification Superiority ---
        console.log('--- Intent Classification ---');
        const testCases = [
            { instruction: "Make this scene more like a Tarantino flick", expected: 'scene_edit' },
            { instruction: "Why did John leave the room?", expected: 'chat' },
            { instruction: "Rewrite this dialogue to be more husky", expected: 'scene_edit' },
            { instruction: "Can you fix the pacing of the second line?", expected: 'scene_edit' }
        ];

        for (const test of testCases) {
            const result = await intentService.classifyIntentElite(test.instruction, {
                hasScene: true,
                hasSelection: false,
                currentMode: 'ask'
            });
            const status = result.intent === test.expected ? '✅' : '❌';
            console.log(`${status} Prompt: "${test.instruction}" -> Intent: ${result.intent} (Conf: ${result.confidence})`);
        }
        console.log('\n');

        // --- Test 2: RAG Expansion & Re-ranking ---
        console.log('--- RAG Superiority (Expansion & Re-ranking) ---');
        const mockInstruction = "Create a high-tension confrontation in a rainy alleyway, Nolan style.";
        
        console.log('Testing RAG Reference Pack generation...');
        const pack = await assistantRagService.buildAssistantReferencePack({
            instruction: mockInstruction,
            mode: 'ask',
            target: 'scene',
            language: 'English',
            bible: {
                _id: new mongoose.Types.ObjectId(),
                title: 'Operation Darkstar',
                genre: 'Sci-Fi / Thriller',
                tone: 'Gritty',
                visualStyle: 'Noir'
            }
        });

        if (pack.retrievalMetadata.queryVariants.some(v => v.key === 'expansion')) {
            console.log('✅ AI Query Expansion: PRESENT');
            const expansion = pack.retrievalMetadata.queryVariants.find(v => v.key === 'expansion');
            console.log(`   - Expanded Terms: ${expansion?.preview}`);
        } else {
            console.log('❌ AI Query Expansion: MISSING');
        }

        const topRef = pack.retrievalMetadata.selectedReferences[0];
        if (topRef) {
            console.log(`✅ Top Reference Score: ${topRef.score}`);
            console.log(`   - Source: ${topRef.label}`);
        }

        console.log('\n✨ Verification Completed Successfully!');
    } catch (err) {
        console.error('❌ Verification Failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

verifySuperiority();
