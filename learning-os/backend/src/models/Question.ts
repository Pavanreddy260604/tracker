import mongoose, { Document, Schema } from 'mongoose';

export interface ITestCase {
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    isEdgeCase: boolean;
    edgeCaseType?: 
        | 'empty_input' 
        | 'single_element' 
        | 'max_constraints' 
        | 'min_constraints' 
        | 'overflow' 
        | 'null_undefined' 
        | 'duplicate_values' 
        | 'negative_values' 
        | 'boundary_value' 
        | 'performance_stress'
        | 'none';
    explanation: string;
}

export interface ILanguageSignatures {
    javascript: string;
    python: string;
    java: string;
    cpp: string;
    go: string;
}

export interface IQuestion extends Document {
    title: string;
    slug: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
    companies: string[];
    type: 'coding' | 'sql' | 'system-design' | 'behavioral';
    functionName?: string;
    signatures: ILanguageSignatures;
    testCases: ITestCase[];
    timeComplexity: string;
    spaceComplexity: string;
    hints: string[];
    solution: {
        approach: string;
        code: Record<string, string>;
        complexityExplanation: string;
    };
    source: 'ai_generated' | 'leetcode' | 'hackerrank' | 'geeksforgeeks' | 'manual' | 'ctci';
    aiGenerated: boolean;
    frequency: number;
    timesUsed: number;
    averageScore: number;
    successRate: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const testCaseSchema = new Schema<ITestCase>({
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
    isEdgeCase: { type: Boolean, default: false },
    edgeCaseType: {
        type: String,
        enum: [
            'empty_input', 'single_element', 'max_constraints', 'min_constraints',
            'overflow', 'null_undefined', 'duplicate_values', 'negative_values',
            'boundary_value', 'performance_stress', 'none'
        ]
    },
    explanation: { type: String, default: '' }
}, { _id: false });

const questionSchema = new Schema<IQuestion>(
    {
        title: { type: String, required: true, trim: true, index: true },
        slug: { type: String, required: true, unique: true, index: true },
        description: { type: String, required: true, minlength: 50 },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
        topics: [{ type: String, index: true }],
        companies: [{ type: String, index: true }],
        type: { type: String, enum: ['coding', 'sql', 'system-design', 'behavioral'], required: true, default: 'coding' },
        functionName: { type: String },
        signatures: {
            javascript: { type: String, required: true },
            python: { type: String, required: true },
            java: { type: String, required: true },
            cpp: { type: String, required: true },
            go: { type: String, required: true }
        },
        testCases: [testCaseSchema],
        timeComplexity: { type: String, default: 'O(n)' },
        spaceComplexity: { type: String, default: 'O(n)' },
        hints: [String],
        solution: {
            approach: { type: String, default: '' },
            code: { type: Map, of: String, default: {} },
            complexityExplanation: { type: String, default: '' }
        },
        source: { type: String, enum: ['ai_generated', 'leetcode', 'hackerrank', 'geeksforgeeks', 'manual', 'ctci'], default: 'manual' },
        aiGenerated: { type: Boolean, default: false, index: true },
        frequency: { type: Number, default: 0, min: 0, max: 100 },
        timesUsed: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0, min: 0, max: 100 },
        successRate: { type: Number, default: 0, min: 0, max: 100 },
        isActive: { type: Boolean, default: true, index: true }
    },
    { timestamps: true }
);

// Compound indexes
questionSchema.index({ difficulty: 1, topics: 1, isActive: 1 });
questionSchema.index({ type: 1, difficulty: 1 });
questionSchema.index({ frequency: -1, difficulty: 1 });

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
