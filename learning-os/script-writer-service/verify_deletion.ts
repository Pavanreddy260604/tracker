
import { vectorService } from './src/services/vector.service';
import { aiServiceManager } from './src/services/ai.manager';
import { VoiceSample } from './src/models/VoiceSample';
import mongoose from 'mongoose';

/**
 * TEST: Metadata-Based Deletion Accuracy
 * -------------------------------------
 * Verifies that vectorService.deleteSamplesByMasterScriptId correctly removes
 * all vectors associated with a master script metadata.
 */
async function testDeletion() {
    console.log("--- STARTING METADATA DELETION TEST ---");

    // 0. Connect to DB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/script-writer';
    await mongoose.connect(mongoUri);
    console.log("[Test] Connected to MongoDB.");

    const masterScriptId = new mongoose.Types.ObjectId().toString();
    const bibleId = new mongoose.Types.ObjectId().toString();

    // 1. Create a few mock samples
    const sampleIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
        const id = new mongoose.Types.ObjectId();
        sampleIds.push(id.toString());

        const sampleData = {
            _id: id,
            bibleId: new mongoose.Types.ObjectId(bibleId),
            masterScriptId: new mongoose.Types.ObjectId(masterScriptId),
            content: `Test dialogue line ${i} for deletion.`,
            speaker: "Test Character",
            embedding: await aiServiceManager.generateEmbedding(`Speaker: Test. Line: "Test dialogue line ${i}"`)
        };

        console.log(`[Test] Ingesting sample ${i}...`);
        await VoiceSample.create(sampleData);
        await vectorService.upsertSample(sampleData as any);
    }

    // 2. Verify they are searchable
    console.log("[Test] Verifying samples are searchable...");
    const queryEmbedding = await aiServiceManager.generateEmbedding("Test dialogue");
    const resultsBefore = await vectorService.findSimilarSamples(bibleId, queryEmbedding, 10);
    console.log(`[Test] Found ${resultsBefore.length} results before deletion.`);

    if (resultsBefore.length < 3) {
        console.error("FAIL: Not all samples were found before deletion.");
    }

    // 3. Delete by Master Script ID
    console.log(`[Test] Deleting vectors for masterScriptId: ${masterScriptId}...`);
    await vectorService.deleteSamplesByMasterScriptId(masterScriptId);

    // 4. Verify they are gone
    console.log("[Test] Verifying samples are GONE...");
    const resultsAfter = await vectorService.findSimilarSamples(bibleId, queryEmbedding, 10);
    console.log(`[Test] Found ${resultsAfter.length} results after deletion.`);

    if (resultsAfter.length === 0) {
        console.log("PASS: Metadata-based deletion successful.");
    } else {
        console.error(`FAIL: ${resultsAfter.length} samples still exist!`);
    }

    // 5. Cleanup MongoDB
    console.log("[Test] Cleaning up MongoDB...");
    await VoiceSample.deleteMany({ _id: { $in: sampleIds } });

    console.log("--- TEST COMPLETE ---");
    process.exit(0);
}

if (require.main === module) {
    testDeletion().catch(console.error);
}
