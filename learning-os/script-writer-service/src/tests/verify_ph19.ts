import { chunkerService } from '../services/chunker.service';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const sampleScript = `
BHISHMA
(calmly)
I have lived through a thousand suns, child. Do not think your little spark can blind me.

KRISHNA
(with a smile)
The sun itself bows to the truth, Pitamaha. Why do you resist?
`;

async function test() {
    console.log("Starting Phase 19 Verification: Beat-Aware Ingestion...");
    try {
        const result = await chunkerService.parseScreenplay(sampleScript);

        console.log("\n--- CHUNKER OUTPUT ---");
        result.chunks.forEach((c, i) => {
            if (c.type === 'dialogue') {
                console.log(`CHUNK ${i} [${c.speaker}]: "${c.content.slice(0, 30)}..."`);
                console.log(`  > TACTIC: ${c.tactic || 'MISSING'}`);
                console.log(`  > EMOTION: ${c.emotion || 'MISSING'}`);
            }
        });

        const allHaveTactics = result.chunks
            .filter(c => c.type === 'dialogue')
            .every(c => !!c.tactic && !!c.emotion);

        if (allHaveTactics) {
            console.log("\n✅ SUCCESS: Tactics and Emotions detected correctly.");
        } else {
            console.log("\n❌ FAILURE: Some chunks are missing tactics/emotions.");
            process.exit(1);
        }
    } catch (err) {
        console.error("\n❌ ERROR during verification:", err);
        process.exit(1);
    }
}

test();
