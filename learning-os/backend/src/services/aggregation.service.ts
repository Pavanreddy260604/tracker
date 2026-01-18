import mongoose from 'mongoose';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem, DIFFICULTY_WEIGHTS } from '../models/DSAProblem.js';
import { BackendTopic } from '../models/BackendTopic.js';

/**
 * Aggregation Service
 * 
 * Provides MongoDB aggregation pipelines for:
 * - Weekly sums
 * - Monthly intensity (heatmap)
 * - Topic distribution
 * - Total stats
 */

interface DailyIntensity {
    date: string;
    intensity: number; // 0–1 normalized value
    totalHours: number;
}

interface WeeklyData {
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    totalHours: number;
}

/**
 * Get weekly data for bar chart (last 7 days)
 */
export const getWeeklyData = async (
    userId: string,
    endDate: string // YYYY-MM-DD
): Promise<WeeklyData[]> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Calculate start date (7 days ago)
    const end = new Date(endDate + 'T00:00:00Z');
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    const startDate = start.toISOString().split('T')[0];

    const logs = await DailyLog.aggregate([
        {
            $match: {
                userId: userObjectId,
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $project: {
                date: 1,
                dsaHours: 1,
                backendHours: 1,
                projectHours: 1,
                totalHours: { $add: ['$dsaHours', '$backendHours', '$projectHours'] },
            },
        },
        { $sort: { date: 1 } },
    ]);

    // Fill in missing days with zeros
    const result: WeeklyData[] = [];
    const current = new Date(start);

    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const log = logs.find((l) => l.date === dateStr);

        result.push({
            date: dateStr,
            dsaHours: log?.dsaHours || 0,
            backendHours: log?.backendHours || 0,
            projectHours: log?.projectHours || 0,
            totalHours: log?.totalHours || 0,
        });

        current.setUTCDate(current.getUTCDate() + 1);
    }

    return result;
};

/**
 * Get yearly heatmap data (raw daily intensity)
 */
export const getYearlyHeatmap = async (
    userId: string,
    year: number
): Promise<DailyIntensity[]> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Max hours for normalization (13 = 6 DSA + 4 Backend + 3 Project)
    const MAX_HOURS = 13;

    const logs = await DailyLog.aggregate([
        {
            $match: {
                userId: userObjectId,
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $project: {
                date: 1,
                totalHours: { $add: ['$dsaHours', '$backendHours', '$projectHours'] },
            },
        },
        {
            $addFields: {
                intensity: {
                    $min: [{ $divide: ['$totalHours', MAX_HOURS] }, 1],
                },
            },
        },
        { $sort: { date: 1 } },
    ]);

    return logs.map((log) => ({
        date: log.date,
        intensity: Math.round(log.intensity * 100) / 100,
        totalHours: log.totalHours,
    }));
};

/**
 * Get summary for a date range
 */
export const getSummary = async (
    userId: string,
    startDate: string,
    endDate: string
): Promise<{
    totalDsaHours: number;
    totalBackendHours: number;
    totalProjectHours: number;
    totalHours: number;
    activeDays: number;
    exerciseDays: number;
    avgSleepHours: number;
    totalProblemsSolved: number;
    dsaDueCount: number;
    backendDueCount: number;
}> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const today = new Date().toISOString().split('T')[0];

    const [dailyLogs, dsaDueCount, backendDueCount] = await Promise.all([
        DailyLog.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: null,
                    totalDsaHours: { $sum: '$dsaHours' },
                    totalBackendHours: { $sum: '$backendHours' },
                    totalProjectHours: { $sum: '$projectHours' },
                    exerciseDays: {
                        $sum: { $cond: ['$exerciseCompleted', 1, 0] },
                    },
                    totalSleepHours: { $sum: '$sleepHours' },
                    totalProblemsSolved: { $sum: '$dsaProblemsSolved' },
                    activeDays: {
                        $sum: {
                            $cond: [
                                { $gte: [{ $add: ['$dsaHours', '$backendHours', '$projectHours'] }, 1] },
                                1,
                                0,
                            ],
                        },
                    },
                    logCount: { $sum: 1 },
                },
            },
        ]),
        DSAProblem.countDocuments({
            userId: userObjectId,
            nextReviewDate: { $lte: today }
        }),
        BackendTopic.countDocuments({
            userId: userObjectId,
            nextReviewDate: { $lte: today }
        })
    ]);

    if (dailyLogs.length === 0) {
        return {
            totalDsaHours: 0,
            totalBackendHours: 0,
            totalProjectHours: 0,
            totalHours: 0,
            activeDays: 0,
            exerciseDays: 0,
            avgSleepHours: 0,
            totalProblemsSolved: 0,
            dsaDueCount,
            backendDueCount,
        };
    }

    const data = dailyLogs[0];
    return {
        totalDsaHours: data.totalDsaHours,
        totalBackendHours: data.totalBackendHours,
        totalProjectHours: data.totalProjectHours,
        totalHours: data.totalDsaHours + data.totalBackendHours + data.totalProjectHours,
        activeDays: data.activeDays,
        exerciseDays: data.exerciseDays,
        avgSleepHours:
            data.logCount > 0
                ? Math.round((data.totalSleepHours / data.logCount) * 10) / 10
                : 0,
        totalProblemsSolved: data.totalProblemsSolved,
        dsaDueCount,
        backendDueCount,
    };
};

/**
 * Get topic distribution with weighted scores
 */
export const getTopicDistribution = async (
    userId: string
): Promise<{
    topics: { topic: string; count: number; score: number }[];
    strongestTopic: string | null;
    weakestTopic: string | null;
}> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const topics = await DSAProblem.aggregate([
        { $match: { userId: userObjectId } },
        {
            $group: {
                _id: '$topic',
                count: { $sum: 1 },
                easyCount: {
                    $sum: { $cond: [{ $eq: ['$difficulty', 'easy'] }, 1, 0] },
                },
                mediumCount: {
                    $sum: { $cond: [{ $eq: ['$difficulty', 'medium'] }, 1, 0] },
                },
                hardCount: {
                    $sum: { $cond: [{ $eq: ['$difficulty', 'hard'] }, 1, 0] },
                },
            },
        },
        {
            $addFields: {
                score: {
                    $add: [
                        { $multiply: ['$easyCount', DIFFICULTY_WEIGHTS.easy] },
                        { $multiply: ['$mediumCount', DIFFICULTY_WEIGHTS.medium] },
                        { $multiply: ['$hardCount', DIFFICULTY_WEIGHTS.hard] },
                    ],
                },
            },
        },
        { $sort: { score: -1 } },
    ]);

    const result = topics.map((t) => ({
        topic: t._id,
        count: t.count,
        score: t.score,
    }));

    return {
        topics: result,
        strongestTopic: result.length > 0 ? result[0].topic : null,
        weakestTopic: result.length > 0 ? result[result.length - 1].topic : null,
    };
};

/**
 * Get backend category distribution
 */
export const getBackendCategoryDistribution = async (
    userId: string
): Promise<{ category: string; count: number }[]> => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const categories = await BackendTopic.aggregate([
        { $match: { userId: userObjectId } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);

    return categories.map((c) => ({
        category: c._id,
        count: c.count,
    }));
};
