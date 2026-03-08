import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterScriptSourceLine extends Document {
    masterScriptId: mongoose.Types.ObjectId;
    scriptVersion: string;
    lineNo: number;
    rawText: string;
    lineHash: string;
    lineId: string;
    createdAt: Date;
    updatedAt: Date;
}

const MasterScriptSourceLineSchema: Schema = new Schema({
    masterScriptId: { type: Schema.Types.ObjectId, ref: 'MasterScript', required: true },
    scriptVersion: { type: String, required: true },
    lineNo: { type: Number, required: true },
    // Blank lines are valid source lines and must be preserved for exact reconstruction.
    rawText: { type: String, default: '' },
    lineHash: { type: String, required: true },
    lineId: { type: String, required: true }
}, { timestamps: true });

MasterScriptSourceLineSchema.index({ masterScriptId: 1, scriptVersion: 1, lineNo: 1 }, { unique: true });
MasterScriptSourceLineSchema.index({ masterScriptId: 1, scriptVersion: 1, lineId: 1 }, { unique: true });

export const MasterScriptSourceLine = mongoose.model<IMasterScriptSourceLine>(
    'MasterScriptSourceLine',
    MasterScriptSourceLineSchema
);
