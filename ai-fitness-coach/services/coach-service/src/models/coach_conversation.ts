import mongoose, { Schema, Document } from 'mongoose';

export interface ICoachConversation extends Document {
  userId: string;
  sessionId: string;
  messages: {
    role: string;
    content: string;
    timestamp: Date;
  }[];
  context: {
    referencedExercises: string[];
    referencedWorkouts: string[];
    referencedNutrition: string[];
  };
  createdAt: Date;
}

const CoachConversationSchema = new Schema<ICoachConversation>({
  userId: { type: String, required: true },
  sessionId: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: { type: Date, default: Date.now },
  }],
  context: {
    referencedExercises: [String],
    referencedWorkouts: [String],
    referencedNutrition: [String],
  },
}, { timestamps: true });

CoachConversationSchema.index({ userId: 1, createdAt: -1 });
CoachConversationSchema.index({ sessionId: 1 });

export const CoachConversation = mongoose.model<ICoachConversation>('CoachConversation', CoachConversationSchema);
