import mongoose from 'mongoose';
import { DailyLog } from '../models/DailyLog.js';

/**
 * Streak Service
 * 
 * STREAK LOGIC:
 * - A day is "active" if: dsaHours + backendHours + projectHours >= 1
 * - Streak breaks on any gap in consecutive active days
 * - All dates are YYYY-MM-DD strings in user's local timezone
 */

interface StreakResult {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
    isActiveToday: boolean;
    streakAtRisk: boolean; // True if no activity today and streak > 0
}

/**
 * Calculate current and longest streak for a user
 */
export const calculateStreak = async (
    userId: string,
    today: string // YYYY-MM-DD in user's timezone
): Promise<StreakResult> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all active days (where total study hours >= 1), sorted descending
    const activeDays = await DailyLog.aggregate([
        { $match: { userId: userObjectId } },
        {
            $addFields: {
                totalHours: {
                    $add: ['$dsaHours', '$backendHours', '$projectHours'],
                },
            },
        },
        { $match: { totalHours: { $gte: 0.5 } } },
        { $sort: { date: -1 } },
        { $project: { date: 1, _id: 0 } },
    ]);

    if (activeDays.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            isActiveToday: false,
            streakAtRisk: false,
        };
    }

    const dates = activeDays.map((d) => d.date);
    const isActiveToday = dates[0] === today;
    const lastActiveDate = dates[0];

    // Calculate current streak (consecutive days from today or yesterday)
    let currentStreak = 0;
    let checkDate = today;

    for (const date of dates) {
        if (date === checkDate) {
            currentStreak++;
            // Move to previous day
            checkDate = getPreviousDay(checkDate);
        } else if (date === getPreviousDay(checkDate)) {
            // Gap found, but allow yesterday as start if not active today
            if (currentStreak === 0) {
                currentStreak = 1;
                checkDate = getPreviousDay(date);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Calculate longest streak (scan all dates)
    let longestStreak = 0;
    let tempStreak = 1;

    for (let i = 0; i < dates.length - 1; i++) {
        const current = dates[i];
        const next = dates[i + 1];

        if (getPreviousDay(current) === next) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Streak is at risk if: there's a current streak > 0, but no activity today
    const streakAtRisk = currentStreak > 0 && !isActiveToday;

    return {
        currentStreak,
        longestStreak,
        lastActiveDate,
        isActiveToday,
        streakAtRisk,
    };
};

/**
 * Get previous day in YYYY-MM-DD format
 */
function getPreviousDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().split('T')[0];
}

/**
 * Check if user has been inactive for N days
 */
export const checkInactivity = async (
    userId: string,
    today: string,
    daysThreshold: number = 3
): Promise<{ isInactive: boolean; daysSinceLastActivity: number }> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get the most recent active day
    const lastActive = await DailyLog.aggregate([
        { $match: { userId: userObjectId } },
        {
            $addFields: {
                totalHours: { $add: ['$dsaHours', '$backendHours', '$projectHours'] },
            },
        },
        { $match: { totalHours: { $gte: 0.5 } } },
        { $sort: { date: -1 } },
        { $limit: 1 },
        { $project: { date: 1 } },
    ]);

    if (lastActive.length === 0) {
        return { isInactive: true, daysSinceLastActivity: -1 };
    }

    const lastDate = new Date(lastActive[0].date + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const daysDiff = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        isInactive: daysDiff >= daysThreshold,
        daysSinceLastActivity: daysDiff,
    };
};
