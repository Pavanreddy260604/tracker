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

    // The "High Water Mark" (Highest scoring version ever)
    highScore?: {
        content: string;
        critique: {
            score: number;
            grade: string;
            summary: string;
            formattingIssues: string[];
            dialogueIssues: string[];
            pacingIssues: string[];
            suggestions: string[];
        };
        savedAt: Date;
    };

    // The "Neural Link" (Interconnections)
    charactersInvolved: mongoose.Types.ObjectId[];
    mentionedItems: string[]; // Chekhov's guns introduced here
    previousSceneSummary?: string; // What happened before?

    createdAt: Date;
    updatedAt: Date;
}

// Valid status options
const VALID_STATUSES = ['planned', 'drafted', 'reviewed', 'final'] as const;

const SceneSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    sequenceNumber: {
        type: Number,
        required: [true, 'Sequence number is required'],
        min: [1, 'Sequence number must be at least 1']
    },
    slugline: {
        type: String,
        required: [true, 'Slugline is required'],
        trim: true,
        maxlength: [200, 'Slugline cannot exceed 200 characters'],
        validate: {
            validator: function (v: string) {
                // Validate scene header format
                return /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+$/i.test(v);
            },
            message: 'Invalid slugline format. Expected: "INT. LOCATION - TIME" or "EXT. LOCATION - TIME"'
        }
    },

    summary: {
        type: String,
        required: [true, 'Summary is required'],
        maxlength: [2000, 'Summary cannot exceed 2000 characters']
    },
    goal: {
        type: String,
        maxlength: [1000, 'Goal cannot exceed 1000 characters']
    },

    content: {
        type: String,
        default: '',
        maxlength: [100000, 'Content cannot exceed 100,000 characters']
    },

    status: {
        type: String,
        enum: {
            values: [...VALID_STATUSES],
            message: 'Invalid status. Allowed: ' + VALID_STATUSES.join(', ')
        },
        default: 'planned'
    },
    feedback: {
        type: String,
        maxlength: [5000, 'Feedback cannot exceed 5000 characters']
    },

    critique: {
        score: {
            type: Number,
            min: [0, 'Score must be between 0 and 100'],
            max: [100, 'Score must be between 0 and 100']
        },
        grade: {
            type: String,
            maxlength: [10, 'Grade cannot exceed 10 characters']
        },
        summary: {
            type: String,
            maxlength: [2000, 'Critique summary cannot exceed 2000 characters']
        },
        formattingIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        dialogueIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        pacingIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        suggestions: [{
            type: String,
            maxlength: [500, 'Each suggestion cannot exceed 500 characters']
        }]
    },

    highScore: {
        content: {
            type: String,
            maxlength: [100000, 'High score content cannot exceed 100,000 characters']
        },
        critique: {
            score: {
                type: Number,
                min: [0, 'Score must be between 0 and 100'],
                max: [100, 'Score must be between 0 and 100']
            },
            grade: {
                type: String,
                maxlength: [10, 'Grade cannot exceed 10 characters']
            },
            summary: {
                type: String,
                maxlength: [2000, 'Critique summary cannot exceed 2000 characters']
            },
            formattingIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            dialogueIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            pacingIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            suggestions: [{
                type: String,
                maxlength: [500, 'Each suggestion cannot exceed 500 characters']
            }]
        },
        savedAt: { type: Date }
    },

    charactersInvolved: [{
        type: Schema.Types.ObjectId,
        ref: 'Character'
    }],
    mentionedItems: [{
        type: String,
        maxlength: [200, 'Each mentioned item cannot exceed 200 characters']
    }],
    previousSceneSummary: {
        type: String,
        maxlength: [2000, 'Previous scene summary cannot exceed 2000 characters']
    }
}, { timestamps: true });

// Index for fast retrieval of the script in order
SceneSchema.index({ bibleId: 1, sequenceNumber: 1 });

export const Scene = mongoose.model<IScene>('Scene', SceneSchema);
