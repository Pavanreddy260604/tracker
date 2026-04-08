import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkoutSession extends Document {
  userId: string;
  planId: string;
  dayIndex: number;
  startTime: Date;
  endTime?: Date;
  status: string;
  exercises: {
    exerciseId: string;
    plannedSets: number;
    sets: {
      setNumber: number;
      weight: number;
      reps: number;
      completedAt: Date;
      difficultyRating?: number;
    }[];
    skipped: boolean;
    skipReason?: string;
  }[];
  totalVolume: number;
  feedback: {
    rating?: number;
    notes?: string;
  };
}

const WorkoutSessionSchema = new Schema<IWorkoutSession>({
  userId: { type: String, required: true },
  planId: { type: String, required: true },
  dayIndex: Number,
  startTime: { type: Date, required: true },
  endTime: Date,
  status: { type: String, enum: ['active', 'completed', 'abandoned'] },
  exercises: [{
    exerciseId: String,
    plannedSets: Number,
    sets: [{
      setNumber: Number,
      weight: Number,
      reps: Number,
      completedAt: { type: Date, default: Date.now },
      difficultyRating: Number,
    }],
    skipped: { type: Boolean, default: false },
    skipReason: String,
  }],
  totalVolume: Number,
  feedback: {
    rating: Number,
    notes: String,
  },
}, { timestamps: true });

WorkoutSessionSchema.index({ userId: 1, startTime: -1 });
WorkoutSessionSchema.index({ userId: 1, status: 1 });
WorkoutSessionSchema.index({ planId: 1 });

export const WorkoutSession = mongoose.model<IWorkoutSession>('WorkoutSession', WorkoutSessionSchema);
