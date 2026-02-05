import mongoose, { Schema, Document } from 'mongoose';

export interface IScene extends Document {
    bibleId: mongoose.Types.ObjectId;
    sequenceNumber: number; // 1, 2, 3...
    slugline: string; // INT. BAR - NIGHT

    // The "Architect" Output
    summary: string; // "Hero enters bar and orders a drink."
    goal: string; // "Show that the Hero is an alcoholic but functional."

    // The "Writer" Output
    content: string; // The generated script text

    // The "Critic" Output
    status: 'planned' | 'drafted' | 'reviewed' | 'final';
    feedback?: string; // Legacy feedback field

    // Detailed Critique Data
    critique?: {
        score: number;
        grade: string;
        summary: string;
        formattingIssues: string[];
        dialogueIssues: string[];
        pacingIssues: string[];
        suggestions: string[];
    };

    // The "Neural Link" (Interconnections)
    charactersInvolved: mongoose.Types.ObjectId[];
    mentionedItems: string[]; // Chekhov's guns introduced here
    previousSceneSummary?: string; // What happened before?

    createdAt: Date;
    updatedAt: Date;
}

const SceneSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible', required: true },
    sequenceNumber: { type: Number, required: true },
    slugline: { type: String, required: true },

    summary: { type: String, required: true },
    goal: { type: String },

    content: { type: String, default: '' },

    status: {
        type: String,
        enum: ['planned', 'drafted', 'reviewed', 'final'],
        default: 'planned'
    },
    feedback: { type: String },

    critique: {
        score: { type: Number },
        grade: { type: String },
        summary: { type: String },
        formattingIssues: [{ type: String }],
        dialogueIssues: [{ type: String }],
        pacingIssues: [{ type: String }],
        suggestions: [{ type: String }]
    },

    charactersInvolved: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
    mentionedItems: [{ type: String }],
    previousSceneSummary: { type: String }
}, { timestamps: true });

// Index for fast retrieval of the script in order
SceneSchema.index({ bibleId: 1, sequenceNumber: 1 });

export const Scene = mongoose.model<IScene>('Scene', SceneSchema);
