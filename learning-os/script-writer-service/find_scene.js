
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'p:/Time pass/New folder/learning-os/script-writer-service/.env' });

async function findScene() {
    await mongoose.connect(process.env.MONGODB_URI);
    const scene = await mongoose.connection.db.collection('scenes').findOne({});
    if (scene) {
        console.log('SCENE_ID:' + scene._id.toString());
    } else {
        console.log('No scene found');
    }
    await mongoose.disconnect();
}

findScene();
