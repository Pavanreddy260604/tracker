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

const BibleSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true }, // Changed to String for cross-service compatibility
    title: { type: String, required: true },
    logline: { type: String, default: '' },
    genre: { type: String },
    tone: { type: String },
    language: { type: String, default: 'English' },
    visualStyle: { type: String },
    rules: [{ type: String }],
}, { timestamps: true });

export const Bible = mongoose.model<IBible>('Bible', BibleSchema);
