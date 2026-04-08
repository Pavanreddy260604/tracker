import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  profile: {
    height: number;
    weight: number;
    age: number;
    gender: string;
    fitnessGoal: string;
    experienceLevel: string;
    gymType: string;
    availableEquipment: string[];
    trainingDaysPerWeek: number;
  };
  derivedMetrics: {
    bmi: number;
    tdee: number;
    dailyCalorieTarget: number;
    dailyProteinTarget: number;
    lastCalculated: Date;
  };
  streak: {
    current: number;
    longest: number;
    lastActivityDate: Date;
    freezeUsed: boolean;
    freezeMonth: number;
  };
  preferences: {
    darkMode: boolean;
    hapticFeedback: boolean;
    reminderTime?: string;
    units: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  profile: {
    height: Number,
    weight: Number,
    age: Number,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    fitnessGoal: { type: String, enum: ['muscle_gain', 'fat_loss', 'strength'] },
    experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    gymType: { type: String, enum: ['home', 'commercial', 'outdoor'] },
    availableEquipment: [String],
    trainingDaysPerWeek: Number,
  },
  derivedMetrics: {
    bmi: Number,
    tdee: Number,
    dailyCalorieTarget: Number,
    dailyProteinTarget: Number,
    lastCalculated: { type: Date, default: Date.now },
  },
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActivityDate: Date,
    freezeUsed: { type: Boolean, default: false },
    freezeMonth: Number,
  },
  preferences: {
    darkMode: { type: Boolean, default: true },
    hapticFeedback: { type: Boolean, default: true },
    reminderTime: String,
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  },
}, { timestamps: true });

UserSchema.index({ "streak.lastActivityDate": 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
