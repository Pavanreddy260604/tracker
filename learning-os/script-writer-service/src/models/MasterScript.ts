import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterScript extends Document {
    title: string;
    director: string;
    description?: string;
    language: string; // PH Multilingual RAG
    tags: string[]; // ["Sci-Fi", "Noir", "Tense"]
    rawContent: string;
    status: 'pending' | 'processing' | 'indexed' | 'failed';
    processedChunks: number;
    createdAt: Date;
}

const MasterScriptSchema: Schema = new Schema({
    title: { type: String, required: true, trim: true },
    director: { type: String, required: true, trim: true },
    description: { type: String },
    language: { type: String, required: true, default: 'English' },
    tags: [{ type: String }],
    rawContent: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'indexed', 'failed'],
        default: 'pending'
    },
    processedChunks: { type: Number, default: 0 }
}, { timestamps: true });

MasterScriptSchema.index({ director: 1, title: 1 });
MasterScriptSchema.index({ tags: 1 });

export const MasterScript = mongoose.model<IMasterScript>('MasterScript', MasterScriptSchema);
