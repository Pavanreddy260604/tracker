import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceSample extends Document {
    bibleId: mongoose.Types.ObjectId;
    characterId?: mongoose.Types.ObjectId; // Optional: linked to specific character
    content: string; // The specific line of dialogue
    contentHash?: string; // Deduplication hash
    speaker?: string; // Optional detected speaker name
    chunkType?: 'dialogue' | 'action' | 'narration';
    chunkIndex?: number;
    embedding: number[]; // The vector representation
    tags: string[]; // "Slang", "Angry", "South London"
    source: string; // "The Wire S01E05"
    createdAt: Date;
}

const VoiceSampleSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    content: { type: String, required: true },
    contentHash: { type: String },
    speaker: { type: String },
    chunkType: { type: String, enum: ['dialogue', 'action', 'narration'] },
    chunkIndex: { type: Number },
    embedding: { type: [Number], required: true },
    tags: [{ type: String }],
    source: { type: String }
}, { timestamps: true });

// Simple index for retrieving by project
VoiceSampleSchema.index({ bibleId: 1 });
VoiceSampleSchema.index({ bibleId: 1, contentHash: 1 });

export const VoiceSample = mongoose.model<IVoiceSample>('VoiceSample', VoiceSampleSchema);
