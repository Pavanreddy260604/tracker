import { InterviewSession, type IInterviewSession } from '../models/InterviewSession.js';
import { Question } from '../models/Question.js';
import { UserActivity } from '../models/UserActivity.js';
import { QuestionGenerationService } from './questionGeneration.service.js';
import { AIClientService, AIServiceError } from './aiClient.service.js';
import { AIJudgeService } from './aiJudge.service.js';
import {
    InterviewJudgeService,
    getSqlQuestionTemplate,
    getSystemDesignQuestionTemplate,
    type JudgeTestCase,
} from './interviewJudge.service.js';
import {
    normalizeRequestedSectionType,
    normalizeQuestionType,
    normalizeInterviewSession,
    normalizeTestCases,
    toJudgeTestCases,
    toQuestionStatus,
    calculateSectionScore,
    calculateTotalScore,
    SUPPORTED_LANGUAGES,
    type SectionType,
    type QuestionType,
} from '../domain/interview.domain.js';

// ─── Singleton Instances ─────────────────────────────────────────────────────

const aiJudge = new AIJudgeService();
const questionGenerator = new QuestionGenerationService();
const aiClient = new AIClientService();
const interviewJudge = new InterviewJudgeService();

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionConfig {
    name: string;
    type: string;
    duration: number;
    questionCount: number;
    difficulty?: string;
    topics?: string[];
    questionsConfig?: { difficulty?: string; topics?: string[] }[];
}

interface StartInterviewInput {
    userId: string;
    duration?: number;
    language?: string;
    sectionsConfig: SectionConfig[];
    hasCameraAccess?: boolean;
    strictMode?: boolean;
}

interface SubmitCodeInput {
    userId: string;
    sessionId: string;
    questionIndex: number;
    code?: string;
    userAnswer?: string;
}

interface RunCodeInput {
    userId: string;
    sessionId: string;
    questionIndex: number;
    code?: string;
    customInput?: string | null;
    userAnswer?: string;
}

interface AnswerInput {
    questionIndex: number;
    userCode?: string;
    userAnswer?: string;
    score?: number;
    timeSpent?: number;
}

interface EndInterviewInput {
    userId: string;
    sessionId: string;
    sectionAnswers?: { sectionIndex: number; answers: AnswerInput[] }[];
}

interface DeletionAuditParams {
    userId: string;
    description: string;
    path: string;
    targetId?: string;
    details?: Record<string, unknown>;
}

// ─── Question Generation ─────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

const asDifficulty = (d: string): Difficulty =>
    (['easy', 'medium', 'hard'].includes(d) ? d : 'medium') as Difficulty;

const generateQuestionForType = async (
    sectionType: SectionType,
    config: { difficulty: string; topics: string[] }
): Promise<Record<string, unknown> | null> => {
    if (sectionType === 'coding' || sectionType === 'warm-up') {
        // Try to find existing coding question
        const matchedQuestions = await Question.aggregate([
            { $match: { difficulty: config.difficulty, topics: { $in: config.topics || [] } } },
            { $sample: { size: 1 } },
        ]);
        if (matchedQuestions[0]) return matchedQuestions[0] as Record<string, unknown>;

        // Generate if not found
        try {
            const generated = await questionGenerator.generateCuratedQuestion(config.difficulty, config.topics);
            if (generated?.title) {
                const q = new Question({ ...generated, difficulty: asDifficulty(String(generated.difficulty || 'medium')) });
                await q.save();
                return q.toObject() as unknown as Record<string, unknown>;
            }
        } catch (e) {
            console.error('[InterviewService] Question generation failed:', e);
        }
        return null;
    }

    if (sectionType === 'sql') {
        const sqlQuestion = getSqlQuestionTemplate(asDifficulty(config.difficulty ?? 'medium'));
        return {
            problemName: sqlQuestion.title,
            description: sqlQuestion.description,
            difficulty: sqlQuestion.difficulty,
            type: 'sql',
            testCases: sqlQuestion.testCases,
        };
    }

    if (sectionType === 'system-design') {
        const designQuestion = getSystemDesignQuestionTemplate(asDifficulty(config.difficulty ?? 'medium'));
        return {
            problemName: designQuestion.title,
            description: designQuestion.description,
            difficulty: designQuestion.difficulty,
            type: 'system-design',
            testCases: designQuestion.testCases,
        };
    }

    // Mixed type — random among technical sections
    const randomKinds: SectionType[] = ['coding', 'sql', 'system-design'];
    const randomType = randomKinds[Math.floor(Math.random() * randomKinds.length)];
    return generateQuestionForType(randomType, config);
};

