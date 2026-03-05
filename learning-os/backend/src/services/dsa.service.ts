import { DSAProblem } from '../models/DSAProblem.js';

export interface DSAListOptions {
    page: number;
    limit: number;
    topic?: string;
    difficulty?: string;
}

export interface DSAListResult {
    problems: unknown[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export const listDSAProblems = async (
    userId: string,
    options: DSAListOptions
): Promise<DSAListResult> => {
    const filter: Record<string, unknown> = { userId };

    if (options.topic) filter.topic = options.topic;
    if (options.difficulty) filter.difficulty = options.difficulty;

    const [problems, total] = await Promise.all([
        DSAProblem.find(filter)
            .sort({ date: -1, createdAt: -1 })
            .skip((options.page - 1) * options.limit)
            .limit(options.limit)
            .lean(),
        DSAProblem.countDocuments(filter),
    ]);

    return {
        problems,
        pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit),
        },
    };
};

export const createDSAProblem = async (userId: string, payload: Record<string, unknown>) => {
    return DSAProblem.create({
        ...payload,
        userId,
    });
};

export const getDSAProblemById = async (userId: string, problemId: string) => {
    return DSAProblem.findOne({
        _id: problemId,
        userId,
    }).lean();
};

export const updateDSAProblemById = async (
    userId: string,
    problemId: string,
    payload: Record<string, unknown>
) => {
    return DSAProblem.findOneAndUpdate(
        { _id: problemId, userId },
        { $set: payload },
        { new: true, runValidators: true }
    );
};

export const deleteDSAProblemById = async (userId: string, problemId: string) => {
    return DSAProblem.findOneAndDelete({
        _id: problemId,
        userId,
    });
};
