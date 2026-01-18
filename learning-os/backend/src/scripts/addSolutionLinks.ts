
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { DSAProblem } from '../models/DSAProblem.js';

dotenv.config();

const addSolutionLinks = async () => {
    try {
        await connectDB();

        console.log('🔄 Updating existing problems with solution links...');

        const result = await DSAProblem.updateMany(
            { solutionLink: { $in: [null, ''] } }, // Find problems with no link
            {
                $set: {
                    solutionLink: 'https://leetcode.com/problems/two-sum/description/'
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} problems with dummy solution links.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
};

addSolutionLinks();
