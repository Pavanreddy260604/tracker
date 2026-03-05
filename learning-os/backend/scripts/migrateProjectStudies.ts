import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProjectStudy } from '../src/models/ProjectStudy.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const studies = await ProjectStudy.find({
            $or: [
                { coreComponents: { $exists: false } },
                { coreComponents: '' }
            ],
            involvedTables: { $ne: '' }
        });

        console.log(`Found ${studies.length} studies to migrate`);

        for (const study of studies) {
            study.coreComponents = study.involvedTables;
            await study.save();
            console.log(`Migrated: ${study.projectName} - ${study.moduleStudied}`);
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