// ─── Build Interview Sections ────────────────────────────────────────────────

const buildInterviewSections = async (sectionsConfig: SectionConfig[]) => {
    const sections: Record<string, unknown>[] = [];

    for (let sectionIdx = 0; sectionIdx < sectionsConfig.length; sectionIdx++) {
        const sectionConfig = sectionsConfig[sectionIdx];
        const normalizedSectionType = normalizeRequestedSectionType(sectionConfig.type);

        const section: Record<string, unknown> = {
            id: `section-${sectionIdx}`,
            name: sectionConfig.name,
            type: normalizedSectionType,
            duration: sectionConfig.duration,
            status: sectionIdx === 0 ? 'start' : 'pending',
            questions: [] as Record<string, unknown>[],
            startTime: sectionIdx === 0 ? new Date() : undefined,
        };

        const questions = section.questions as Record<string, unknown>[];

        for (let questionIdx = 0; questionIdx < sectionConfig.questionCount; questionIdx++) {
            const rawConfig = Array.isArray(sectionConfig.questionsConfig)
                ? sectionConfig.questionsConfig[questionIdx]
                : undefined;
            const sectionDifficulty = sectionConfig.difficulty || 'medium';
            const sectionTopics =
                Array.isArray(sectionConfig.topics) && sectionConfig.topics.length > 0
                    ? sectionConfig.topics
                    : ['Array'];
            const config = {
                difficulty: rawConfig?.difficulty || sectionDifficulty,
                topics:
                    Array.isArray(rawConfig?.topics) && rawConfig.topics.length > 0
                        ? rawConfig.topics
                        : sectionTopics,
            };

            const question = await generateQuestionForType(normalizedSectionType, config);

            if (question) {
                const questionType = normalizeQuestionType(question.type || 'coding');
                const rawCases = (question.testCases as Record<string, unknown>[]) || [];
                const normalizedCases = normalizeTestCases(rawCases, questionType);

                questions.push({
                    questionId: question._id,
                    problemName: question.title || question.problemName,
                    difficulty: question.difficulty,
                    description: question.description,
                    type: questionType,
                    status: 'pending',
                    testCases: normalizedCases,
                });
            }
        }

        sections.push(section);
    }

    return sections.filter((s) => (s.questions as unknown[]).length > 0);
};

// ─── Public Service Functions ────────────────────────────────────────────────

export const startInterview = async (input: StartInterviewInput): Promise<IInterviewSession> => {
    const selectedLanguage = (input.language || 'javascript').toLowerCase();
    if (!SUPPORTED_LANGUAGES.has(selectedLanguage)) {
        throw Object.assign(new Error('Unsupported interview language. Use JavaScript, Python, Java, C++, or Go.'), { statusCode: 400 });
    }

    const strictModeEnabled = typeof input.strictMode === 'boolean' ? input.strictMode : true;

    const validSections = await buildInterviewSections(input.sectionsConfig);
    if (validSections.length === 0) {
        throw Object.assign(new Error('Failed to prepare interview questions.'), { statusCode: 500 });
    }

    const session = new InterviewSession({
        userId: input.userId,
        config: {
            duration: input.duration || 90,
            sectionCount: validSections.length,
            difficulty: 'mixed',
            language: selectedLanguage,
            hasCameraAccess: !!input.hasCameraAccess,
            strictMode: strictModeEnabled,
            sections: input.sectionsConfig.map((section) => ({
                ...section,
                type: normalizeRequestedSectionType(section.type),
            })),
        },
        sections: validSections,
        currentSectionIndex: 0,
        status: 'start',
        proctoring: {
            cameraAccessGranted: !!input.hasCameraAccess,
            fullscreenRequired: strictModeEnabled,
            tabSwitchCount: 0,
            idleTime: 0,
            lastActivityTime: new Date(),
        },
        analytics: {
            totalTimeSpent: 0,
            timePerQuestion: [],
            sectionPerformance: [],
            difficultyBreakdown: [],
            topicBreakdown: [],
            strengths: [],
            areasForImprovement: [],
        },
    });

    await session.save();
    return session;
};

