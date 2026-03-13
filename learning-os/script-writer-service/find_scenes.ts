
import mongoose from 'mongoose';
const MONGODB_URI = 'mongodb://localhost:27017/learning-os';

async function diagnose() {
    await mongoose.connect(MONGODB_URI);
    try {
        const masterScriptId = '69ad6d755e9286c1914caf42';
        console.log(`Checking for Scene Nodes for Master Script: ${masterScriptId}`);

        const scenes = await mongoose.connection.db.collection('voicesamples').find({
            masterScriptId: new mongoose.Types.ObjectId(masterScriptId),
            chunkType: 'scene'
        }).toArray();

        console.log(`Found ${scenes.length} scene nodes in DB.`);
        if (scenes.length > 0) {
            console.log('Sample Scene Node IDs:');
            scenes.slice(0, 5).forEach(s => console.log(` - ID: ${s._id} | Seq: ${s.sceneSeq}`));
        } else {
            // Check if they are stored without masterScriptId or different field
            const anyScenes = await mongoose.connection.db.collection('voicesamples').find({
                chunkType: 'scene'
            }).limit(5).toArray();
            console.log(`Found ${anyScenes.length} TOTAL scene nodes across all scripts.`);
            anyScenes.forEach(s => console.log(` - ID: ${s._id} | MasterScript: ${s.masterScriptId} | Seq: ${s.sceneSeq}`));
        }

    } finally {
        await mongoose.disconnect();
    }
}
diagnose();
