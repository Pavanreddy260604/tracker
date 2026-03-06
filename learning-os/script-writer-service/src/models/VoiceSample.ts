import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceSample extends Document {
    bibleId: mongoose.Types.ObjectId;
    characterId?: mongoose.Types.ObjectId; // Optional: linked to specific character
    content: string; // The specific line of dialogue
    contentHash?: string; // Deduplication hash
    speaker?: string; // Optional detected speaker name
    era?: string; // New: Time period/age context
    language?: string; // PH Multilingual RAG
    tactic?: string; // Character tactic (PH 19)
    emotion?: string; // Emotional charge (PH 19)
    chunkType?: 'dialogue' | 'action' | 'narration';
    chunkIndex?: number;
    embedding: number[]; // The vector representation
    tags: string[]; // "Slang", "Angry", "South London"
    source: string; // "The Wire S01E05"
    masterScriptId?: mongoose.Types.ObjectId; // Optional: linked to a pro master script
    createdAt: Date;
}

const VoiceSampleSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible' }, // Bible is optional if it's a global master script
    masterScriptId: { type: Schema.Types.ObjectId, ref: 'MasterScript' }, // PH 21
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    content: { type: String, required: true },
    contentHash: { type: String },
    speaker: { type: String },
    era: { type: String }, // NEW: Time period or age range (e.g. "1990s", "childhood")
    language: { type: String }, // PH Multilingual RAG
    tactic: { type: String }, // PH 19
    emotion: { type: String }, // PH 19
    chunkType: { type: String, enum: ['dialogue', 'action', 'narration'] },
    chunkIndex: { type: Number },
    embedding: { type: [Number], required: true },
    tags: [{ type: String }],
    source: { type: String }
}, { timestamps: true });

// Simple index for retrieving by project
VoiceSampleSchema.index({ bibleId: 1 });
VoiceSampleSchema.index({ masterScriptId: 1 });
VoiceSampleSchema.index({ bibleId: 1, contentHash: 1 });

export const VoiceSample = mongoose.model<IVoiceSample>('VoiceSample', VoiceSampleSchema);
