
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'p:/Time pass/New folder/learning-os/script-writer-service/.env' });

async function findUserId() {
    await mongoose.connect(process.env.MONGODB_URI);
    const scene = await mongoose.connection.db.collection('scenes').findOne({ _id: new mongoose.Types.ObjectId('69835594ce5bbb032d004b90') });
    if (scene) {
        const bible = await mongoose.connection.db.collection('bibles').findOne({ _id: scene.bibleId });
        if (bible) {
            console.log('USER_ID:' + bible.userId.toString());
        } else {
            console.log('Bible not found');
        }
    } else {
        console.log('Scene not found');
    }
    await mongoose.disconnect();
}

findUserId();
