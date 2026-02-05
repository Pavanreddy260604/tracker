import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
    bibleId: mongoose.Types.ObjectId;
    name: string;
    age: number;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    voice: {
        description: string; // "Gruff, uses simple words"
        sampleLines: string[]; // "I ain't doing that.", "Get lost."
        accent?: string;
    };
    traits: string[]; // "Limp", "Chain smoker"
    motivation: string;
    createdAt: Date;
    updatedAt: Date;
}

const CharacterSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible', required: true },
    name: { type: String, required: true },
    age: { type: Number },
    role: {
        type: String,
        enum: ['protagonist', 'antagonist', 'supporting', 'minor'],
        default: 'supporting'
    },
    voice: {
        description: { type: String },
        sampleLines: [{ type: String }],
        accent: { type: String }
    },
    traits: [{ type: String }],
    motivation: { type: String }
}, { timestamps: true });

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