export const nextSection = async (sessionId: string, userId: string): Promise<IInterviewSession> => {
    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);
    if (session.status === 'submitted') {
        throw Object.assign(new Error('Session already submitted'), { statusCode: 400 });
    }

    const currentSection = session.sections[session.currentSectionIndex];
    if (!currentSection) throw Object.assign(new Error('No current section found'), { statusCode: 400 });

    currentSection.status = 'submitted';
    currentSection.endTime = new Date();
    currentSection.sectionScore = calculateSectionScore(currentSection.questions);

    session.currentSectionIndex++;

    if (session.currentSectionIndex < session.sections.length) {
        const nextSec = session.sections[session.currentSectionIndex];
        nextSec.status = 'start';
        nextSec.startTime = new Date();
    } else {
        session.status = 'submitted';
        session.endedAt = new Date();
        session.totalScore = calculateTotalScore(session.sections);

        try {
            session.overallFeedback = await aiJudge.generateInterviewFeedback(session);
        } catch (e) {
            console.error('[InterviewService] Feedback generation failed:', e);
            session.overallFeedback =
                'Your interview performance shows a good understanding of the topics covered. Focus on improving your time management and code efficiency.';
        }
    }

    await session.save();
    return session;
};

export const submitSection = async (
    sessionId: string,
    userId: string,
    answers: AnswerInput[]
): Promise<IInterviewSession> => {
    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);
    if (session.status === 'submitted') {
        throw Object.assign(new Error('Session already submitted'), { statusCode: 400 });
    }

    const currentSection = session.sections[session.currentSectionIndex];
    if (!currentSection) throw Object.assign(new Error('No current section found'), { statusCode: 400 });

    for (const answer of answers) {
        if (answer.questionIndex >= currentSection.questions.length) continue;
        const question = currentSection.questions[answer.questionIndex];
        if (!question) continue;

        if (answer.userCode !== undefined) question.userCode = answer.userCode;
        if (answer.userAnswer !== undefined) question.userAnswer = answer.userAnswer;
        if (answer.score !== undefined) {
            question.score = answer.score;
            question.status = answer.score >= 60 ? 'solved' : 'failed';
        }
        question.submittedAt = new Date();
        if (answer.timeSpent !== undefined) question.timeSpent = answer.timeSpent;
    }

    currentSection.sectionScore = calculateSectionScore(currentSection.questions);
    await session.save();
    return session;
};

export const updateProctoring = async (
    sessionId: string,
    userId: string,
    payload: {
        tabSwitchCount?: number;
        idleTime?: number;
        lastActivityTime?: string;
        violationType?: string;
        timestamp?: string;
    }
): Promise<IInterviewSession> => {
    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);

    if (!session.proctoring) {
        session.proctoring = {
            cameraAccessGranted: false,
            fullscreenRequired: true,
            tabSwitchCount: 0,
            idleTime: 0,
            lastActivityTime: new Date(),
        };
    }

    if (typeof payload.tabSwitchCount === 'number') {
        session.proctoring.tabSwitchCount = payload.tabSwitchCount;
    }
    if (typeof payload.idleTime === 'number') {
        session.proctoring.idleTime = payload.idleTime;
    }

    const normalizedViolationType = String(payload.violationType || '').toLowerCase();
    if (normalizedViolationType === 'tab_switch' || normalizedViolationType === 'focus_loss') {
        session.proctoring.tabSwitchCount += 1;
    }

    const lastActivityTimestamp = payload.lastActivityTime || payload.timestamp;
    session.proctoring.lastActivityTime = lastActivityTimestamp
        ? new Date(lastActivityTimestamp)
        : new Date();

    session.markModified('proctoring');
    await session.save();
    return session;
};

export const getAnalytics = async (sessionId: string, userId: string) => {
    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    if (!session.analytics) {
        session.analytics = {
            totalTimeSpent: 0,
            timePerQuestion: [],
            sectionPerformance: [],
            difficultyBreakdown: [],
            topicBreakdown: [],
            strengths: [],
            areasForImprovement: [],
        };
    }
    const analytics = session.analytics;

    // Time per question
    const timePerQuestion: { questionId: string; timeSpent: number }[] = [];
    session.sections.forEach((section) => {
        section.questions.forEach((question, idx) => {
            timePerQuestion.push({
                questionId: `${section.id}-q${idx}`,
                timeSpent: question.timeSpent || 0,
            });
        });
    });
    analytics.timePerQuestion = timePerQuestion;

    // Section performance
    analytics.sectionPerformance = session.sections.map((section) => ({
        sectionId: section.id,
        score: section.sectionScore || 0,
        timeSpent:
            section.endTime && section.startTime
                ? Math.floor((section.endTime.getTime() - section.startTime.getTime()) / 1000)
                : 0,
    }));

    // Difficulty breakdown
    const difficultyMap: { [key: string]: { count: number; totalScore: number } } = {};
    session.sections.forEach((section) => {
        section.questions.forEach((question) => {
            const difficulty = question.difficulty || 'medium';
            if (!difficultyMap[difficulty]) {
                difficultyMap[difficulty] = { count: 0, totalScore: 0 };
            }
            difficultyMap[difficulty].count++;
            difficultyMap[difficulty].totalScore += question.score || 0;
        });
    });
    analytics.difficultyBreakdown = Object.entries(difficultyMap).map(([difficulty, data]) => ({
        difficulty,
        count: data.count,
        averageScore: Math.round(data.totalScore / data.count),
    }));

    await session.save();
    return analytics;
};

