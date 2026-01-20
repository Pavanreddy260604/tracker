import mongoose, { Document, Schema } from 'mongoose';

export interface IInterviewSession extends Document {
    userId: mongoose.Types.ObjectId;
    config: {
        duration: number; // in minutes
        questionCount: number;
        difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
        language?: string;
    };
    questions: {
        questionId?: mongoose.Types.ObjectId;
        problemName: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        description: string;
        status: 'pending' | 'solved' | 'failed';
        userCode?: string;
        feedback?: string;
        score?: number;
        testCases?: { input: string; expectedOutput: string }[];
    }[];
    status: 'in-progress' | 'completed' | 'aborted';
    totalScore: number;
    overallFeedback: string;
    startedAt: Date;
    endedAt?: Date;
}

const interviewSessionSchema = new Schema<IInterviewSession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        config: {
            duration: { type: Number, required: true },
            questionCount: { type: Number, required: true },
            difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], required: true },
            language: { type: String, default: 'javascript' },
        },
        questions: [
            {
                questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
                problemName: { type: String, required: true },
                difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
                description: { type: String }, // AI generated description
                status: {
                    type: String,
                    enum: ['pending', 'solved', 'failed'],
                    default: 'pending',
                },
                userCode: { type: String },
                feedback: { type: String },
                score: { type: Number },
                testCases: [{ input: String, expectedOutput: String }],
            },
        ],
        status: {
            type: String,
            enum: ['in-progress', 'completed', 'aborted'],
            default: 'in-progress',
        },
        totalScore: { type: Number, default: 0 },
        overallFeedback: { type: String },
        startedAt: { type: Date, default: Date.now, expires: 86400 }, // Auto-delete after 24 hours
        endedAt: { type: Date },
    },
    { timestamps: true }
);

export const InterviewSession = mongoose.model<IInterviewSession>('InterviewSession', interviewSessionSchema);
