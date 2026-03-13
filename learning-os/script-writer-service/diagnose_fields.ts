
import mongoose from 'mongoose';
const MONGODB_URI = 'mongodb://localhost:27017/learning-os';

async function diagnose() {
    await mongoose.connect(MONGODB_URI);
    try {
        const total = await mongoose.connection.db.collection('voicesamples').countDocuments({});
        const withParent = await mongoose.connection.db.collection('voicesamples').countDocuments({ parentNodeId: { $exists: true } });
        const hierarchical = await mongoose.connection.db.collection('voicesamples').countDocuments({ isHierarchicalNode: true });
        const nonHierarchical = await mongoose.connection.db.collection('voicesamples').countDocuments({ isHierarchicalNode: false });
        const missingField = await mongoose.connection.db.collection('voicesamples').countDocuments({ isHierarchicalNode: { $exists: false } });

        console.log(`TOTAL:${total}`);
        console.log(`WITH_PARENT:${withParent}`);
        console.log(`HIERARCHICAL:${hierarchical}`);
        console.log(`NON_HIERARCHICAL:${nonHierarchical}`);
        console.log(`MISSING_FIELD:${missingField}`);

        const oneWithParent = await mongoose.connection.db.collection('voicesamples').findOne({ parentNodeId: { $exists: true } });
        console.log('ONE_WITH_PARENT:' + JSON.stringify(oneWithParent));

    } finally {
        await mongoose.disconnect();
    }
}
diagnose();
