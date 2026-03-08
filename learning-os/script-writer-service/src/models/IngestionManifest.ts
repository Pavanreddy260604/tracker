import mongoose, { Schema, Document } from 'mongoose';

export interface IIngestionManifest extends Document {
    jobType: 'master_script' | 'bible';
    targetId: mongoose.Types.ObjectId;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial_success';
    scriptVersion?: string;
    gateStatus?: 'pending' | 'passed' | 'failed';
    geAuditStatus?: 'passed' | 'failed' | 'skipped';
    totalChunks: number;
    successfulChunks: number;
    failedChunks: number;
    errorLogs: {
        chunkIndex?: number;
        speaker?: string;
        error: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const IngestionManifestSchema: Schema = new Schema({
    jobType: { type: String, enum: ['master_script', 'bible'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'partial_success'], default: 'pending' },
    scriptVersion: { type: String },
    gateStatus: { type: String, enum: ['pending', 'passed', 'failed'] },
    geAuditStatus: { type: String, enum: ['passed', 'failed', 'skipped'] },
    totalChunks: { type: Number, default: 0 },
    successfulChunks: { type: Number, default: 0 },
    failedChunks: { type: Number, default: 0 },
    errorLogs: [{
        chunkIndex: Number,
        speaker: String,
        error: String
    }]
}, {
    timestamps: true
});

// Indexes for fast lookup by target
IngestionManifestSchema.index({ targetId: 1, jobType: 1 });
IngestionManifestSchema.index({ status: 1 });
IngestionManifestSchema.index({ targetId: 1, scriptVersion: 1 });

export const IngestionManifest = mongoose.model<IIngestionManifest>('IngestionManifest', IngestionManifestSchema);
