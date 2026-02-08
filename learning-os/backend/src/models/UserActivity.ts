
import mongoose, { Schema, Document } from 'mongoose';

export interface IUserActivity extends Document {
    userId: mongoose.Types.ObjectId;
    type: 'navigation' | 'click' | 'edit' | 'create' | 'delete' | 'search' | 'command';
    description: string;
    metadata?: {
        path?: string;
        component?: string;
        targetId?: string;
        details?: any;
    };
    timestamp: Date;
}

const UserActivitySchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['navigation', 'click', 'edit', 'create', 'delete', 'search', 'command'],
        required: true
    },
    description: { type: String, required: true },
    metadata: {
        path: { type: String },
        component: { type: String },
        targetId: { type: String },
        details: { type: Schema.Types.Mixed }
    },
    timestamp: { type: Date, default: Date.now }
});

// Index for fast retrieval of latest activities
UserActivitySchema.index({ userId: 1, timestamp: -1 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
