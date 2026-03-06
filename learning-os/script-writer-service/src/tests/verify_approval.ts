import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { Scene } from '../models/Scene';
import { Bible } from '../models/Bible';

dotenv.config();

async function testApprovalFlow() {
    console.log('Starting Phase 35 Verification: Assistant Approval Flow...');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');

    // 1. Setup Test Data
    const bible = await new Bible({
        title: 'Approval Test Project',
        userId: new mongoose.Types.ObjectId().toString(),
        genre: 'Drama',
        storySoFar: 'A test project for approval workflows.'
    }).save();

    const scene = await new Scene({
        bibleId: bible._id,
        sequenceNumber: 1,
        slugline: 'INT. TEST ROOM - DAY',
        summary: 'Original summary for testing.',
        content: 'Original content that needs improvement.',
        status: 'drafted'
    }).save();

    console.log('Original Scene Content:', scene.content);

    // 2. Propose an Edit
    const instruction = "Make this scene a high-stakes interrogation.";
    console.log(`\nProposing edit with instruction: "${instruction}"...`);

    await scriptGenerator.applyAndProposeEdit(scene._id.toString(), instruction);

    const proposedScene = await Scene.findById(scene._id);
    console.log('Proposed (Pending) Content:', proposedScene?.pendingContent);
    console.log('Current Content (Unchanged):', proposedScene?.content);

    if (proposedScene?.pendingContent && proposedScene.content === 'Original content that needs improvement.') {
        console.log('✅ PROPOSAL SUCCESS: Content remains original, pendingContent is populated.');
    }

    // 3. Commit the Edit
    console.log('\nCommitting the proposed edit...');
    const result = await scriptGenerator.commitAssistedEdit(scene._id.toString());

    const finalScene = await Scene.findById(scene._id);
    console.log('Final Content:', finalScene?.content);
    console.log('Pending Content (Should be empty):', finalScene?.pendingContent);

    if (result && finalScene?.content !== 'Original content that needs improvement.' && !finalScene?.pendingContent) {
        console.log('✅ COMMIT SUCCESS: Content updated, pendingContent cleared.');
    } else {
        console.log('❌ COMMIT FAILED');
    }

    console.log('\n✅ Phase 35 Verification Complete!');
    await mongoose.disconnect();
}

testApprovalFlow();
