
import mongoose from 'mongoose';
import { adminService } from './src/services/admin.service';
import { vectorService } from './src/services/vector.service';
import { VoiceSample } from './src/models/VoiceSample';
import { MasterScript } from './src/models/MasterScript';
import { aiServiceManager } from './src/services/ai.manager';

async function testHierarchicalRAG() {
    console.log('=== HIERARCHICAL RAG VERIFICATION TEST ===\n');

    try {
        await mongoose.connect('mongodb://localhost:27017/learning-os');
        console.log('✅ Connected to MongoDB.');

        // 1. Cleanup old test data
        const TEST_TITLE = "Hierarchical Test Script";
        const oldScripts = await MasterScript.find({ title: TEST_TITLE });
        for (const s of oldScripts) {
            await vectorService.deleteSamplesByMasterScriptId(s._id.toString());
        }
        await MasterScript.deleteMany({ title: TEST_TITLE });
        await VoiceSample.deleteMany({ source: new RegExp(TEST_TITLE) });
        console.log('✅ Cleaned up old test data (DB & Chroma).');

        // 2. Create a dummy master script with enough dialogue for beats
        const rawContent = `
EXT. OFFICE - DAY
BOSS
Where is the report?
CLERK
I forgot it, sir.
BOSS
You always forget it.
CLERK
I am sorry, sir. It won't happen again.
BOSS
That's what you said last time.
CLERK
This time I mean it.
        `;

        const script = await MasterScript.create({
            title: TEST_TITLE,
            director: "Test Director",
            rawContent,
            status: 'pending',
            tags: ['test', 'hierarchical']
        });
        console.log('✅ Created dummy master script.');

        // 3. Process the script (Triggering hierarchical ingestion)
        console.log('[Test] Triggering ingestion...');
        await adminService.processMasterScript(script._id as string);
        console.log('✅ Ingestion complete.');

        // 4. Verify MongoDB entries
        const beatNodes = await VoiceSample.find({
            masterScriptId: script._id,
            isHierarchicalNode: true
        });
        console.log(`[Verify] Found ${beatNodes.length} Beat Nodes in MongoDB.`);

        const dialogueNodes = await VoiceSample.find({
            masterScriptId: script._id,
            isHierarchicalNode: false
        });
        console.log(`[Verify] Found ${dialogueNodes.length} Dialogue Nodes in MongoDB.`);

        if (beatNodes.length === 0 || dialogueNodes.length === 0) {
            throw new Error('Missing nodes in MongoDB!');
        }

        // 5. Verify Parent-Child Linking
        const firstDialogue = dialogueNodes[0];
        if (!firstDialogue.parentNodeId) {
            throw new Error('Dialogue node missing parentNodeId!');
        }
        console.log('✅ Parent-Child linking verified in MongoDB.');

        // 6. Test Recursive Retrieval
        console.log('\n[Test] Testing Recursive Retrieval in VectorService...');
        const queryText = "Where is the report?";
        const queryEmbedding = await aiServiceManager.generateEmbedding(queryText);

        const results = await vectorService.findSimilarSamples(
            script._id.toString(), // Use scriptId as scope
            queryEmbedding,
            1,
            undefined,
            {
                includeParentContext: true,
                scopeType: 'masterScriptId' // Use the new scopeType option
            }
        );

        if (results.length === 0) {
            throw new Error('No search results found!');
        }

        const topResult = results[0];
        console.log(`[Result] Content: "${topResult.content}"`);
        console.log(`[Result] Parent Content Found: ${topResult.parentContent ? 'YES' : 'NO'}`);

        if (topResult.parentContent) {
            console.log('--- BEAT CONTEXT ---');
            console.log(topResult.parentContent);
            console.log('--------------------');
            console.log('✅ SUCCESS: Recursive retrieval working!');
        } else {
            throw new Error('Parent content failed to retrieve!');
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB.');
    }
}

testHierarchicalRAG();
