import mongoose, { Schema, Document } from 'mongoose';

export interface IUserMetric extends Document {
  userId: string;
  type: 'weight' | 'bodyfat';
  value: number;
  unit: string;
  timestamp: Date;
}

const UserMetricSchema = new Schema<IUserMetric>({
  userId: { type: String, required: true },
  type: { type: String, enum: ['weight', 'bodyfat'], required: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

UserMetricSchema.index({ userId: 1, type: 1, timestamp: -1 });

export const UserMetric = mongoose.model<IUserMetric>('UserMetric', UserMetricSchema);
