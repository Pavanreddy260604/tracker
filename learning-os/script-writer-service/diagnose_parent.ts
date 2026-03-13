
import mongoose from 'mongoose';
const MONGODB_URI = 'mongodb://localhost:27017/learning-os';

async function diagnose() {
    await mongoose.connect(MONGODB_URI);
    const parentIdStr = '69ad7024ce6daa50058ec23d';

    try {
        console.log(`Checking Parent ID: ${parentIdStr}`);

        // 1. Raw Driver
        const raw = await mongoose.connection.db.collection('voicesamples').findOne({ _id: new mongoose.Types.ObjectId(parentIdStr) });
        console.log(`Raw Driver Result: ${raw ? 'FOUND' : 'NOT FOUND'}`);
        if (raw) console.log(`Raw Content: ${raw.content.substring(0, 50)}...`);

        // 2. Mongoose
        const VoiceSample = mongoose.model('VoiceSample');
        const mgo = await VoiceSample.findById(parentIdStr);
        console.log(`Mongoose findById Result: ${mgo ? 'FOUND' : 'NOT FOUND'}`);

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}
diagnose();
