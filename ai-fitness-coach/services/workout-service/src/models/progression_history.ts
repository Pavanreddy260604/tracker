import mongoose, { Schema, Document } from 'mongoose';

export interface IProgressionHistory extends Document {
  userId: string;
  exerciseId: string;
  date: Date;
  weight: number;
  sets: number;
  reps: number;
  totalVolume: number;
  progressionApplied: boolean;
  progressionAmount: number;
  plateauDetected: boolean;
}

const ProgressionHistorySchema = new Schema<IProgressionHistory>({
  userId: { type: String, required: true },
  exerciseId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  weight: Number,
  sets: Number,
  reps: Number,
  totalVolume: Number,
  progressionApplied: { type: Boolean, default: false },
  progressionAmount: Number,
  plateauDetected: { type: Boolean, default: false },
}, { timestamps: true });

ProgressionHistorySchema.index({ userId: 1, exerciseId: 1, date: -1 });
ProgressionHistorySchema.index({ userId: 1, date: -1 });

export const ProgressionHistory = mongoose.model<IProgressionHistory>('ProgressionHistory', ProgressionHistorySchema);
