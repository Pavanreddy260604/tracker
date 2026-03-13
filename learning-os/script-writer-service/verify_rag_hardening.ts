
import mongoose from 'mongoose';
import { vectorService } from './src/services/vector.service';
import { llamaindexService } from './src/services/llamaindex.service';
import { VoiceSample } from './src/models/VoiceSample';

const MONGODB_URI = 'mongodb://localhost:27017/learning-os';

async function verifyRAG() {
    await mongoose.connect(MONGODB_URI);
    try {
        // Use the script that we KNOW has scene nodes: 69adc543cd237058c60574b8
        const targetMasterId = '69adc543cd237058c60574b8';
        console.log(`[Test] Using Master Script ID: ${targetMasterId}`);

        const leaf = await VoiceSample.findOne({
            masterScriptId: new mongoose.Types.ObjectId(targetMasterId),
            isHierarchicalNode: false,
            parentNodeId: { $exists: true }
        }).lean();

        if (!leaf) {
            console.log('NO_LEAF_FOUND_FOR_TARGET_SCRIPT');
            return;
        }

        console.log(`[Test] Leaf ID: ${leaf._id}`);
        console.log(`[Test] Expected Parent: ${leaf.parentNodeId}`);

        // Double check parent exists
        const parent = await VoiceSample.findById(leaf.parentNodeId);
        console.log(`[Test] Parent Existence Check: ${parent ? 'FOUND' : 'NOT FOUND'}`);

        const realEmbedding = await llamaindexService.getEmbedding(leaf.content);
        const results = await vectorService.findSimilarSamples(
            targetMasterId,
            realEmbedding,
            5,
            undefined,
            {
                includeParentContext: true,
                scopeType: 'masterScriptId'
            }
        );

        console.log(`[Test] Retrieved: ${results.length}`);

        const sampleWithParent = results.find(s => s.parentContent);
        if (sampleWithParent) {
            console.log('HIERARCHICAL_SUCCESS');
            console.log(`[Test] Parent Sample: ${sampleWithParent.parentContent?.substring(0, 100)}...`);
        } else {
            console.log('HIERARCHICAL_FAILURE');
            if (results[0]) {
                console.log(`[Test] Result 0 Parent ID: ${results[0].parentNodeId}`);
            }
        }

    } finally {
        await mongoose.disconnect();
    }
}
verifyRAG();
