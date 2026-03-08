import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterScript extends Document {
    title: string;
    director: string;
    description?: string;
    language: string; // PH Multilingual RAG
    tags: string[]; // ["Sci-Fi", "Noir", "Tense"]
    rawContent: string;
    status: 'pending' | 'processing' | 'validating' | 'indexed' | 'failed';
    progress: number;
    processedChunks: number;
    activeScriptVersion?: string;
    processingScriptVersion?: string;
    parserVersion?: string;
    gateStatus?: 'pending' | 'passed' | 'failed';
    lastValidationSummary?: string;
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
        enum: ['pending', 'processing', 'validating', 'indexed', 'failed'],
        default: 'pending'
    },
    progress: { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    activeScriptVersion: { type: String },
    processingScriptVersion: { type: String },
    parserVersion: { type: String },
    gateStatus: { type: String, enum: ['pending', 'passed', 'failed'] },
    lastValidationSummary: { type: String }
}, { timestamps: true });

MasterScriptSchema.index({ director: 1, title: 1 });
MasterScriptSchema.index({ tags: 1 });
MasterScriptSchema.index({ activeScriptVersion: 1 });

export const MasterScript = mongoose.model<IMasterScript>('MasterScript', MasterScriptSchema);
