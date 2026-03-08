import mongoose from 'mongoose';
import { vectorService } from './src/services/vector.service';
import { aiServiceManager } from './src/services/ai.manager';
import { VoiceSample } from './src/models/VoiceSample';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSemanticDedupe() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);

    console.log("=== SEMANTIC DEDUPLICATION VERIFICATION TEST ===");

    const bibleId = new mongoose.Types.ObjectId().toString();
    const line1 = "I am going to the market to buy some fresh fruit.";
    const line2 = "I'm going to the market to buy some fresh fruits."; // 99% similar

    console.log(`\n[Line 1]: "${line1}"`);
    console.log(`[Line 2]: "${line2}"`);

    // 1. Ingest Line 1
    console.log("\n[Test] Ingesting Line 1...");
    const emb1 = await aiServiceManager.generateEmbedding(`Speaker: TEST. Line: "${line1}"`);
    const sample1 = await VoiceSample.create({
        bibleId: new mongoose.Types.ObjectId(bibleId),
        content: line1,
        contentHash: 'hash1',
        speaker: 'TEST',
        embedding: emb1,
        source: 'Dedupe Test'
    });
    await vectorService.upsertSample(sample1 as any);
    console.log("  ✅ Line 1 indexed.");

    // 2. Check Line 2 for Semantic Duplicate
    console.log("\n[Test] Checking Line 2 for semantic similarity (Threshold: 0.98)...");
    const emb2 = await aiServiceManager.generateEmbedding(`Speaker: TEST. Line: "${line2}"`);

    const isDuplicate = await vectorService.isSemanticallyDuplicate(bibleId, emb2, 0.98);

    if (isDuplicate) {
        console.log("  ✅ SUCCESS: Line 2 detected as semantic duplicate.");
    } else {
        console.log("  ❌ FAILED: Line 2 was NOT detected as a duplicate.");

        // Let's see what the actual score was
        const results = await vectorService.findSimilarSamples(bibleId, emb2, 1);
        if (results.length > 0) {
            console.log(`  Actual Similarity Score: ${results[0].similarityScore}`);
        }
    }

    // Cleanup
    await VoiceSample.deleteMany({ bibleId });
    await vectorService.deleteSamplesByMasterScriptId(bibleId); // Reusing this for cleanup
    await mongoose.disconnect();

    console.log("\n=== TEST COMPLETE ===");
}

testSemanticDedupe().catch(console.error);
