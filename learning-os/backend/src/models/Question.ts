import mongoose, { Document, Schema } from 'mongoose';

export interface ITestResult {
    input: string;
    expectedOutput: string;
    isHidden: boolean;
}

export interface IQuestion extends Document {
    slug: string; // url-friendly-name
    title: string;
    description: string; // Markdown
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
    templates: {
        [language: string]: string; // e.g. "javascript": "function twoSum()..."
    };
    testCases: ITestResult[];
    createdAt: Date;
    updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
    {
        slug: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
        topics: [{ type: String, index: true }],
        templates: { type: Map, of: String, default: {} },
        testCases: [
            {
                input: { type: String, required: true },
                expectedOutput: { type: String, required: true },
                isHidden: { type: Boolean, default: false },
            },
        ],
    },
    { timestamps: true }
);

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
