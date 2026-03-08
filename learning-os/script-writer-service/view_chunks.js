const mongoose = require('mongoose');
const fs = require('fs');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/learning-os');

    // Get the most recent script's chunks
    const samples = await mongoose.connection.db.collection('voicesamples')
        .find({ chunkType: 'dialogue' })
        .sort({ createdAt: -1 })
        .limit(729)
        .toArray();

    console.log(`=== FETCHED ${samples.length} RECENT CHUNKS ===`);

    let output = "=== RECENT CHUNKS SAVED TO VECTOR DB ===\n\n";

    for (const s of samples) {
        output += `--- Source: ${s.source} ---\n`;
        output += `Speaker: ${s.speaker || 'Unknown'}\n`;
        output += `Tags: ${s.tags?.join(', ') || 'None'}\n`;
        output += `Language Context: ${s.language || 'English'}\n`;
        output += `Content:\n"${s.content}"\n`;
        output += `Embedding Size: ${s.embedding?.length || 0} dimensions\n\n`;
    }

    fs.writeFileSync('pk_chunks_output.txt', output);
    console.log("Successfully wrote all chunks to pk_chunks_output.txt");

    await mongoose.disconnect();
}

run().catch(console.error);