export const submitCode = async (input: SubmitCodeInput) => {
    const session = await InterviewSession.findOne({ _id: input.sessionId, userId: input.userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);
    if (session.status === 'submitted') {
        throw Object.assign(new Error('Session already submitted'), { statusCode: 400 });
    }

    const currentSection = session.sections[session.currentSectionIndex];
    const question = currentSection?.questions[input.questionIndex];
    if (!question) throw Object.assign(new Error('Invalid question index'), { statusCode: 400 });

    const questionType = normalizeQuestionType(question.type);
    const shouldUseCode = questionType === 'coding' || questionType === 'sql';
    const dbQuestion =
        questionType === 'coding' && question.questionId
            ? await Question.findById(question.questionId)
            : null;

    const testCases: JudgeTestCase[] =
        questionType === 'coding' && dbQuestion
            ? toJudgeTestCases(dbQuestion.testCases as { input?: unknown; expectedOutput?: unknown; isHidden?: unknown; isEdgeCase?: unknown }[])
            : toJudgeTestCases(question.testCases as { input?: unknown; expectedOutput?: unknown; isHidden?: unknown; isEdgeCase?: unknown }[]);

    const evaluation = await interviewJudge.evaluateSubmission({
        questionType,
        language: session.config.language || 'javascript',
        code: shouldUseCode ? String(input.code || '') : undefined,
        answer: shouldUseCode ? undefined : String(input.userAnswer || ''),
        testCases,
    });

    if (shouldUseCode) {
        question.userCode = String(input.code || '');
    } else {
        question.userAnswer = String(input.userAnswer || '');
    }
    question.feedback = evaluation.feedback;
    question.score = evaluation.score;
    question.status = toQuestionStatus(evaluation.status);
    question.submittedAt = new Date();

    session.markModified('sections');
    await session.save();

    return {
        status: evaluation.status,
        score: evaluation.score,
        feedback: evaluation.feedback,
        summary: evaluation.summary,
        testResults: evaluation.testResults || [],
    };
};

export const runCode = async (input: RunCodeInput) => {
    const session = await InterviewSession.findOne({ _id: input.sessionId, userId: input.userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);
    if (session.status === 'submitted') {
        throw Object.assign(new Error('Session already submitted'), { statusCode: 400 });
    }

    const currentSection = session.sections[session.currentSectionIndex];
    if (!currentSection) throw Object.assign(new Error('No current section found'), { statusCode: 400 });

    const question = currentSection.questions[input.questionIndex];
    if (!question) throw Object.assign(new Error('Invalid question index'), { statusCode: 400 });

    const questionType = normalizeQuestionType(question.type);
    const shouldUseCode = questionType === 'coding' || questionType === 'sql';
    const dbQuestion =
        questionType === 'coding' && question.questionId
            ? await Question.findById(question.questionId)
            : null;
    const testCases: JudgeTestCase[] =
        questionType === 'coding' && dbQuestion
            ? toJudgeTestCases(dbQuestion.testCases as { input?: unknown; expectedOutput?: unknown; isHidden?: unknown; isEdgeCase?: unknown }[])
            : toJudgeTestCases(question.testCases as { input?: unknown; expectedOutput?: unknown; isHidden?: unknown; isEdgeCase?: unknown }[]);

    return interviewJudge.runSubmission({
        questionType,
        language: session.config.language || 'javascript',
        code: shouldUseCode ? String(input.code || '') : undefined,
        answer: shouldUseCode ? undefined : String(input.userAnswer || ''),
        testCases,
        customInput: input.customInput !== undefined && input.customInput !== null ? String(input.customInput) : undefined,
    });
};

export const chatWithAI = async (
    message: string,
    context?: { problemName?: string; description?: string; userCode?: string; difficulty?: string },
    stream?: boolean
) => {
    let systemPrompt = 'You are an expert AI Software Architect and Mentor.';
    if (context) {
        if (context.problemName) systemPrompt += `\nCurrent Problem: ${context.problemName} (${context.difficulty})`;
        if (context.description) systemPrompt += `\nProblem Description: ${context.description.substring(0, 500)}...`;
        if (context.userCode) systemPrompt += `\nUser's Current Code:\n\`\`\`\n${context.userCode}\n\`\`\``;
    }
    systemPrompt += '\n\nUser Question: ' + message;
    systemPrompt +=
        '\n\nInstructions: You are a helpful expert. Provide detailed explanations, optimization tips, and full code solutions if asked. Do not be restrictive. Focus on teaching best practices and architectural patterns.';

    if (stream) {
        return { stream: true, generator: aiClient.generateResponseStream(systemPrompt) };
    }

    const response = await aiClient.generateResponse(systemPrompt);
    return { stream: false, reply: response };
};

export const endInterview = async (input: EndInterviewInput): Promise<IInterviewSession> => {
    const session = await InterviewSession.findOne({ _id: input.sessionId, userId: input.userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    normalizeInterviewSession(session);

    if (Array.isArray(input.sectionAnswers)) {
        for (const submittedSection of input.sectionAnswers) {
            const targetSection = session.sections[submittedSection.sectionIndex];
            if (!targetSection) continue;

            for (const answer of submittedSection.answers) {
                if (answer.questionIndex >= targetSection.questions.length) continue;
                const question = targetSection.questions[answer.questionIndex];

                if (answer.userCode !== undefined) question.userCode = answer.userCode;
                if (answer.userAnswer !== undefined) question.userAnswer = answer.userAnswer;
                if (answer.score !== undefined) {
                    question.score = answer.score;
                    question.status = answer.score >= 60 ? 'solved' : 'failed';
                }
                if (answer.timeSpent !== undefined) question.timeSpent = answer.timeSpent;
                question.submittedAt = new Date();
            }
        }
    }

    session.status = 'submitted';
    session.endedAt = new Date();
    session.sections.forEach((section) => {
        section.status = 'submitted';
        if (!section.endTime) section.endTime = new Date();
        section.sectionScore = calculateSectionScore(section.questions);
    });
    session.totalScore = calculateTotalScore(session.sections);

    session.markModified('sections');
    await session.save();
    return session;
};

export const getHistory = async (userId: string) => {
    const sessions = await InterviewSession.find({ userId })
        .sort({ createdAt: -1 })
        .select('-questions.description -questions.userCode');

    sessions.forEach((session) => normalizeInterviewSession(session));
    return sessions;
};

export const getSession = async (sessionId: string, userId: string) => {
    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    normalizeInterviewSession(session);
    return session;
};

export const deleteSession = async (sessionId: string, userId: string, req: { ip?: string; userAgent?: string }) => {
    const session = await InterviewSession.findOneAndDelete({ _id: sessionId, userId });
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    await logDeletionAudit({
        userId,
        description: 'Permanently deleted an interview session',
        path: `/api/interview/${sessionId}`,
        targetId: String(session._id),
        details: {
            deletionType: 'single',
            sessionStatusAtDeletion: session.status,
            sessionStartedAt: session.startedAt,
            deletedAt: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: req.userAgent || '',
        },
    });

    return { message: 'Session deleted successfully', deletedId: String(session._id) };
};

export const clearHistory = async (userId: string, req: { ip?: string; userAgent?: string }) => {
    const deletedSessions = await InterviewSession.find({ userId }).select('_id startedAt status');
    const result = await InterviewSession.deleteMany({ userId });

    await logDeletionAudit({
        userId,
        description: 'Permanently deleted all interview history',
        path: '/api/interview/history/clear',
        details: {
            deletionType: 'bulk',
            deletedCount: result.deletedCount || 0,
            deletedSessionIds: deletedSessions.map((session) => String(session._id)),
            deletedAt: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: req.userAgent || '',
        },
    });

    return {
        message: `Deleted ${result.deletedCount} session(s) successfully`,
        deletedCount: result.deletedCount || 0,
    };
};

// ─── Internal Helpers ────────────────────────────────────────────────────────

const logDeletionAudit = async (params: DeletionAuditParams) => {
    try {
        await UserActivity.create({
            userId: params.userId,
            type: 'delete',
            description: params.description,
            metadata: {
                path: params.path,
                component: 'Interview',
                targetId: params.targetId,
                details: params.details,
            },
        });
    } catch (error) {
        console.error('[InterviewService] Failed to write deletion audit log:', error);
    }
};
