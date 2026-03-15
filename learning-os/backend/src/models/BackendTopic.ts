import mongoose, { Document, Schema } from 'mongoose';

/**
 * Backend Topic Schema
 * Tracks backend learning: Node, DB, Auth, API, System Design
 */

export type BackendCategory = 'node' | 'database' | 'auth' | 'api' | 'system-design' | 'devops' | 'other';
export type TopicType = 'theory' | 'feature' | 'bug-fix' | 'refactor';
export type TopicStatus = 'completed' | 'in-progress' | 'revisit';
export type ReviewStage = 1 | 2 | 3 | 4; // 1=Day 1, 2=Day 4, 3=Day 7, 4=Done

export interface IBackendTopic extends Document {
    userId: mongoose.Types.ObjectId;
    topicName: string;
    category: BackendCategory;
    type: TopicType;
    status: TopicStatus;
    filesModified: string;
    bugsFaced: string;
    notes: string;
    date: string; // YYYY-MM-DD
    // SRS (1-4-7 Method)
    nextReviewDate?: string;
    reviewStage?: number; // 1, 2, 3, 4 (Done)
    // Backend Topics 2.0
    subTopics?: {
        id: string;
        text: string;
        isCompleted: boolean;
    }[];
    auditScore?: number;
    resources?: {
        title: string;
        url: string;
        type: 'video' | 'article' | 'docs' | 'course';
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const backendTopicSchema = new Schema<IBackendTopic>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        topicName: {
            type: String,
            required: [true, 'Topic name is required'],
            trim: true,
            maxlength: [200, 'Topic name cannot exceed 200 characters'],
        },
        category: {
            type: String,
            enum: ['node', 'express', 'database', 'auth', 'api', 'system-design', 'devops', 'security', 'testing', 'performance', 'other'],
            required: [true, 'Category is required'],
        },
        type: {
            type: String,
            enum: ['theory', 'feature', 'bug-fix', 'refactor', 'optimization'],
            default: 'theory',
        },
        status: {
            type: String,
            enum: ['completed', 'in_progress', 'planned'],
            default: 'completed',
        },
        filesModified: {
            type: String,
            default: '',
        },
        bugsFaced: {
            type: String,
            default: '',
            maxlength: [2000, 'Bugs description cannot exceed 2000 characters'],
        },
        notes: {
            type: String,
            default: '',
            maxlength: [5000, 'Notes cannot exceed 5000 characters'],
        },
        // Backend Topics 2.0
        subTopics: [{
            id: String,
            text: String,
            isCompleted: { type: Boolean, default: false }
        }],
        resources: [{
            title: String,
            url: String,
            type: {
                type: String,
                enum: ['video', 'article', 'docs', 'course'],
                default: 'docs'
            }
        }],
        date: {
            type: String,
            required: [true, 'Date is required'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
        },
        // SRS (1-4-7 Method)
        nextReviewDate: {
            type: String,
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
        },
        reviewStage: {
            type: Number,
            default: 1, // Start at Stage 1 (Review in 1 day)
        },
        auditScore: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance
backendTopicSchema.index({ userId: 1, date: -1 });
backendTopicSchema.index({ userId: 1, category: 1 });

export const BackendTopic = mongoose.model<IBackendTopic>('BackendTopic', backendTopicSchema);
