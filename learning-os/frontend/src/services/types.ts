// Shared types for API services
// Extracted from the monolithic api.ts

export interface User {
    _id: string;
    name: string;
    email: string;
    timezone: string;
    targets?: {
        dsa: number;
        backend: number;
        project: number;
    };
    createdAt: string;
}

export interface DailyLog {
    _id: string;
    userId: string;
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    exerciseCompleted: boolean;
    sleepHours: number;
    dsaProblemsSolved: number;
    notes: string;
    isActive?: boolean;
    totalHours?: number;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
    isActiveToday: boolean;
    streakAtRisk: boolean;
}

export interface WeeklyData {
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    totalHours: number;
}

export interface HeatmapDay {
    date: string;
    intensity: number;
    totalHours: number;
}

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

export interface DashboardSummary {
    range: string;
    startDate: string;
    endDate: string;
    summary: {
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
    };
    today?: TodayProgress;
}

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

export interface DSAProblem {
    _id: string;
    userId: string;
    problemName: string;
    platform: string;
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    timeSpent: number;
    status: 'solved' | 'revisit' | 'attempted';
    patternLearned: string;
    mistakes: string;
    solutionLink: string;
    date: string;
    // DSA 2.0
    solutionCode?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    companyTags?: string[];
    nextReviewDate?: string;
    reviewStage?: number;
}

export interface BackendTopic {
    _id: string;
    userId: string;
    topicName: string;
    category: string;
    type: string;
    status: string;
    filesModified: string;
    bugsFaced: string;
    notes: string;
    date: string;
    // Backend Topics 2.0
    subTopics?: {
        id: string;
        text: string;
        isCompleted: boolean;
    }[];
    resources?: {
        title: string;
        url: string;
        type: 'video' | 'article' | 'docs' | 'course';
    }[];
    // SRS
    nextReviewDate?: string;
    reviewStage?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    timeSpent?: string;
}

export interface ProjectStudy {
    _id: string;
    projectName: string;
    repoUrl: string;
    moduleStudied: string;
    flowUnderstanding: string;
    involvedTables: string;
    questions: string;
    notes: string;
    date: string;
    // Project Studies 2.0
    architectureDiagram?: string;
    keyTakeaways?: string[];
    tasks?: {
        id: string;
        text: string;
        status: 'todo' | 'in-progress' | 'done';
    }[];
}

export interface InterviewSession {
    _id: string;
    config: {
        duration: number;
        questionCount: number;
        difficulty: 'easy' | 'medium' | 'hard';
        language?: string;
    };
    questions: {
        problemName: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        description: string;
        status: 'pending' | 'solved' | 'failed';
        userCode?: string;
        feedback?: string;
        score?: number;
        testCases?: { input: string; expectedOutput: string }[];
    }[];
    status: 'in-progress' | 'completed' | 'aborted';
    totalScore: number;
    startedAt: string;
    endedAt?: string;
}

export interface InterviewTestResult {
    index?: number;
    input?: string;
    expected?: string;
    actual?: string;
    passed?: boolean;
    error?: string;
    isHidden?: boolean;
    isCustom?: boolean;
}

export interface InterviewRunResult {
    status: 'success' | 'fail' | 'error';
    summary: { passed: number; total: number };
    testResults: InterviewTestResult[];
}

export interface InterviewSubmitResult {
    status: 'pass' | 'fail';
    feedback: string;
    score: number;
    summary?: { passed: number; total: number };
    testResults?: InterviewTestResult[];
}

export interface ChatSession {
    _id: string;
    userId: string;
    title: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }[];
    createdAt: string;
    updatedAt: string;
}
