import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceSample extends Document {
    bibleId: mongoose.Types.ObjectId;
    characterId?: mongoose.Types.ObjectId; // Optional: linked to specific character
    content: string; // The specific line of dialogue
    embedding: number[]; // The vector representation
    tags: string[]; // "Slang", "Angry", "South London"
    source: string; // "The Wire S01E05"
    createdAt: Date;
}

const VoiceSampleSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    tags: [{ type: String }],
    source: { type: String }
}, { timestamps: true });

// Simple index for retrieving by project
VoiceSampleSchema.index({ bibleId: 1 });

export const VoiceSample = mongoose.model<IVoiceSample>('VoiceSample', VoiceSampleSchema);
