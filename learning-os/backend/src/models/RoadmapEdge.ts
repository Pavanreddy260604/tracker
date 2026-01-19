import mongoose, { Document, Schema } from 'mongoose';

export interface IRoadmapEdge extends Document {
    userId: mongoose.Types.ObjectId;
    roadmapId: string;
    edgeId: string; // ReactFlow edge ID
    source: string;
    target: string;
}

const roadmapEdgeSchema = new Schema<IRoadmapEdge>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmapId: { type: String, default: 'default' },
    edgeId: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true }
}, { timestamps: true });

// Index for efficient queries
roadmapEdgeSchema.index({ userId: 1, roadmapId: 1 });

export const RoadmapEdge = mongoose.model<IRoadmapEdge>('RoadmapEdge', roadmapEdgeSchema);
