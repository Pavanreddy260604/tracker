import mongoose, { Document, Schema } from 'mongoose';

/**
 * Project Study Schema
 * Tracks code reading and project understanding
 */

export interface IProjectStudy extends Document {
    userId: mongoose.Types.ObjectId;
    projectName: string;
    repoUrl: string;
    moduleStudied: string;
    flowUnderstood: boolean;
    flowUnderstanding: string;
    involvedTables: string;
    questions: string;
    notes: string;
    date: Date;
    // Project Studies 2.0
    architectureDiagram?: string;
    keyTakeaways?: string[];
    coreComponents?: string;
    tasks?: {
        id: string;
        text: string;
        status: 'todo' | 'in-progress' | 'done';
    }[];
    confidenceLevel?: number; // 1-5 (Phychology: Metacognition)
    simpleExplanation?: string; // Feynman Technique
}

const projectStudySchema = new Schema<IProjectStudy>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        projectName: {
            type: String,
            required: [true, 'Project name is required'],
            trim: true,
        },
        repoUrl: {
            type: String,
            default: '',
        },
        moduleStudied: {
            type: String,
            required: [true, 'Module name is required'],
            trim: true,
        },
        flowUnderstood: {
            type: Boolean,
            default: false,
        },
        flowUnderstanding: {
            type: String,
            default: '',
        },
        involvedTables: {
            type: String,
            default: '',
        },
        coreComponents: {
            type: String,
            default: '',
        },
        questions: {
            type: String,
            default: '',
        },
        notes: {
            type: String,
            default: '',
        },
        date: {
            type: Date,
            default: Date.now,
        },
        // Project Studies 2.0
        architectureDiagram: {
            type: String,
            default: '',
        },
        keyTakeaways: {
            type: [String],
            default: [],
        },
        tasks: [{
            id: String,
            text: String,
            status: {
                type: String,
                enum: ['todo', 'in-progress', 'done'],
                default: 'todo'
            }
        }],
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

// Force updatedAt update on findOneAndUpdate
projectStudySchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Indexes
projectStudySchema.index({ userId: 1, date: -1 });
projectStudySchema.index({ userId: 1, projectName: 1 });

export const ProjectStudy = mongoose.model<IProjectStudy>('ProjectStudy', projectStudySchema);
