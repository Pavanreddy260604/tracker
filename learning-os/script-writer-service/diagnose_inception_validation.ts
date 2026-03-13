
import mongoose from 'mongoose';
import { MasterScriptValidationReport } from './src/models/MasterScriptValidationReport';
import { MasterScript } from './src/models/MasterScript';

async function diagnose() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);
    console.log('[Diag] Connected.');

    const version = 'v_mmiy0pvq_t6josz';
    console.log(`[Diag] Diagnosing version: ${version}`);

    const report = await MasterScriptValidationReport.findOne({ scriptVersion: version }).lean();
    if (!report) {
        console.log('❌ Validation report not found for this version.');

        const script = await MasterScript.findOne({ activeScriptVersion: version });
        if (script) {
            console.log(`[Diag] Script ID: ${script._id} | Title: ${script.title}`);
        } else {
            const all = await MasterScript.find({}).limit(5);
            console.log("[Diag] Recent scripts:");
            all.forEach(a => console.log(` - ${a.title} (${a.activeScriptVersion})`));
        }
        return;
    }

    console.log(`[Diag] Status: ${report.status}`);
    console.log(`[Diag] Summary: ${report.summary}`);

    if (report.missingLines && report.missingLines.length > 0) {
        console.log(`\n[Diag] Missing Lines (${report.missingLines.length}):`);
        report.missingLines.slice(0, 20).forEach((m: any) => {
            console.log(` - Line ${m.lineNo}: ID ${m.lineId} | Detail: ${m.detail}`);
        });
    }

    if (report.extraLines && report.extraLines.length > 0) {
        console.log(`\n[Diag] Extra Lines (${report.extraLines.length}):`);
        report.extraLines.slice(0, 5).forEach((e: any) => {
            console.log(` - Line ${e.lineNo}: ID ${e.lineId} | Detail: ${e.detail}`);
        });
    }

    if (report.hierarchyMismatches && report.hierarchyMismatches.length > 0) {
        console.log(`\n[Diag] Hierarchy Mismatches (${report.hierarchyMismatches.length}):`);
        report.hierarchyMismatches.slice(0, 5).forEach((h: any) => {
            console.log(` - Chunk: ${h.chunkId} | Detail: ${h.detail}`);
        });
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
