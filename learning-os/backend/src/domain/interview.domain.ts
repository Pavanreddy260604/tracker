import type { IInterviewSession, IInterviewSection, IInterviewQuestion } from '../models/InterviewSession.js';
import type { JudgeTestCase } from '../services/interviewJudge.service.js';

// ─── Status Normalization (Pure) ─────────────────────────────────────────────

export type SessionStatus = 'start' | 'submitted';
export type SectionStatus = 'pending' | 'start' | 'submitted';
export type SectionType = 'warm-up' | 'coding' | 'sql' | 'system-design' | 'mixed';
export type QuestionType = 'coding' | 'sql' | 'system-design' | 'behavioral';

export const SUPPORTED_LANGUAGES = new Set(['javascript', 'python', 'java', 'cpp', 'go']);

export const normalizeSessionStatus = (status: unknown): SessionStatus => {
    const value = typeof status === 'string' ? status.toLowerCase() : '';
    if (value === 'start') return 'start';
    if (value === 'submitted') return 'submitted';
    // Legacy non-start values are treated as submitted to prevent resuming.
    return 'submitted';
};

export const normalizeSectionStatus = (status: unknown): SectionStatus => {
    const value = typeof status === 'string' ? status.toLowerCase() : '';
    if (value === 'start' || value === 'in-progress') return 'start';
    if (value === 'submitted' || value === 'completed') return 'submitted';
    return 'pending';
};

export const normalizeRequestedSectionType = (type: unknown): SectionType => {
    const value = typeof type === 'string' ? type.toLowerCase() : '';
    if (value === 'warm-up') return 'warm-up';
    if (value === 'coding') return 'coding';
    if (value === 'sql') return 'sql';
    if (value === 'system-design') return 'system-design';
    if (value === 'behavioral') return 'system-design';
    return 'mixed';
};

export const normalizeQuestionType = (type: unknown): QuestionType => {
    const value = typeof type === 'string' ? type.toLowerCase() : '';
    if (value === 'coding') return 'coding';
    if (value === 'sql') return 'sql';
    if (value === 'system-design') return 'system-design';
    if (value === 'behavioral') return 'behavioral';
    return 'coding';
};

// ─── Session Normalization ───────────────────────────────────────────────────

export const normalizeInterviewSession = (session: IInterviewSession): void => {
    session.status = normalizeSessionStatus(session.status);

    if (session.status === 'submitted') {
        session.sections.forEach((section) => {
            section.status = 'submitted';
            if (!section.endTime) section.endTime = new Date();
        });
        if (!session.endedAt) session.endedAt = new Date();
        return;
    }

    session.sections.forEach((section, idx) => {
        const normalized = normalizeSectionStatus(section.status);
        if (idx < session.currentSectionIndex) {
            section.status = 'submitted';
            if (!section.endTime) section.endTime = new Date();
            return;
        }
        if (idx === session.currentSectionIndex) {
            section.status = 'start';
            if (!section.startTime) section.startTime = new Date();
            return;
        }
        section.status = normalized === 'submitted' ? 'pending' : normalized;
    });
};

// ─── Test Case Mapping ───────────────────────────────────────────────────────

interface RawTestCase {
    input?: unknown;
    expectedOutput?: unknown;
    isHidden?: unknown;
    isEdgeCase?: unknown;
}

export const toJudgeTestCases = (cases: RawTestCase[] | undefined): JudgeTestCase[] =>
    (cases || []).map((tc) => ({
        input: String(tc.input ?? ''),
        expectedOutput: String(tc.expectedOutput ?? ''),
        isHidden: Boolean(tc.isHidden),
        isEdgeCase: Boolean(tc.isEdgeCase),
    }));

export const toQuestionStatus = (judgeStatus: 'pass' | 'fail'): 'solved' | 'failed' =>
    judgeStatus === 'pass' ? 'solved' : 'failed';

// ─── Score Calculation ───────────────────────────────────────────────────────

export const calculateSectionScore = (questions: IInterviewQuestion[]): number => {
    if (questions.length === 0) return 0;
    const total = questions.reduce((sum, q) => sum + (q.score || 0), 0);
    return Math.round(total / questions.length);
};

export const calculateTotalScore = (sections: IInterviewSection[]): number => {
    const allQuestions = sections.flatMap((s) => s.questions);
    if (allQuestions.length === 0) return 0;
    const total = allQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
    return Math.round(total / allQuestions.length);
};

// ─── Test Case Normalization ─────────────────────────────────────────────────

export const normalizeTestCases = (
    testCases: RawTestCase[],
    questionType: QuestionType
): RawTestCase[] =>
    testCases.map((tc) =>
        questionType === 'coding'
            ? {
                ...tc,
                isHidden: Math.random() > 0.7, // 30% hidden test cases
                isEdgeCase: Math.random() > 0.8, // 20% edge cases
            }
            : {
                ...tc,
                isHidden: Boolean(tc.isHidden),
                isEdgeCase: Boolean(tc.isEdgeCase),
            }
    );

// ─── Execution Error Detection ───────────────────────────────────────────────

export const isExecutionProviderError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /code execution provider|code execution unavailable/i.test(error.message);
};
