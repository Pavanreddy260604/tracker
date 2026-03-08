import mongoose from 'mongoose';
import { treatmentService } from './src/services/treatment.service';
import { Scene } from './src/models/Scene';
import { Treatment } from './src/models/Treatment';
import * as dotenv from 'dotenv';

dotenv.config();

async function testNaming() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);

    console.log("=== SCENE NAMING VERIFICATION TEST ===");

    // 1. Create a dummy Bible ID
    const bibleId = new mongoose.Types.ObjectId();

    // 2. Create a dummy Treatment
    console.log("\n[Test] Creating dummy Treatment with creative beats...");
    const treatment = await Treatment.create({
        bibleId,
        logline: "A futuristic heist in a world without sound.",
        style: "Save The Cat",
        acts: [
            {
                name: "Act 1",
                beats: [
                    {
                        name: "Opening Image",
                        title: "The Silent Neon Rain",
                        slugline: "EXT. TOKYO ROOFTOP - NIGHT",
                        description: "A thief stands in the rain, but no splashing is heard."
                    },
                    {
                        name: "Theme Stated",
                        title: "Echoes of Silence",
                        slugline: "INT. THIEF'S HIDEBOLT - NIGHT",
                        description: "A mentor explains why sound is the ultimate sin."
                    }
                ]
            }
        ]
    });

    console.log(`[Test] Treatment created: ${treatment._id}`);

    // 3. Convert to Scenes
    console.log("\n[Test] Converting Treatment to Scenes...");
    const result = await treatmentService.convertToScenes(treatment._id.toString());
    console.log(`[Test] Created ${result.count} scenes.`);

    // 4. Verify Scene Fields
    console.log("\n[Test] Verifying Scene Integrity:");
    const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });

    for (const scene of scenes) {
        console.log(`\nScene #${scene.sequenceNumber}:`);
        console.log(`  TITLE:    ${scene.title}`);
        console.log(`  SLUGLINE: ${scene.slugline}`);
        console.log(`  SUMMARY:  ${scene.summary}`);

        if (scene.sequenceNumber === 1) {
            if (scene.title === "The Silent Neon Rain" && scene.slugline === "EXT. TOKYO ROOFTOP - NIGHT") {
                console.log("  ✅ SUCCESS: Title and Slugline preserved.");
            } else {
                console.log("  ❌ FAILED: Metadata lost during conversion.");
            }
        }
    }

    // Cleanup
    await Treatment.findByIdAndDelete(treatment._id);
    await Scene.deleteMany({ bibleId });
    await mongoose.disconnect();

    console.log("\n=== TEST COMPLETE ===");
}

testNaming().catch(console.error);
