import mongoose, { Document, Schema } from 'mongoose';

/**
 * DSA Problem Schema
 * 
 * DIFFICULTY WEIGHTING (for insights):
 * Easy = 1, Medium = 2, Hard = 3
 * Score = problems_solved * difficulty_weight
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ProblemStatus = 'solved' | 'revisit' | 'attempted';
export type Platform =
    | 'leetcode'
    | 'gfg'
    | 'codeforces'
    | 'codechef'
    | 'hackerrank'
    | 'neetcode'
    | 'other';

export const DIFFICULTY_WEIGHTS: Record<Difficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
};

export interface IDSAProblem extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    problemName: string;
    platform: Platform;
    topic: string;
    difficulty: Difficulty;
    timeSpent: number; // in minutes
    status: ProblemStatus;
    patternLearned: string;
    mistakes: string;
    solutionLink: string;
    notes: string;
    date: string; // YYYY-MM-DD

    // DSA 2.0 - SRS & Metadata
    nextReviewDate?: Date;
    reviewStage?: number;
    reviewInterval?: number;
    easeFactor?: number;
    solutionCode?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    companyTags?: string[];
    confidenceLevel?: number; // 1-5 (Phychology: Metacognition)
    simpleExplanation?: string; // Feynman Technique

    createdAt: Date;
    updatedAt: Date;
}

const dsaProblemSchema = new Schema<IDSAProblem>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        problemName: {
            type: String,
            required: [true, 'Problem name is required'],
            trim: true,
            maxlength: [200, 'Problem name cannot exceed 200 characters'],
        },
        platform: {
            type: String,
            enum: ['leetcode', 'gfg', 'codeforces', 'codechef', 'hackerrank', 'neetcode', 'other'],
            default: 'leetcode',
        },
        topic: {
            type: String,
            required: [true, 'Topic is required'],
            trim: true,
            maxlength: [100, 'Topic cannot exceed 100 characters'],
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            required: [true, 'Difficulty is required'],
        },
        timeSpent: {
            type: Number,
            default: 0,
            min: [0, 'Time cannot be negative'],
            max: [1440, 'Time cannot exceed 24 hours'],
        },
        status: {
            type: String,
            enum: ['solved', 'revisit', 'attempted'],
            default: 'solved',
        },
        patternLearned: {
            type: String,
            default: '',
            maxlength: [500, 'Pattern cannot exceed 500 characters'],
        },
        mistakes: {
            type: String,
            default: '',
            maxlength: [1000, 'Mistakes cannot exceed 1000 characters'],
        },
        solutionLink: {
            type: String,
            default: '',
            maxlength: [500, 'Link cannot exceed 500 characters'],
        },
        notes: {
            type: String,
            default: '',
            maxlength: [5000, 'Notes cannot exceed 5000 characters'],
        },
        date: {
            type: String,
            required: [true, 'Date is required'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
        },
        // DSA 2.0 Fields
        nextReviewDate: {
            type: Date,
        },
        reviewStage: {
            type: Number,
            default: 1, // Start at Stage 1 (Review in 1 day)
        },
        reviewInterval: {
            type: Number,
            default: 1, // Start with 1 day interval
        },
        easeFactor: {
            type: Number,
            default: 2.5, // Standard SM-2 starting ease
        },
        solutionCode: {
            type: String,
            default: '',
        },
        timeComplexity: {
            type: String,
            default: '',
            maxlength: [50, 'Complexity too long'],
        },
        spaceComplexity: {
            type: String,
            default: '',
            maxlength: [50, 'Complexity too long'],
        },
        companyTags: {
            type: [String],
            default: [],
        },
        confidenceLevel: {
            type: Number,
            min: 1,
            max: 5,
            default: 3,
        },
        simpleExplanation: {
            type: String,
            default: '',
            maxlength: [2000, 'Explanation cannot exceed 2000 characters'],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
dsaProblemSchema.index({ userId: 1, date: -1 });
dsaProblemSchema.index({ userId: 1, topic: 1 });
dsaProblemSchema.index({ userId: 1, difficulty: 1 });
dsaProblemSchema.index({ userId: 1, status: 1 }); // Added for status filtering
dsaProblemSchema.index({ userId: 1, platform: 1 }); // INFRA: Added for platform-specific queries

export const DSAProblem = mongoose.model<IDSAProblem>('DSAProblem', dsaProblemSchema);
