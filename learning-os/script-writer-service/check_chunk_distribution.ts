
import mongoose from 'mongoose';
import { MasterScript } from './src/models/MasterScript';
import { VoiceSample } from './src/models/VoiceSample';

async function diagnose() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const scripts = await MasterScript.find({});
    console.log(`Found ${scripts.length} Master Scripts.`);

    for (const script of scripts) {
        const samples = await VoiceSample.find({ masterScriptId: script._id });
        const versions = Array.from(new Set(samples.map(s => s.scriptVersion)));

        console.log(`\n--- Script: ${script.title} (${script._id}) ---`);
        console.log(`Total Samples: ${samples.length}`);
        console.log(`Versions: ${versions.join(', ')}`);

        for (const version of versions) {
            const versionSamples = samples.filter(s => s.scriptVersion === version);
            const sceneNodes = versionSamples.filter(s => s.isHierarchicalNode);
            const leafNodes = versionSamples.filter(s => !s.isHierarchicalNode);

            console.log(`  Version: ${version}`);
            console.log(`    Total Chunks: ${versionSamples.length}`);
            console.log(`    Scene Chunks: ${sceneNodes.length}`);
            console.log(`    Leaf Chunks:  ${leafNodes.length}`);

            // Sample a few leaf nodes to check content quality
            if (leafNodes.length > 0) {
                console.log(`    Sample Leaf Content:`);
                leafNodes.slice(0, 3).forEach(l => {
                    console.log(`      [${l.chunkType}] ${l.content.substring(0, 60)}...`);
                });
            }
        }
    }

    mongoose.connection.close();
}

diagnose().catch(console.error);
