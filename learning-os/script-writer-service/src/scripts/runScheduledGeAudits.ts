import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MasterScript } from '../models/MasterScript';
import { adminService } from '../services/admin.service';

dotenv.config();

async function runScheduledGeAudits() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(mongoUri);

    try {
        const scripts = await MasterScript.find({
            activeScriptVersion: { $exists: true, $ne: null }
        })
            .select('_id activeScriptVersion title')
            .lean();

        console.log(`[GE-Audit] Found ${scripts.length} scripts with active versions.`);

        for (const script of scripts) {
            try {
                const result = await adminService.runGeAudit(
                    script._id.toString(),
                    script.activeScriptVersion || undefined
                );
                console.log(
                    `[GE-Audit] script=${script._id} title="${script.title}" version=${script.activeScriptVersion} status=${result.status}`
                );
            } catch (err: any) {
                console.error(
                    `[GE-Audit] script=${script._id} failed: ${err.message || err}`
                );
            }
        }
    } finally {
        await mongoose.disconnect();
    }
}

runScheduledGeAudits().catch(err => {
    console.error('[GE-Audit] Fatal error:', err);
    process.exit(1);
});
