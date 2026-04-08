import mongoose, { Document, Schema } from 'mongoose';

export interface IRoadmapNode extends Document {
    userId: mongoose.Types.ObjectId;
    roadmapId: string;
    nodeId: string;
    type: string;
    data: {
        label: string;
        status: 'todo' | 'in-progress' | 'done';
        description?: string;
        category?: 'general' | 'dsa' | 'backend' | 'database' | 'frontend' | 'devops' | 'system' | 'security' | 'api' | 'language' | 'tools' | 'terminal';
        priority?: 'low' | 'medium' | 'high';
        estimatedHours?: number;
        resourceUrl?: string;
    };
    position: {
        x: number;
        y: number;
    };
    topicId?: mongoose.Types.ObjectId;
}

const roadmapNodeSchema = new Schema<IRoadmapNode>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmapId: { type: String, default: 'default' },
    topicId: { type: Schema.Types.ObjectId, ref: 'BackendTopic' },
    nodeId: { type: String, required: true },
    type: { type: String, default: 'roadmap' },
    data: {
        label: { type: String, required: true },
        status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
        description: { type: String, default: '' },
        category: {
            type: String,
            enum: ['general', 'dsa', 'backend', 'database', 'frontend', 'devops', 'system', 'security', 'api', 'language', 'tools', 'terminal'],
            default: 'general'
        },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        estimatedHours: { type: Number, default: 0 },
        resourceUrl: { type: String, default: '' }
    },
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
    }
}, { timestamps: true });

// Index for efficient queries
roadmapNodeSchema.index({ userId: 1, roadmapId: 1 });

export const RoadmapNode = mongoose.model<IRoadmapNode>('RoadmapNode', roadmapNodeSchema);
