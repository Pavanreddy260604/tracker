import { DSAProblem } from '../models/DSAProblem.js';

const DSA_TOPIC_ALIASES: Record<string, string[]> = {
    arrays: ['arrays', 'array', 'Arrays', 'Array'],
    strings: ['strings', 'string', 'Strings', 'String'],
    'linked-list': ['linked-list', 'linked list', 'Linked List', 'linkedlist'],
    stack: ['stack', 'Stack'],
    queue: ['queue', 'Queue'],
    trees: ['trees', 'tree', 'Trees', 'Tree'],
    graphs: ['graphs', 'graph', 'Graphs', 'Graph'],
    dp: ['dp', 'dynamic programming', 'Dynamic Programming'],
    greedy: ['greedy', 'Greedy'],
    backtracking: ['backtracking', 'Backtracking'],
    'binary-search': ['binary-search', 'binary search', 'Binary Search'],
    'two-pointers': ['two-pointers', 'two pointers', 'Two Pointers'],
    'sliding-window': ['sliding-window', 'sliding window', 'Sliding Window'],
    heap: ['heap', 'priority queue', 'Heap', 'Priority Queue'],
    trie: ['trie', 'Trie'],
    'bit-manipulation': ['bit-manipulation', 'bit manipulation', 'Bit Manipulation'],
    math: ['math', 'Math'],
    recursion: ['recursion', 'Recursion'],
    sorting: ['sorting', 'Sorting'],
    hashing: ['hashing', 'hash map', 'Hashing', 'Hash Map'],
    other: ['other', 'Other'],
};

const DSA_TOPIC_NORMALIZATION = Object.entries(DSA_TOPIC_ALIASES).reduce<Record<string, string>>((acc, [canonical, aliases]) => {
    for (const alias of aliases) {
        acc[alias.trim().toLowerCase()] = canonical;
    }
    return acc;
}, {});

export const normalizeDsaTopic = (topic?: string) => {
    const value = topic?.trim();
    if (!value) {
        return '';
    }

    return DSA_TOPIC_NORMALIZATION[value.toLowerCase()] ?? value.toLowerCase().replace(/\s+/g, '-');
};

export const getDsaTopicAliases = (topic?: string) => {
    const normalizedTopic = normalizeDsaTopic(topic);
    if (!normalizedTopic) {
        return [];
    }

    return DSA_TOPIC_ALIASES[normalizedTopic] ?? [normalizedTopic];
};

export const serializeDSAProblem = <T extends { topic?: string }>(problem: T) => ({
    ...problem,
    topic: normalizeDsaTopic(problem.topic),
});

export const normalizeDSAProblemPayload = (payload: Record<string, unknown>) => ({
    ...payload,
    topic: normalizeDsaTopic(typeof payload.topic === 'string' ? payload.topic : undefined),
});

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

    if (options.topic) {
        const topicAliases = getDsaTopicAliases(options.topic);
        filter.topic = topicAliases.length > 1 ? { $in: topicAliases } : topicAliases[0];
    }
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
        problems: problems.map((problem) => serializeDSAProblem(problem)),
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
    const problem = await DSAProblem.findOne({
        _id: problemId,
        userId,
    }).lean();

    return problem ? serializeDSAProblem(problem) : null;
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
