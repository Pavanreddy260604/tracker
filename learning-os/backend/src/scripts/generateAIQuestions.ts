import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StructuredQuestionService } from '../services/ai/structuredQuestion.service.js';
import { AIClientService } from '../services/aiClient.service.js';
import { Question } from '../models/Question.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';

const aiClient = new AIClientService();
const questionGenerator = new StructuredQuestionService(aiClient);

const TOPICS = [
    'Array', 'String', 'HashTable', 'DynamicProgramming',
    'Stack', 'Heap', 'Greedy', 'BinarySearch', 'Tree'
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Configuration
const BATCH_SIZE_PER_TOPIC = 2; // How many questions per topic per run
const MAX_RETRIES = 3;

async function connect() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
}

async function generateAndSaveQuestions() {
    await connect();

    console.log(`🚀 Starting AI Question Population...`);
    let addedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const topic of TOPICS) {
        console.log(`\n📂 Processing Topic: ${topic}`);

        for (const difficulty of DIFFICULTIES) {
            // Generate a few questions for this combination
            for (let i = 0; i < BATCH_SIZE_PER_TOPIC; i++) {
                process.stdout.write(`   generating ${difficulty} question ${i + 1}/${BATCH_SIZE_PER_TOPIC}... `);

                let attempts = 0;
                let success = false;

                while (attempts < MAX_RETRIES && !success) {
                    attempts++;
                    const data = await questionGenerator.generateCuratedQuestion(difficulty, [topic]);

                    if (!data || !data.title || !data.slug) {
                        process.stdout.write('❌ (Invalid JSON) ');
                        continue;
                    }

                    // Check for Duplicates
                    const exists = await Question.findOne({
                        $or: [{ slug: data.slug }, { title: data.title }]
                    });

                    if (exists) {
                        process.stdout.write('⚠️ (Duplicate) ');
                        // Should we retry to find a non-duplicate? 
                        // For now, let's just count it as skipped to avoid infinite loops
                        skippedCount++;
                        success = true; // "Handled"
                    } else {
                        // Save to DB
                        try {
                            const q = new Question(data);
                            await q.save();
                            process.stdout.write(`✅ Saved: ${data.title}\n`);
                            addedCount++;
                            success = true;
                        } catch (err: any) {
                            process.stdout.write(`❌ (Save Error: ${err.message}) `);
                        }
                    }
                }
                if (!success) {
                    process.stdout.write(`❌ (Failed after ${MAX_RETRIES} attempts)\n`);
                    failedCount++;
                }
            }
        }
    }

    console.log(`\n🎉 Population Complete!`);
    console.log(`   Added: ${addedCount}`);
    console.log(`   Skipped (Duplicates): ${skippedCount}`);
    console.log(`   Failed: ${failedCount}`);

    process.exit(0);
}

generateAndSaveQuestions();
