import mongoose from 'mongoose';

const uris = [
    'mongodb://127.0.0.1:27017/ai-saas-app',
    'mongodb://localhost:27017/ai-saas-app',
    'mongodb://127.0.0.1:27017/learning-os'
];

async function testUri(uri) {
    console.log(`Testing: ${uri}`);
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log(`SUCCESS connected to ${uri}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error(`FAILED connected to ${uri}: ${err.message}`);
    }
}

async function run() {
    for (const uri of uris) {
        await testUri(uri);
    }
    process.exit(0);
}

run();
