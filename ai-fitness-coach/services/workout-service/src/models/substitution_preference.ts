import mongoose, { Schema, Document } from 'mongoose';

export interface ISubstitutionPreference extends Document {
  userId: string;
  originalExerciseId: string;
  preferredSubstituteId: string;
  count: number;
}

const SubstitutionPreferenceSchema = new Schema<ISubstitutionPreference>({
  userId: { type: String, required: true },
  originalExerciseId: { type: String, required: true },
  preferredSubstituteId: { type: String, required: true },
  count: { type: Number, default: 1 },
}, { timestamps: true });

SubstitutionPreferenceSchema.index({ userId: 1, originalExerciseId: 1, preferredSubstituteId: 1 }, { unique: true });

export const SubstitutionPreference = mongoose.model<ISubstitutionPreference>('SubstitutionPreference', SubstitutionPreferenceSchema);
