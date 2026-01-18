
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { BackendTopic } from '../models/BackendTopic.js';
import { DSAProblem } from '../models/DSAProblem.js';

dotenv.config();

const DATA_COUNT = 20; // Number of items to generate per type

const TOPICS = ['node', 'express', 'database', 'auth', 'api', 'system-design'];
const TYPES = ['theory', 'feature', 'bug-fix', 'optimization'];
const PLATFORMS = ['leetcode', 'gfg', 'codeforces'];
const DSA_TOPICS = ['arrays', 'strings', 'dp', 'graphs', 'trees', 'linked-list'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const seedExtensive = async () => {
    try {
        await connectDB();

        const user = await User.findOne();
        if (!user) {
            console.error('❌ No user found! Create a user first.');
            process.exit(1);
        }

        console.log(`👤 Seeding EXTENSIVE data for: ${user.username}`);

        // === Seeding Backend Topics ===
        console.log('📚 Generating Backend Topics...');
        const backendTopics = [];

        for (let i = 0; i < DATA_COUNT; i++) {
            const isDue = Math.random() > 0.7; // 30% chance to be "Review Due"
            const category = TOPICS[Math.floor(Math.random() * TOPICS.length)];

            backendTopics.push({
                userId: user._id,
                topicName: `Topic ${i + 1}: Advanced ${category.toUpperCase()} Concepts`,
                category: category as any,
                type: TYPES[Math.floor(Math.random() * TYPES.length)] as any,
                status: 'completed',
                date: new Date().toISOString().split('T')[0],
                // SRS
                reviewStage: isDue ? 1 : Math.floor(Math.random() * 4) + 1,
                nextReviewDate: isDue
                    ? new Date(Date.now() - 86400000).toISOString().split('T')[0] // Yesterday
                    : new Date(Date.now() + 86400000 * (Math.floor(Math.random() * 10) + 1)).toISOString().split('T')[0], // Future
                subTopics: Array(3).fill(null).map((_, idx) => ({
                    id: `${i}-${idx}`,
                    text: `Subtopic ${idx + 1} for ${category}`,
                    isCompleted: Math.random() > 0.2
                }))
            });
        }
        await BackendTopic.insertMany(backendTopics);
        console.log(`✅ Added ${DATA_COUNT} Backend Topics`);

        // === Seeding DSA Problems ===
        console.log('🧩 Generating DSA Problems...');
        const dsaProblems = [];

        for (let i = 0; i < DATA_COUNT; i++) {
            const isDue = Math.random() > 0.6; // 40% chance to be "Review Due"
            const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
            const topic = DSA_TOPICS[Math.floor(Math.random() * DSA_TOPICS.length)];

            dsaProblems.push({
                userId: user._id,
                problemName: `Problem ${i + 1}: ${topic.charAt(0).toUpperCase() + topic.slice(1)} Challenge`,
                platform: PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)] as any,
                topic: topic,
                difficulty: difficulty as any,
                status: 'solved',
                timeSpent: Math.floor(Math.random() * 60) + 10,
                date: new Date().toISOString().split('T')[0],
                // SRS
                reviewStage: isDue ? 2 : Math.floor(Math.random() * 4) + 1,
                nextReviewDate: isDue
                    ? new Date(Date.now() - 86400000).toISOString() // Yesterday
                    : new Date(Date.now() + 86400000 * (Math.floor(Math.random() * 14) + 1)).toISOString(), // Future
                companyTags: ['Google', 'Meta', 'Amazon'].slice(0, Math.floor(Math.random() * 3) + 1)
            });
        }
        await DSAProblem.insertMany(dsaProblems);
        console.log(`✅ Added ${DATA_COUNT} DSA Problems`);

        console.log('🎉 Extensive Seeding Complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedExtensive();
