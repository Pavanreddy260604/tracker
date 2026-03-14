import mongoose, { Schema, Document } from 'mongoose';

export interface IChatAttachment extends Document {
    userId: mongoose.Types.ObjectId;
    sessionId: mongoose.Types.ObjectId;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: 'pending' | 'indexing' | 'completed' | 'failed';
    errorMessage?: string;
    vectorIds: string[]; // Store ChromaDB IDs for cleanup
    lastAccessed: Date;
    createdAt: Date;
    updatedAt: Date;
}

const chatAttachmentSchema = new Schema<IChatAttachment>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'indexing', 'completed', 'failed'], default: 'pending' },
    errorMessage: { type: String },
    vectorIds: { type: [String], default: [] },
    lastAccessed: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for cleanup logic: Find attachments for sessions with no recent activity
chatAttachmentSchema.index({ sessionId: 1, lastAccessed: -1 });
chatAttachmentSchema.index({ userId: 1 });

export const ChatAttachment = mongoose.model<IChatAttachment>('ChatAttachment', chatAttachmentSchema);
