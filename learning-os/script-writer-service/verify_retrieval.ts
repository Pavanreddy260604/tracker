
import { vectorService } from './src/services/vector.service';
import { aiServiceManager } from './src/services/ai.manager';
import { VoiceSample } from './src/models/VoiceSample';
import mongoose from 'mongoose';

/**
 * TEST: Voice Bible Retrieval Accuracy
 * -----------------------------------
 * Verifies that LlamaIndex retrieval finds semantically similar character lines.
 */
async function testRetrieval() {
    console.log("--- STARTING VOICE BIBLE RETRIEVAL TEST ---");

    // 0. Connect to DB (Required for Mongoose models)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/script-writer';
    await mongoose.connect(mongoUri);
    console.log("[Test] Connected to MongoDB.");

    const bibleId = new mongoose.Types.ObjectId().toString();

    // 1. Mock a character sample
    const richText = "Speaker: Roy Batty. Line: \"I've seen things you people wouldn't believe. Attack ships on fire off the shoulder of Orion.\"";
    const sampleData = {
        _id: new mongoose.Types.ObjectId(),
        bibleId: new mongoose.Types.ObjectId(bibleId),
        content: "I've seen things you people wouldn't believe. Attack ships on fire off the shoulder of Orion.",
        speaker: "Roy Batty",
        embedding: await aiServiceManager.generateEmbedding(richText)
    };

    console.log("[Test] Saving mock sample to MongoDB...");
    await VoiceSample.create(sampleData);

    console.log("[Test] Upserting mock sample to Chroma via LlamaIndex...");
    await vectorService.upsertSample(sampleData as any);

    // 2. Perform semantic search (Exact Match Test)
    console.log("[Test] Searching for the exact same text...");
    const exactEmbedding = await aiServiceManager.generateEmbedding(richText);

    // Lower threshold for debugging
    const results = await vectorService.findSimilarSamples(bibleId, exactEmbedding, 5, undefined, { minSimilarity: 0.1 });

    console.log(`[Test] Found ${results.length} results.`);
    if (results.length > 0) {
        console.log(`[Test] Top match score: ${results[0].similarityScore.toFixed(4)}`);
        if (results[0].content === sampleData.content) {
            console.log("PASS: Exact match successful.");
        }
    }

    // 3. Perform semantic search (Semantic Test)
    console.log("[Test] Searching for 'space battles and memories'...");
    const queryEmbedding = await aiServiceManager.generateEmbedding("memories of space warfare and ships");

    const semanticResults = await vectorService.findSimilarSamples(bibleId, queryEmbedding, 5, undefined, { minSimilarity: 0.1 });

    if (semanticResults.length > 0) {
        console.log(`[Test] Semantic match: "${semanticResults[0].content}" (Score: ${semanticResults[0].similarityScore.toFixed(4)})`);
    } else {
        console.log("[Test] No semantic results found even with low threshold.");
    }

    // 4. Cleanup
    console.log("[Test] Cleaning up...");
    await VoiceSample.deleteOne({ _id: sampleData._id });
    await vectorService.deleteSample(sampleData._id.toString());

    console.log("--- TEST COMPLETE ---");
    process.exit(0);
}

if (require.main === module) {
    testRetrieval().catch(console.error);
}
