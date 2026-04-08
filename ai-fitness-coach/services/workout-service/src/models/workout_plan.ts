import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkoutPlan extends Document {
  userId: string;
  name: string;
  goal: string;
  days: {
    dayOfWeek: number;
    name: string;
    exercises: {
      exerciseId: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
      notes?: string;
      order: number;
    }[];
    estimatedDuration: number;
  }[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkoutPlanSchema = new Schema<IWorkoutPlan>({
  userId: { type: String, required: true },
  name: String,
  goal: { type: String, enum: ['muscle_gain', 'fat_loss', 'strength'] },
  days: [{
    dayOfWeek: { type: Number, min: 0, max: 6 },
    name: String,
    exercises: [{
      exerciseId: String,
      sets: Number,
      repsMin: Number,
      repsMax: Number,
      restSeconds: Number,
      notes: String,
      order: Number,
    }],
    estimatedDuration: Number,
  }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

WorkoutPlanSchema.index({ userId: 1, active: 1 });
WorkoutPlanSchema.index({ userId: 1, createdAt: -1 });

export const WorkoutPlan = mongoose.model<IWorkoutPlan>('WorkoutPlan', WorkoutPlanSchema);
