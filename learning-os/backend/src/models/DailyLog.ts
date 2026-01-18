import mongoose, { Document, Schema } from 'mongoose';

/**
 * Daily Log Schema
 * 
 * STREAK LOGIC:
 * A day is "active" if: dsaHours + backendHours + projectHours >= 1
 * This is computed via aggregation, not stored.
 * 
 * DATE HANDLING:
 * - Dates stored as YYYY-MM-DD strings (user's local date)
 * - Timezone-aware streak calculation happens in service layer
 * 
 * UPSERT BEHAVIOR:
 * - Compound unique index on (userId, date) prevents duplicates
 * - POST endpoint uses upsert to update existing or create new
 */

export interface IDailyLog extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    date: string; // YYYY-MM-DD format (user's local date)
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    exerciseCompleted: boolean;
    sleepHours: number;
    dsaProblemsSolved: number;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}

// Virtual field to check if day is "active" for streak
export interface IDailyLogMethods {
    isActiveDay(): boolean;
    totalStudyHours(): number;
}

const dailyLogSchema = new Schema<IDailyLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        date: {
            type: String,
            required: [true, 'Date is required'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
        },
        dsaHours: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Hours cannot be negative'],
            max: [24, 'Hours cannot exceed 24'],
        },
        backendHours: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Hours cannot be negative'],
            max: [24, 'Hours cannot exceed 24'],
        },
        projectHours: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Hours cannot be negative'],
            max: [24, 'Hours cannot exceed 24'],
        },
        exerciseCompleted: {
            type: Boolean,
            default: false,
        },
        sleepHours: {
            type: Number,
            default: 0,
            min: [0, 'Hours cannot be negative'],
            max: [24, 'Hours cannot exceed 24'],
        },
        dsaProblemsSolved: {
            type: Number,
            default: 0,
            min: [0, 'Count cannot be negative'],
        },
        notes: {
            type: String,
            default: '',
            maxlength: [5000, 'Notes cannot exceed 5000 characters'],
        },
    },
    {
        timestamps: true,
    }
);

// ⚡ CRITICAL INDEXES for performance
// Compound unique index: prevents duplicate logs for same user+date
dailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Sorted index for queries: recent logs first
dailyLogSchema.index({ userId: 1, date: -1 });

// Virtual: Check if this is an "active" day for streak calculation
dailyLogSchema.virtual('isActive').get(function () {
    return (this.dsaHours + this.backendHours + this.projectHours) >= 1;
});

// Virtual: Total study hours
dailyLogSchema.virtual('totalHours').get(function () {
    return this.dsaHours + this.backendHours + this.projectHours;
});

// Include virtuals in JSON output
dailyLogSchema.set('toJSON', { virtuals: true });
dailyLogSchema.set('toObject', { virtuals: true });

export const DailyLog = mongoose.model<IDailyLog>('DailyLog', dailyLogSchema);
