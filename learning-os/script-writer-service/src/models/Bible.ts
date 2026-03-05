import mongoose, { Schema, Document } from 'mongoose';

export interface IBible extends Document {
    userId: string; // String to support various auth provider IDs
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language: string;
    visualStyle: string; // "Noir", "Wes Anderson", "Handheld"
    rules: string[]; // "No voiceovers", "Only takes place at night"
    createdAt: Date;
    updatedAt: Date;
}

// Valid genre options
const VALID_GENRES = ['Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Action', 'Romance', 'Documentary', 'Fantasy', 'Mystery'];

const BibleSchema: Schema = new Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        index: true,
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        minlength: [1, 'Title cannot be empty']
    },
    logline: {
        type: String,
        default: '',
        maxlength: [1000, 'Logline cannot exceed 1000 characters']
    },
    genre: {
        type: String,
        enum: {
            values: VALID_GENRES,
            message: 'Invalid genre. Allowed: ' + VALID_GENRES.join(', ')
        },
        default: 'Drama'
    },
    tone: {
        type: String,
        maxlength: [100, 'Tone cannot exceed 100 characters']
    },
    language: {
        type: String,
        default: 'English',
        maxlength: [50, 'Language cannot exceed 50 characters']
    },
    visualStyle: {
        type: String,
        maxlength: [100, 'Visual style cannot exceed 100 characters']
    },
    rules: [{
        type: String,
        maxlength: [500, 'Each rule cannot exceed 500 characters']
    }],
}, { timestamps: true });

// Index for efficient queries
BibleSchema.index({ userId: 1, createdAt: -1 });

export const Bible = mongoose.model<IBible>('Bible', BibleSchema);
