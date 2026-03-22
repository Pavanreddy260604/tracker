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
    scriptInterests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
    emailVerified?: boolean;
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
    platform: 'leetcode' | 'gfg' | 'codeforces' | 'codechef' | 'hackerrank' | 'neetcode' | 'other';
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    timeSpent: number;
    status: 'solved' | 'revisit' | 'attempted';
    patternLearned: string;
    mistakes: string;
    solutionLink: string;
    notes?: string;
    date: string;
    // DSA 2.0
    solutionCode?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    companyTags?: string[];
    nextReviewDate?: string;
    reviewStage?: number;
    confidenceLevel?: number;
    simpleExplanation?: string;
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
    auditScore?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    timeSpent?: string;
    confidenceLevel?: number;
    simpleExplanation?: string;
}

export interface ProjectStudy {
    _id: string;
    projectName: string;
    repoUrl: string;
    moduleStudied: string;
    flowUnderstood: boolean;
    flowUnderstanding: string;
    coreComponents: string;
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
    nextReviewDate?: string;
    reviewStage?: number;
    confidenceLevel?: number;
    simpleExplanation?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InterviewQuestion {
    questionId?: string;
    problemName: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    description: string;
    type: 'coding' | 'sql' | 'behavioral' | 'system-design';
    status: 'pending' | 'solved' | 'failed' | 'skipped';
    userCode?: string;
    userAnswer?: string;
    feedback?: string;
    score?: number;
    testCases?: {
        input: string;
        expectedOutput: string;
        isHidden?: boolean;
        isEdgeCase?: boolean;
    }[];
    timeSpent?: number; // in seconds
    submittedAt?: string;
}

export interface InterviewSection {
    id: string;
    name: string;
    type: 'warm-up' | 'coding' | 'sql' | 'behavioral' | 'system-design' | 'mixed';
    duration: number; // in minutes
    questions: InterviewQuestion[];
    status: 'pending' | 'start' | 'submitted';
    startTime?: string;
    endTime?: string;
    sectionScore?: number;
}

export interface InterviewSession {
    _id: string;
    config: {
        duration: number; // total duration in minutes
        sectionCount: number;
        difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
        language?: string;
        hasCameraAccess?: boolean;
        strictMode?: boolean;
        enforceFullscreen?: boolean;
        sections: {
            name: string;
            type: 'warm-up' | 'coding' | 'sql' | 'behavioral' | 'system-design' | 'mixed';
            duration: number; // in minutes
            questionCount: number;
        }[];
    };
    sections: InterviewSection[];
    status: 'start' | 'submitted';
    currentSectionIndex: number;
    totalScore: number;
    overallFeedback: string;
    startedAt: string;
    endedAt?: string;
    proctoringSecret?: string;
    proctoring?: {
        cameraAccessGranted: boolean;
        fullscreenRequired: boolean;
        tabSwitchCount: number;
        idleTime: number; // in seconds
        lastActivityTime: string;
    };
    analytics?: {
        totalTimeSpent: number; // in seconds
        timePerQuestion: { questionId: string; timeSpent: number }[];
        sectionPerformance: { sectionId: string; score: number; timeSpent: number }[];
        difficultyBreakdown: { difficulty: string; count: number; averageScore: number }[];
        topicBreakdown: { topic: string; count: number; averageScore: number }[];
        strengths: string[];
        areasForImprovement: string[];
    };
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
    isEdgeCase?: boolean;
}

export interface InterviewRunResult {
    status: 'success' | 'fail' | 'error';
    feedback?: string;
    summary: { passed: number; total: number };
    testResults: InterviewTestResult[];
}

export interface InterviewSubmitResult {
    status: 'pass' | 'fail' | 'error';
    feedback: string;
    score: number;
    summary?: { passed: number; total: number };
    testResults?: InterviewTestResult[];
}

export interface InterviewAnalytics {
    totalTimeSpent: number; // in seconds
    timePerQuestion: { questionId: string; timeSpent: number }[];
    sectionPerformance: { sectionId: string; score: number; timeSpent: number }[];
    difficultyBreakdown: { difficulty: string; count: number; averageScore: number }[];
    topicBreakdown: { topic: string; count: number; averageScore: number }[];
    strengths: string[];
    areasForImprovement: string[];
}

export interface InterviewProctoringUpdate {
    tabSwitchCount?: number;
    idleTime?: number;
    lastActivityTime?: string;
    violationType?: string;
    violationMessage?: string;
    timestamp?: string;
    clientProof?: string;
    sequenceNumber?: number;
    mouseTrail?: { x: number; y: number; t: number }[];
    keystrokeDynamics?: { key: string; pressTime: number; releaseTime: number }[];
}

export interface ChatSession {
    _id: string;
    userId: string;
    title: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }[];
    metadata?: {
        model?: string;
        tokensUsed?: number;
        assistantType?: 'learning-os' | 'script-writer';
    };
    createdAt: string;
    updatedAt: string;
}
