import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedbackLog extends Document {
  userId: string;
  timestamp: Date;
  inputType: string;
  inputData: any;
  analysisResult: any;
  decision: string;
  reasoning?: string;
  action: any;
  userResponse?: string;
  satisfaction?: number;
  memoryUpdate?: any;
}

const FeedbackLogSchema = new Schema<IFeedbackLog>({
  userId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  inputType: { type: String, required: true },
  inputData: Schema.Types.Mixed,
  analysisResult: Schema.Types.Mixed,
  decision: String,
  reasoning: String,
  action: Schema.Types.Mixed,
  userResponse: String,
  satisfaction: Number,
  memoryUpdate: Schema.Types.Mixed,
}, { timestamps: true });

FeedbackLogSchema.index({ userId: 1, timestamp: -1 });
FeedbackLogSchema.index({ inputType: 1 });

export const FeedbackLog = mongoose.model<IFeedbackLog>('FeedbackLog', FeedbackLogSchema);
