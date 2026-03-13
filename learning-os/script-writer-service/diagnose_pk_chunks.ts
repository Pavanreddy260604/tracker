
import mongoose from 'mongoose';
import { MasterScript } from './src/models/MasterScript';
import { VoiceSample } from './src/models/VoiceSample';

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/learning-os');
    console.log('[Diag] Connected.');

    const scripts = await MasterScript.find({});
    console.log(`[Diag] Total scripts: ${scripts.length}`);
    scripts.forEach(s => console.log(` - "${s.title}" (${s._id})`));

    const script = await MasterScript.findOne({ title: /PK/i });
    if (!script) {
        console.log('❌ PK script not found among titles');
        return;
    }

    console.log(`[Diag] Found PK Script: ${script._id} | Version: ${script.activeScriptVersion}`);

    // Check for "NIGHT1" or similar in sluglines
    const sluglines = await VoiceSample.find({
        masterScriptId: script._id,
        elementType: 'slug'
    }).sort({ sceneSeq: 1 });

    console.log(`\n[Diag] Checking Sluglines (Total: ${sluglines.length}):`);
    sluglines.slice(0, 5).forEach(s => {
        console.log(` - Seq ${s.sceneSeq}: "${s.content}" | SceneNum: ${s.sceneNumber}`);
    });

    // Check for page numbers 57., 58., 59.
    const pageNumbers = await VoiceSample.find({
        masterScriptId: script._id,
        content: /^\s*\d+\.?\s*$/
    });

    console.log(`\n[Diag] Checking Potential Page Numbers (Total: ${pageNumbers.length}):`);
    pageNumbers.forEach(p => {
        console.log(` - Content: "${p.content}" | nonPrinting: ${p.nonPrinting} | Type: ${p.elementType}`);
    });

    await mongoose.disconnect();
}

diagnose();
