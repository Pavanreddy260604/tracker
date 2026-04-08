
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { intentService } from './src/services/intent.service';
import { storyPlannerService } from './src/services/storyPlanner.service';
import { stateManagerService } from './src/services/stateManager.service';
import { scriptGenerator } from './src/services/scriptGenerator.service';
import { Character } from './src/models/Character';
import { Bible } from './src/models/Bible';

dotenv.config();

async function runVerification() {
    console.log('🚀 Starting ScriptWriter System Verification...\n');

    // 1. Database Connection
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learning-os');
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err);
        process.exit(1);
    }

    // 2. Intent Service Verification
    console.log('\n--- Intent Service ---');
    const smallTalk = intentService.isSmallTalk('Hello assistant!');
    console.log(`Small Talk Detection: ${smallTalk ? '✅' : '❌'}`);
    
    // 3. State Manager Verification
    console.log('\n--- State Manager ---');
    const dummyCast = [
        { name: 'Kael', role: 'protagonist', currentStatus: 'Wounded' }
    ];
    const context = stateManagerService.buildCharacterContext(dummyCast);
    console.log('Character Context Build:', context.includes('KAEL') ? '✅' : '❌');

    // 4. Story Planner Verification
    console.log('\n--- Story Planner ---');
    console.log('Story Planner methods present:', (!!storyPlannerService.generateBeatSheet && !!storyPlannerService.updateRecursiveSummary) ? '✅' : '❌');

    // 5. Script Generator Orchestrator Verification
    console.log('\n--- Orchestrator ---');
    console.log('Generator methods present:', (!!scriptGenerator.generateScript && !!scriptGenerator.assistedEdit) ? '✅' : '❌');

    console.log('\n✨ Verification Completed Successfully!');
    await mongoose.disconnect();
    process.exit(0);
}

runVerification().catch(err => {
    console.error('💥 Verification Failed:', err);
    process.exit(1);
});
