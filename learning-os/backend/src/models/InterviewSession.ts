import mongoose, { Document, Schema } from 'mongoose';

export interface IInterviewQuestion {
    questionId?: mongoose.Types.ObjectId;
    problemName: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    description: string;
    type: 'coding' | 'sql' | 'behavioral' | 'system-design';
    status: 'pending' | 'solved' | 'failed' | 'skipped';
    userCode?: string;
    userAnswer?: string;
    feedback?: string;
    score?: number;
    testCases?: {
        input: string;
        expectedOutput: string;
        isHidden?: boolean;
        isEdgeCase?: boolean;
    }[];
    timeSpent?: number; // in seconds
    submittedAt?: Date;
}

export interface IInterviewSection {
    id: string;
    name: string;
    type: 'warm-up' | 'coding' | 'sql' | 'behavioral' | 'system-design' | 'mixed';
    duration: number; // in minutes
    questions: IInterviewQuestion[];
    status: 'pending' | 'start' | 'submitted';
    startTime?: Date;
    endTime?: Date;
    sectionScore?: number;
}

export interface IInterviewSession extends Document {
    userId: mongoose.Types.ObjectId;
    config: {
        duration: number; // total duration in minutes
        sectionCount: number;
        difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
        language?: string;
        hasCameraAccess?: boolean;
        strictMode?: boolean; // Enables strict proctoring
        sections: {
            name: string;
            type: 'warm-up' | 'coding' | 'sql' | 'behavioral' | 'system-design' | 'mixed';
            duration: number; // in minutes
            questionCount: number;
        }[];
    };
    sections: IInterviewSection[];
    status: 'start' | 'submitted';
    currentSectionIndex: number;
    totalScore: number;
    overallFeedback: string;
    startedAt: Date;
    endedAt?: Date;
    // Proctoring data
    proctoring?: {
        cameraAccessGranted: boolean;
        fullscreenRequired: boolean;
        tabSwitchCount: number;
        idleTime: number; // in seconds
        lastActivityTime: Date;
    };
    // Performance analytics
    analytics?: {
        totalTimeSpent: number; // in seconds
        timePerQuestion: { questionId: string; timeSpent: number }[];
        sectionPerformance: { sectionId: string; score: number; timeSpent: number }[];
        difficultyBreakdown: { difficulty: string; count: number; averageScore: number }[];
        topicBreakdown: { topic: string; count: number; averageScore: number }[];
        strengths: string[];
        areasForImprovement: string[];
    };
}

const interviewQuestionSchema = new Schema<IInterviewQuestion>(
    {
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        problemName: { type: String, required: true },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
        description: { type: String }, // AI generated description
        type: { type: String, enum: ['coding', 'sql', 'behavioral', 'system-design'], required: true },
        status: {
            type: String,
            enum: ['pending', 'solved', 'failed', 'skipped'],
            default: 'pending',
        },
        userCode: { type: String },
        userAnswer: { type: String },
        feedback: { type: String },
        score: { type: Number },
        testCases: [
            {
                input: String,
                expectedOutput: String,
                isHidden: { type: Boolean, default: false },
                isEdgeCase: { type: Boolean, default: false },
            },
        ],
        timeSpent: { type: Number },
        submittedAt: { type: Date },
    },
    { _id: false }
);

const interviewSectionSchema = new Schema<IInterviewSection>(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['warm-up', 'coding', 'sql', 'behavioral', 'system-design', 'mixed'], required: true },
        duration: { type: Number, required: true },
        questions: [interviewQuestionSchema],
        status: {
            type: String,
            enum: ['pending', 'start', 'submitted'],
            default: 'pending',
        },
        startTime: { type: Date },
        endTime: { type: Date },
        sectionScore: { type: Number, default: 0 },
    },
    { _id: false }
);

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
            sectionCount: { type: Number, required: true },
            difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], required: true },
            language: { type: String, default: 'javascript' },
            hasCameraAccess: { type: Boolean, default: false },
            strictMode: { type: Boolean, default: true },
            sections: [
                {
                    name: { type: String, required: true },
                    type: { type: String, enum: ['warm-up', 'coding', 'sql', 'behavioral', 'system-design', 'mixed'], required: true },
                    duration: { type: Number, required: true },
                    questionCount: { type: Number, required: true },
                },
            ],
        },
        sections: [interviewSectionSchema],
        status: {
            type: String,
            enum: ['start', 'submitted'],
            default: 'start',
        },
        currentSectionIndex: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        overallFeedback: { type: String },
        startedAt: { type: Date, default: Date.now },
        endedAt: { type: Date },
        proctoring: {
            cameraAccessGranted: { type: Boolean, default: false },
            fullscreenRequired: { type: Boolean, default: true },
            tabSwitchCount: { type: Number, default: 0 },
            idleTime: { type: Number, default: 0 },
            lastActivityTime: { type: Date, default: Date.now },
        },
        analytics: {
            totalTimeSpent: { type: Number, default: 0 },
            timePerQuestion: [
                {
                    questionId: { type: String, required: true },
                    timeSpent: { type: Number, required: true },
                },
            ],
            sectionPerformance: [
                {
                    sectionId: { type: String, required: true },
                    score: { type: Number, required: true },
                    timeSpent: { type: Number, required: true },
                },
            ],
            difficultyBreakdown: [
                {
                    difficulty: { type: String, required: true },
                    count: { type: Number, required: true },
                    averageScore: { type: Number, required: true },
                },
            ],
            topicBreakdown: [
                {
                    topic: { type: String, required: true },
                    count: { type: Number, required: true },
                    averageScore: { type: Number, required: true },
                },
            ],
            strengths: [String],
            areasForImprovement: [String],
        },
    },
    { timestamps: true }
);

export const InterviewSession = mongoose.model<IInterviewSession>('InterviewSession', interviewSessionSchema);
