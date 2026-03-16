import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env from parents
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { Character } from '../models/Character';
import { Bible } from '../models/Bible';

async function deduplicateCharacters() {
    console.log('--- Character Deduplication Tool ---');
    
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const bibles = await Bible.find({}).lean();
    for (const bible of bibles) {
        console.log(`Checking Bible: ${bible.title} (${bible._id})`);
        const characters = await Character.find({ bibleId: bible._id }).lean();
        
        const seen = new Map<string, any>();
        const duplicates = [];

        for (const char of characters) {
            const normalized = char.name.trim().toUpperCase();
            if (seen.has(normalized)) {
                duplicates.push(char);
                console.log(`  Found duplicate: ${char.name} (Keep: ${seen.get(normalized).name})`);
            } else {
                seen.set(normalized, char);
            }
        }

        if (duplicates.length > 0) {
            console.log(`  Deleting ${duplicates.length} duplicates...`);
            for (const dup of duplicates) {
                await Character.deleteOne({ _id: dup._id });
            }
        } else {
            console.log('  No duplicates found.');
        }
    }

    await mongoose.disconnect();
    console.log('Finished.');
}

deduplicateCharacters().catch(console.error);
