import mongoose, { Document, Schema } from 'mongoose';

/**
 * Project Study Schema
 * Tracks code reading and project understanding
 */

export interface IProjectStudy extends Document {
    user: mongoose.Types.ObjectId;
    projectName: string;
    repoUrl: string; // Optional
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
    coreComponents?: string; // New: replaces involvedTables
    tasks?: {
        id: string;
        text: string;
        status: 'todo' | 'in-progress' | 'done';
    }[];
}

const projectStudySchema = new Schema<IProjectStudy>(
    {
        user: {
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
            required: true,
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
        }]
    },
    {
        timestamps: true,
    }
);

// Unified sync for coreComponents / involvedTables
projectStudySchema.pre('save', function (next) {
    if (this.coreComponents && !this.involvedTables) {
        this.involvedTables = this.coreComponents;
    } else if (this.involvedTables && !this.coreComponents) {
        this.coreComponents = this.involvedTables;
    }
    next();
});

// Force updatedAt update on findOneAndUpdate
projectStudySchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Indexes
projectStudySchema.index({ user: 1, date: -1 });
projectStudySchema.index({ user: 1, projectName: 1 });

export const ProjectStudy = mongoose.model<IProjectStudy>('ProjectStudy', projectStudySchema);
