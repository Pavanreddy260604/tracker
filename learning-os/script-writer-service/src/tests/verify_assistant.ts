import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Bible } from '../models/Bible';

dotenv.config();

async function testAssistant() {
    console.log('Starting Phase 34 Verification: AI Script Assistant...');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');

    const originalScene = `
INT. DINER - NIGHT
    
RAVI sits alone, picking at a cold plate of fries. The neon sign outside flickers.
    
RAVI
(to himself)
Where is she?
    
He checks his watch. 2:00 AM.
`;

    const instructions = [
        "Make this scene more suspenseful and cinematic.",
        "Add a mysterious character named 'The Shadow' who is watching Ravi from a booth in the back.",
        "Rewrite the dialogue so Ravi sounds more desperate and angry."
    ];

    let currentContent = originalScene;

    for (const instruction of instructions) {
        console.log(`\n--- APPLYING INSTRUCTION: "${instruction}" ---`);
        const startTime = Date.now();

        let revisedContent = '';
        const stream = scriptGenerator.assistedEdit(currentContent, instruction);

        for await (const chunk of stream) {
            revisedContent += chunk;
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`Edit completed in ${duration.toFixed(2)}s.`);
        console.log('--- REVISED CONTENT ---');
        console.log(revisedContent);

        currentContent = revisedContent; // Chain edits
    }

    console.log('\n✅ Phase 34 Verification Complete!');
    await mongoose.disconnect();
}

testAssistant();
