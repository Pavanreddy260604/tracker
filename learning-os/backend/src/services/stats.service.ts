import mongoose from 'mongoose';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { calculateStreak, checkInactivity } from './streak.service.js';
import { getSummary, getTopicDistribution } from './aggregation.service.js';
import { User } from '../models/User.js';

/**
 * Stats Service
 * 
 * High-level stats and insights endpoints
 */

export interface TodayProgress {
    log: {
        dsaHours: number;
        backendHours: number;
        projectHours: number;
        exerciseCompleted: boolean;
        sleepHours: number;
        dsaProblemsSolved: number;
        totalHours: number;
        isActive: boolean;
    } | null;
    streak: {
        current: number;
        longest: number;
        atRisk: boolean;
    };
    targets: {
        dsa: { current: number; target: number; percent: number };
        backend: { current: number; target: number; percent: number };
        project: { current: number; target: number; percent: number };
    };
}

/**
 * Get today's progress with streak info
 */
export const getTodayProgress = async (
    userId: string,
    today: string
): Promise<TodayProgress> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get today's log
    const log = await DailyLog.findOne({
        userId: userObjectId,
        date: today,
    }).lean();

    // Get streak info
    const streak = await calculateStreak(userId, today);

    // Get User Targets
    const user = await User.findById(userId).lean();
    const targets = user?.targets || { dsa: 6, backend: 4, project: 1 };

    const DSA_TARGET = targets.dsa;
    const BACKEND_TARGET = targets.backend;
    const PROJECT_TARGET = targets.project;

    const dsaHours = log?.dsaHours || 0;
    const backendHours = log?.backendHours || 0;
    const projectHours = log?.projectHours || 0;

    return {
        log: log
            ? {
                dsaHours,
                backendHours,
                projectHours,
                exerciseCompleted: log.exerciseCompleted,
                sleepHours: log.sleepHours,
                dsaProblemsSolved: log.dsaProblemsSolved,
                totalHours: dsaHours + backendHours + projectHours,
                isActive: dsaHours + backendHours + projectHours >= 1,
            }
            : null,
        streak: {
            current: streak.currentStreak,
            longest: streak.longestStreak,
            atRisk: streak.streakAtRisk,
        },
        targets: {
            dsa: {
                current: dsaHours,
                target: DSA_TARGET,
                percent: Math.min(Math.round((dsaHours / DSA_TARGET) * 100), 100),
            },
            backend: {
                current: backendHours,
                target: BACKEND_TARGET,
                percent: Math.min(Math.round((backendHours / BACKEND_TARGET) * 100), 100),
            },
            project: {
                current: projectHours,
                target: PROJECT_TARGET,
                percent: Math.min(Math.round((projectHours / PROJECT_TARGET) * 100), 100),
            },
        },
    };
};

export interface Insights {
    strongestTopic: string | null;
    weakestTopic: string | null;
    avgDailyHours: number;
    consistencyPercent: number;
    totalProblems: number;
    totalHours: number;
    inactivityWarning: boolean;
    daysSinceLastActivity: number;
}

/**
 * Get premium insights
 */
export const getInsights = async (
    userId: string,
    today: string
): Promise<Insights> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all-time summary
    const allTimeSummary = await getSummary(userId, '2020-01-01', today);

    // Get topic distribution
    const topicDist = await getTopicDistribution(userId);

    // Get total problems count
    const totalProblems = await DSAProblem.countDocuments({ userId: userObjectId });

    // Calculate consistency (active days / total days since first log)
    const firstLog = await DailyLog.findOne({ userId: userObjectId })
        .sort({ date: 1 })
        .lean();

    let consistencyPercent = 0;
    let avgDailyHours = 0;

    if (firstLog) {
        const firstDate = new Date(firstLog.date + 'T00:00:00Z');
        const todayDate = new Date(today + 'T00:00:00Z');
        const totalDays = Math.max(
            1,
            Math.floor((todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        );

        consistencyPercent = Math.round((allTimeSummary.activeDays / totalDays) * 100);
        avgDailyHours =
            allTimeSummary.activeDays > 0
                ? Math.round((allTimeSummary.totalHours / allTimeSummary.activeDays) * 10) / 10
                : 0;
    }

    // Check inactivity
    const inactivity = await checkInactivity(userId, today, 3);

    return {
        strongestTopic: topicDist.strongestTopic,
        weakestTopic: topicDist.weakestTopic,
        avgDailyHours,
        consistencyPercent,
        totalProblems,
        totalHours: allTimeSummary.totalHours,
        inactivityWarning: inactivity.isInactive,
        daysSinceLastActivity: inactivity.daysSinceLastActivity,
    };
};
