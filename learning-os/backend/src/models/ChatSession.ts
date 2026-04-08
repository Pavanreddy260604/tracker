import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    attachmentIds: {
        type: [String],
        default: []
    }
});

const chatSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    messages: [messageSchema],
    // Metadata for potential future features (e.g., usage stats, context window)
    metadata: {
        model: { type: String, default: 'mistral' },
        tokensUsed: { type: Number, default: 0 },
        assistantType: {
            type: String,
            enum: ['learning-os', 'script-writer'],
            default: 'learning-os'
        }
    }
}, {
    timestamps: true
});

// Index for fetching user's history quickly, sorted by most recent
chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
