import mongoose, { Schema, Document } from 'mongoose';

export interface IExercise extends Document {
  name: string;
  movementPattern: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  difficulty: string;
  instructions: {
    setup: string[];
    execution: string[];
    breathing: string[];
  };
  commonMistakes: string[];
  safetyWarnings: string[];
  alternatives: {
    exerciseId: string;
    similarityScore: number;
    loadConversionFactor: number;
  }[];
  media: {
    videoUrl?: string;
    animationUrl?: string;
    thumbnailUrl?: string;
  };
  isActive: boolean;
}

const ExerciseSchema = new Schema<IExercise>({
  name: { type: String, required: true },
  movementPattern: { type: String, enum: ['push', 'pull', 'squat', 'hinge', 'lunge', 'carry'] },
  primaryMuscles: [String],
  secondaryMuscles: [String],
  equipment: [String],
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  instructions: {
    setup: [String],
    execution: [String],
    breathing: [String],
  },
  commonMistakes: [String],
  safetyWarnings: [String],
  alternatives: [{
    exerciseId: String,
    similarityScore: Number,
    loadConversionFactor: Number,
  }],
  media: {
    videoUrl: String,
    animationUrl: String,
    thumbnailUrl: String,
  },
  isActive: { type: Boolean, default: true },
});

ExerciseSchema.index({ name: 1 });
ExerciseSchema.index({ movementPattern: 1 });
ExerciseSchema.index({ equipment: 1 });
ExerciseSchema.index({ primaryMuscles: 1 });

export const Exercise = mongoose.model<IExercise>('Exercise', ExerciseSchema);
