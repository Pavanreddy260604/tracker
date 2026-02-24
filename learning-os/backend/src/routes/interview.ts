import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { InterviewSession, type IInterviewSession } from '../models/InterviewSession.js';
import { AIServiceError, OllamaService } from '../services/ollama.service.js';
import { Question } from '../models/Question.js';
import { UserActivity } from '../models/UserActivity.js';
import { apiLimiter, interviewWriteLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import {
    InterviewJudgeService,
    getSqlQuestionTemplate,
    getSystemDesignQuestionTemplate,
    type JudgeTestCase,
} from '../services/interviewJudge.service.js';

const router = express.Router();
const ollama = new OllamaService();
const interviewJudge = new InterviewJudgeService();

// Validation schemas for submit-section endpoint
const answerSchema = z.object({
    questionIndex: z.number().int().min(0).max(100),
    userCode: z.string().max(100000).optional(),
    userAnswer: z.string().max(50000).optional(),
    score: z.number().min(0).max(100).optional(),
    timeSpent: z.number().min(0).max(3600).optional(), // max 1 hour per question
});

const submitSectionSchema = z.object({
    answers: z.array(answerSchema).min(1).max(50),
});

const proctoringUpdateSchema = z
    .object({
        tabSwitchCount: z.number().int().min(0).max(10000).optional(),
        idleTime: z.number().min(0).max(86400).optional(),
        lastActivityTime: z.string().datetime().optional(),
        violationType: z.string().max(100).optional(),
        violationMessage: z.string().max(500).optional(),
        timestamp: z.string().datetime().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one proctoring field is required',
    });

const endInterviewSchema = z.object({
    sessionId: z.string().min(1),
    sectionAnswers: z
        .array(
            z.object({
                sectionIndex: z.number().int().min(0).max(100),
                answers: z.array(answerSchema).max(200),
            })
        )
        .optional(),
});

const isExecutionProviderError = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    return /code execution provider|code execution unavailable/i.test(error.message);
};

const normalizeSessionStatus = (status: unknown): 'start' | 'submitted' => {
    const value = typeof status === 'string' ? status.toLowerCase() : '';
    if (value === 'start') return 'start';
    if (value === 'submitted') return 'submitted';
    // Legacy non-start values are treated as submitted to prevent resuming.
    return 'submitted';
};

const normalizeSectionStatus = (status: unknown): 'pending' | 'start' | 'submitted' => {
    const value = typeof status === 'string' ? status.toLowerCase() : '';
    if (value === 'start' || value === 'in-progress') return 'start';
    if (value === 'submitted' || value === 'completed') return 'submitted';
    return 'pending';
};

const normalizeRequestedSectionType = (
    type: unknown
): 'warm-up' | 'coding' | 'sql' | 'system-design' | 'mixed' => {
    const value = typeof type === 'string' ? type.toLowerCase() : '';
    if (value === 'warm-up') return 'warm-up';
    if (value === 'coding') return 'coding';
    if (value === 'sql') return 'sql';
    if (value === 'system-design') return 'system-design';
    if (value === 'behavioral') return 'system-design';
    return 'mixed';
};

const normalizeQuestionType = (
    type: unknown
): 'coding' | 'sql' | 'system-design' | 'behavioral' => {
    const value = typeof type === 'string' ? type.toLowerCase() : '';
    if (value === 'coding') return 'coding';
    if (value === 'sql') return 'sql';
    if (value === 'system-design') return 'system-design';
    if (value === 'behavioral') return 'behavioral';
    return 'coding';
};

const toJudgeTestCases = (cases: any[] | undefined): JudgeTestCase[] =>
    (cases || []).map((tc) => ({
        input: String(tc.input ?? ''),
        expectedOutput: String(tc.expectedOutput ?? ''),
        isHidden: Boolean(tc.isHidden),
        isEdgeCase: Boolean(tc.isEdgeCase),
    }));

const toQuestionStatus = (judgeStatus: 'pass' | 'fail'): 'solved' | 'failed' =>
    judgeStatus === 'pass' ? 'solved' : 'failed';

const normalizeInterviewSession = (session: IInterviewSession): void => {
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

const logInterviewDeletionAudit = async (params: {
    userId: string;
    description: string;
    path: string;
    targetId?: string;
    details?: Record<string, unknown>;
}) => {
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
        console.error('[Interview] Failed to write deletion audit log:', error);
    }
};

// POST /api/interview/start
// Start a new protracted interview session with multiple stages
router.post('/start', authenticate, interviewWriteLimiter, async (req: any, res) => {
    try {
        const { duration, language, sectionsConfig, hasCameraAccess, strictMode = true } = req.body;
        const strictModeEnabled = typeof strictMode === 'boolean' ? strictMode : true;

        const selectedLanguage = typeof language === 'string' ? language.toLowerCase() : 'javascript';
        const supportedLanguages = new Set(['javascript', 'python', 'java', 'cpp', 'go']);

        if (!sectionsConfig || !Array.isArray(sectionsConfig) || sectionsConfig.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid sections configuration.' });
        }
        if (!supportedLanguages.has(selectedLanguage)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported interview language. Use JavaScript, Python, Java, C++, or Go.'
            });
        }

        console.log(`Starting protracted interview for ${req.userId} with ${sectionsConfig.length} sections.`);

        // Process sections to create the interview structure
        const sections: any[] = [];
        for (let sectionIdx = 0; sectionIdx < sectionsConfig.length; sectionIdx++) {
            const sectionConfig = sectionsConfig[sectionIdx];
            const { name, type, duration: sectionDuration, questionCount } = sectionConfig;
            const normalizedSectionType = normalizeRequestedSectionType(type);

            const section: any = {
                id: `section-${sectionIdx}`,
                name,
                type: normalizedSectionType,
                duration: sectionDuration,
                status: sectionIdx === 0 ? 'start' : 'pending',
                questions: [],
                startTime: sectionIdx === 0 ? new Date() : undefined,
            };

            // Generate questions based on section type
            for (let questionIdx = 0; questionIdx < questionCount; questionIdx++) {
                let question;
                const rawConfig = Array.isArray(sectionConfig.questionsConfig)
                    ? sectionConfig.questionsConfig[questionIdx]
                    : undefined;
                const sectionDifficulty = sectionConfig.difficulty || 'medium';
                const sectionTopics = Array.isArray(sectionConfig.topics) && sectionConfig.topics.length > 0
                    ? sectionConfig.topics
                    : ['Array'];
                const config = {
                    difficulty: rawConfig?.difficulty || sectionDifficulty,
                    topics: Array.isArray(rawConfig?.topics) && rawConfig.topics.length > 0
                        ? rawConfig.topics
                        : sectionTopics
                };

                if (normalizedSectionType === 'coding' || normalizedSectionType === 'warm-up') {
                    // Try to find existing coding question
                    const matchedQuestions = await Question.aggregate([
                        {
                            $match: {
                                difficulty: config.difficulty,
                                topics: { $in: config.topics || [] }
                            }
                        },
                        { $sample: { size: 1 } }
                    ]);
                    question = matchedQuestions[0];

                    // Generate if not found
                    if (!question) {
                        console.log(`[Interview] Section ${sectionIdx + 1}, Question ${questionIdx + 1}: Generating ${config.difficulty} ${config.topics?.join('+')} question...`);
                        try {
                            const generated = await ollama.generateCuratedQuestion(config.difficulty, config.topics);
                            if (generated && generated.title) {
                                const q = new Question(generated);
                                await q.save();
                                question = q;
                                console.log(`[Interview] Generated: ${q.title}`);
                            }
                        } catch (e) {
                            console.error('[Interview] Generation failed for section', sectionIdx, 'question', questionIdx, e);
                        }
                    }
                } else if (normalizedSectionType === 'sql') {
                    const sqlQuestion = getSqlQuestionTemplate(config.difficulty || 'medium');
                    question = {
                        problemName: sqlQuestion.title,
                        description: sqlQuestion.description,
                        difficulty: sqlQuestion.difficulty,
                        type: 'sql',
                        testCases: sqlQuestion.testCases,
                    };
                } else if (normalizedSectionType === 'system-design') {
                    const designQuestion = getSystemDesignQuestionTemplate(config.difficulty || 'medium');
                    question = {
                        problemName: designQuestion.title,
                        description: designQuestion.description,
                        difficulty: designQuestion.difficulty,
                        type: 'system-design',
                        testCases: designQuestion.testCases,
                    };
                } else {
                    // Mixed type - random among technical sections.
                    const randomKinds: Array<'coding' | 'sql' | 'system-design'> = ['coding', 'sql', 'system-design'];
                    const randomType = randomKinds[Math.floor(Math.random() * randomKinds.length)];
                    if (randomType === 'coding') {
                        const matchedQuestions = await Question.aggregate([
                            {
                                $match: {
                                    difficulty: config.difficulty,
                                    topics: { $in: config.topics || [] }
                                }
                            },
                            { $sample: { size: 1 } }
                        ]);
                        question = matchedQuestions[0];
                    } else if (randomType === 'sql') {
                        const sqlQuestion = getSqlQuestionTemplate(config.difficulty || 'medium');
                        question = {
                            problemName: sqlQuestion.title,
                            description: sqlQuestion.description,
                            difficulty: sqlQuestion.difficulty,
                            type: 'sql',
                            testCases: sqlQuestion.testCases,
                        };
                    } else {
                        const designQuestion = getSystemDesignQuestionTemplate(config.difficulty || 'medium');
                        question = {
                            problemName: designQuestion.title,
                            description: designQuestion.description,
                            difficulty: designQuestion.difficulty,
                            type: 'system-design',
                            testCases: designQuestion.testCases,
                        };
                    }
                }

                if (question) {
                    const questionType = normalizeQuestionType(question.type || 'coding');
                    const normalizedCases = (question.testCases || []).map((tc: any) =>
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
                    section.questions.push({
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

        // Validate sections have questions
        const validSections = sections.filter(section => section.questions.length > 0);
        if (validSections.length === 0) {
            return res.status(500).json({ success: false, error: 'Failed to prepare interview questions.' });
        }

        const session = new InterviewSession({
            userId: req.userId,
            config: {
                duration: duration || 90, // Default to 90 minutes for protracted test
                sectionCount: validSections.length,
                difficulty: 'mixed', // Per-section difficulty
                language: selectedLanguage,
                hasCameraAccess: !!hasCameraAccess,
                strictMode: strictModeEnabled,
                sections: sectionsConfig.map((section: any) => ({
                    ...section,
                    type: normalizeRequestedSectionType(section?.type),
                })),
            },
            sections: validSections,
            currentSectionIndex: 0,
            status: 'start',
            proctoring: {
                cameraAccessGranted: !!hasCameraAccess,
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

        console.log(`[Interview] Session created for user ${req.userId} with ${validSections.length} sections`);
        res.json({ success: true, data: session });

    } catch (error: any) {
        console.error('[Interview] Start error:', error);
        if (isExecutionProviderError(error)) {
            res.status(503).json({
                success: false,
                error: 'Code execution service is temporarily unavailable. Please try again later.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to start interview session'
            });
        }
    }
});

// POST /api/interview/:id/next-section
// Move to next interview section
router.post('/:id/next-section', authenticate, interviewWriteLimiter, async (req: any, res) => {
    try {
        const { id } = req.params;

        const session = await InterviewSession.findOne({
            _id: id,
            userId: req.userId
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        normalizeInterviewSession(session);
        if (session.status === 'submitted') {
            return res.status(400).json({ success: false, error: 'Session already submitted' });
        }

        // Submit current section
        const currentSection = session.sections[session.currentSectionIndex];
        if (!currentSection) {
            return res.status(400).json({ success: false, error: 'No current section found' });
        }
        currentSection.status = 'submitted';
        currentSection.endTime = new Date();

        // Calculate section score
        const sectionScore = currentSection.questions.length > 0
            ? currentSection.questions.reduce((sum, q) => sum + (q.score || 0), 0) / currentSection.questions.length
            : 0;
        currentSection.sectionScore = Math.round(sectionScore);

        // Move to next section
        session.currentSectionIndex++;

        if (session.currentSectionIndex < session.sections.length) {
            // Start next section
            const nextSection = session.sections[session.currentSectionIndex];
            nextSection.status = 'start';
            nextSection.startTime = new Date();
        } else {
            // Submit entire interview
            session.status = 'submitted';
            session.endedAt = new Date();

            // Calculate total score
            const totalScore = session.sections.reduce((sum, section) => sum + (section.sectionScore || 0), 0) / session.sections.length;
            session.totalScore = Math.round(totalScore);

            // Generate overall feedback
            try {
                session.overallFeedback = await ollama.generateInterviewFeedback(session);
            } catch (e) {
                console.error('[Interview] Feedback generation failed:', e);
                session.overallFeedback = 'Your interview performance shows a good understanding of the topics covered. Focus on improving your time management and code efficiency.';
            }
        }

        await session.save();
        res.json({ success: true, data: session });

    } catch (error) {
        console.error('[Interview] Next section error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to move to next section'
        });
    }
});

// POST /api/interview/:id/submit-section
// Submit all answers for current section
router.post('/:id/submit-section', authenticate, interviewWriteLimiter, async (req: any, res) => {
    try {
        const { id } = req.params;

        // Validate request body
        const parsed = submitSectionSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message
            });
        }
        const { answers } = parsed.data;

        const session = await InterviewSession.findOne({
            _id: id,
            userId: req.userId
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        normalizeInterviewSession(session);
        if (session.status === 'submitted') {
            return res.status(400).json({ success: false, error: 'Session already submitted' });
        }

        const currentSection = session.sections[session.currentSectionIndex];
        if (!currentSection) {
            return res.status(400).json({ success: false, error: 'No current section found' });
        }

        // Update each question in the section with validated data
        for (const answer of answers) {
            // Validate questionIndex is within bounds
            if (answer.questionIndex >= currentSection.questions.length) {
                continue; // Skip invalid indices silently
            }
            const question = currentSection.questions[answer.questionIndex];
            if (question) {
                if (answer.userCode !== undefined) question.userCode = answer.userCode;
                if (answer.userAnswer !== undefined) question.userAnswer = answer.userAnswer;
                if (answer.score !== undefined) {
                    question.score = answer.score;
                    question.status = answer.score >= 60 ? 'solved' : 'failed';
                }
                question.submittedAt = new Date();
                if (answer.timeSpent !== undefined) question.timeSpent = answer.timeSpent;
            }
        }

        // Calculate section score
        const sectionScore = currentSection.questions.length > 0
            ? currentSection.questions.reduce((sum, q) => sum + (q.score || 0), 0) / currentSection.questions.length
            : 0;
        currentSection.sectionScore = Math.round(sectionScore);

        await session.save();
        res.json({ success: true, data: session });

    } catch (error) {
        console.error('[Interview] Submit section error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit section'
        });
    }
});

// POST /api/interview/:id/proctoring
// Update proctoring telemetry and violation counters.
router.post('/:id/proctoring', authenticate, apiLimiter, async (req: any, res) => {
    try {
        const { id } = req.params;
        const parsed = proctoringUpdateSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message,
            });
        }

        const payload = parsed.data;
        const session = await InterviewSession.findOne({
            _id: id,
            userId: req.userId,
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

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

        res.json({ success: true, data: session });
    } catch (error) {
        console.error('[Interview] Proctoring update error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update proctoring data',
        });
    }
});

// GET /api/interview/:id/analytics
// Get detailed interview analytics
router.get('/:id/analytics', authenticate, async (req: any, res) => {
    try {
        const { id } = req.params;

        const session = await InterviewSession.findOne({
            _id: id,
            userId: req.userId
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Calculate detailed analytics if not already generated
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

        // Calculate time per question
        const timePerQuestion: { questionId: string; timeSpent: number }[] = [];
        session.sections.forEach(section => {
            section.questions.forEach((question, idx) => {
                timePerQuestion.push({
                    questionId: `${section.id}-q${idx}`,
                    timeSpent: question.timeSpent || 0,
                });
            });
        });
        analytics.timePerQuestion = timePerQuestion;

        // Calculate section performance
        const sectionPerformance = session.sections.map(section => ({
            sectionId: section.id,
            score: section.sectionScore || 0,
            timeSpent: section.endTime && section.startTime
                ? Math.floor((section.endTime.getTime() - section.startTime.getTime()) / 1000)
                : 0,
        }));
        analytics.sectionPerformance = sectionPerformance;

        // Calculate difficulty breakdown
        const difficultyBreakdown: { [key: string]: { count: number; totalScore: number } } = {};
        session.sections.forEach(section => {
            section.questions.forEach(question => {
                const difficulty = question.difficulty || 'medium';
                if (!difficultyBreakdown[difficulty]) {
                    difficultyBreakdown[difficulty] = { count: 0, totalScore: 0 };
                }
                difficultyBreakdown[difficulty].count++;
                difficultyBreakdown[difficulty].totalScore += question.score || 0;
            });
        });
        analytics.difficultyBreakdown = Object.entries(difficultyBreakdown).map(([difficulty, data]) => ({
            difficulty,
            count: data.count,
            averageScore: Math.round(data.totalScore / data.count),
        }));

        await session.save();
        res.json({ success: true, data: analytics });

    } catch (error) {
        console.error('[Interview] Analytics error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get analytics'
        });
    }
});

// POST /api/interview/submit
// Submit code for a specific question in current section
router.post('/submit', authenticate, interviewWriteLimiter, async (req: any, res) => {
    try {
        const { sessionId, questionIndex, code, userAnswer } = req.body;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        normalizeInterviewSession(session);
        if (session.status === 'submitted') {
            return res.status(400).json({ success: false, error: 'Session already submitted' });
        }

        const currentSection = session.sections[session.currentSectionIndex];
        const question = currentSection.questions[questionIndex];
        if (!question) {
            return res.status(400).json({ success: false, error: 'Invalid question index' });
        }

        const questionType = normalizeQuestionType(question.type);
        const shouldUseCode = questionType === 'coding' || questionType === 'sql';
        const dbQuestion =
            questionType === 'coding' && question.questionId
                ? await Question.findById(question.questionId)
                : null;

        const testCases = questionType === 'coding' && dbQuestion
            ? toJudgeTestCases(dbQuestion.testCases as any[])
            : toJudgeTestCases(question.testCases as any[]);

        const evaluation = await interviewJudge.evaluateSubmission({
            questionType,
            language: session.config.language || 'javascript',
            code: shouldUseCode ? String(code || '') : undefined,
            answer: shouldUseCode ? undefined : String(userAnswer || ''),
            testCases,
        });

        if (shouldUseCode) {
            question.userCode = String(code || '');
        } else {
            question.userAnswer = String(userAnswer || '');
        }
        question.feedback = evaluation.feedback;
        question.score = evaluation.score;
        question.status = toQuestionStatus(evaluation.status);
        question.submittedAt = new Date();

        // Save sub-doc change
        session.markModified('sections');
        await session.save();

        res.json({
            success: true,
            data: {
                status: evaluation.status,
                score: evaluation.score,
                feedback: evaluation.feedback,
                summary: evaluation.summary,
                testResults: evaluation.testResults || []
            }
        });
    } catch (error: any) {
        console.error('Submit Code Error:', error);
        if (isExecutionProviderError(error)) {
            const message = error instanceof Error ? error.message : 'Code execution unavailable.';
            return res.json({
                success: true,
                data: {
                    status: 'error',
                    score: 0,
                    feedback: `### Execution Result\n${message}\n\nPlease retry after configuring the execution provider.`,
                    summary: { passed: 0, total: 0 },
                    testResults: []
                }
            });
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Evaluation failed'
        });
    }
});

// POST /api/interview/chat
// Chat with AI Context
router.post('/chat', authenticate, async (req: any, res) => {
    try {
        const { message, context, stream } = req.body;
        // Context might contain: problemName, description, userCode, difficulty

        console.log(`[AI Chat] User: ${req.userId} | Msg: ${message} | Stream: ${stream}`);

        // Construct a helpful system prompt
        let systemPrompt = "You are an expert AI Software Architect and Mentor.";
        if (context) {
            if (context.problemName) systemPrompt += `\nCurrent Problem: ${context.problemName} (${context.difficulty})`;
            if (context.description) systemPrompt += `\nProblem Description: ${context.description.substring(0, 500)}...`; // Truncate
            if (context.userCode) systemPrompt += `\nUser's Current Code:\n\`\`\`\n${context.userCode}\n\`\`\``;
        }
        systemPrompt += "\n\nUser Question: " + message;
        systemPrompt += "\n\nInstructions: You are a helpful expert. Provide detailed explanations, optimization tips, and full code solutions if asked. Do not be restrictive. Focus on teaching best practices and architectural patterns.";

        if (stream) {
            // Streaming Response
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Transfer-Encoding', 'chunked');

            try {
                const streamGenerator = ollama.generateResponseStream(systemPrompt);
                for await (const chunk of streamGenerator) {
                    res.write(chunk);
                }
                res.end();
            } catch (streamError) {
                console.error("Streaming failed:", streamError);
                if (!res.writableEnded) {
                    const message = streamError instanceof AIServiceError
                        ? streamError.message
                        : 'AI failed to stream response.';
                    res.write(`\n${message}`);
                    res.end();
                }
            }

        } else {
            // Non-streaming fallback
            const response = await ollama.generateResponse(systemPrompt);
            res.json({ success: true, data: { reply: response } });
        }

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        if (!res.headersSent) {
            const message = error instanceof AIServiceError ? error.message : 'AI failed to respond.';
            res.status(502).json({ success: false, error: message });
        }
    }
});

// POST /api/interview/run
// Dry run code against test cases (no grading, no DB save)
router.post('/run', authenticate, apiLimiter, async (req: any, res) => {
    try {
        const { sessionId, questionIndex, code, customInput, userAnswer } = req.body;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        normalizeInterviewSession(session);
        if (session.status === 'submitted') {
            return res.status(400).json({ success: false, error: 'Session already submitted' });
        }

        const currentSection = session.sections[session.currentSectionIndex];
        if (!currentSection) {
            return res.status(400).json({ success: false, error: 'No current section found' });
        }
        const question = currentSection.questions[questionIndex];
        if (!question) {
            return res.status(400).json({ success: false, error: 'Invalid question index' });
        }
        const questionType = normalizeQuestionType(question.type);
        const shouldUseCode = questionType === 'coding' || questionType === 'sql';
        const dbQuestion =
            questionType === 'coding' && question.questionId
                ? await Question.findById(question.questionId)
                : null;
        const testCases = questionType === 'coding' && dbQuestion
            ? toJudgeTestCases(dbQuestion.testCases as any[])
            : toJudgeTestCases(question.testCases as any[]);

        const runResult = await interviewJudge.runSubmission({
            questionType,
            language: session.config.language || 'javascript',
            code: shouldUseCode ? String(code || '') : undefined,
            answer: shouldUseCode ? undefined : String(userAnswer || ''),
            testCases,
            customInput: customInput !== undefined && customInput !== null ? String(customInput) : undefined,
        });

        res.json({ success: true, data: runResult });

    } catch (error: any) {
        console.error('Run Code Error:', error);
        if (isExecutionProviderError(error)) {
            const message = error instanceof Error ? error.message : 'Code execution unavailable.';
            return res.json({
                success: true,
                data: {
                    status: 'error',
                    feedback: message,
                    summary: { passed: 0, total: 0 },
                    testResults: [
                        {
                            index: 0,
                            input: typeof req.body?.customInput === 'string' ? req.body.customInput : undefined,
                            passed: false,
                            error: message,
                            isCustom: req.body?.customInput !== undefined && req.body?.customInput !== null
                        }
                    ]
                }
            });
        }
        res.status(500).json({ success: false, error: error.message || 'Execution failed' });
    }
});

// POST /api/interview/end
// Finish user interview
router.post('/end', authenticate, interviewWriteLimiter, async (req: any, res) => {
    try {
        const parsed = endInterviewSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message,
            });
        }

        const { sessionId, sectionAnswers } = parsed.data;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        normalizeInterviewSession(session);

        if (Array.isArray(sectionAnswers)) {
            for (const submittedSection of sectionAnswers) {
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
            const sectionScore = section.questions.length > 0
                ? section.questions.reduce((sum, q) => sum + (q.score || 0), 0) / section.questions.length
                : 0;
            section.sectionScore = Math.round(sectionScore);
        });

        // Calculate total score across all questions.
        const allQuestions = session.sections.flatMap((section) => section.questions);
        const totalScore = allQuestions.length > 0
            ? allQuestions.reduce((acc, q) => acc + (q.score || 0), 0) / allQuestions.length
            : 0;
        session.totalScore = Math.round(totalScore);

        session.markModified('sections');
        await session.save();

        res.json({ success: true, data: session });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to end session' });
    }
});

// GET /api/interview/history
router.get('/history', authenticate, async (req: any, res) => {
    try {
        const sessions = await InterviewSession.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .select('-questions.description -questions.userCode'); // Lightweight list

        sessions.forEach((session) => normalizeInterviewSession(session));

        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

// GET /api/interview/:id
router.get('/:id', authenticate, async (req: any, res) => {
    try {
        const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
        if (!session) return res.status(404).json({ success: false, error: 'Not found' });
        normalizeInterviewSession(session);

        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error fetching session' });
    }
});

// DELETE /api/interview/:id - Delete a specific interview session
router.delete('/:id([0-9a-fA-F]{24})', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const session = await InterviewSession.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        await logInterviewDeletionAudit({
            userId: req.userId,
            description: 'Permanently deleted an interview session',
            path: `/api/interview/${req.params.id}`,
            targetId: String(session._id),
            details: {
                deletionType: 'single',
                sessionStatusAtDeletion: session.status,
                sessionStartedAt: session.startedAt,
                deletedAt: new Date().toISOString(),
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || '',
            },
        });

        res.json({
            success: true,
            data: {
                message: 'Session deleted successfully',
                deletedId: String(session._id),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
});

// DELETE /api/interview/history/clear - Clear all interview history for user
router.delete('/history/clear', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const deletedSessions = await InterviewSession.find({ userId: req.userId }).select('_id startedAt status');
        const result = await InterviewSession.deleteMany({ userId: req.userId });

        await logInterviewDeletionAudit({
            userId: req.userId,
            description: 'Permanently deleted all interview history',
            path: '/api/interview/history/clear',
            details: {
                deletionType: 'bulk',
                deletedCount: result.deletedCount || 0,
                deletedSessionIds: deletedSessions.map((session) => String(session._id)),
                deletedAt: new Date().toISOString(),
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || '',
            },
        });

        res.json({
            success: true,
            data: {
                message: `Deleted ${result.deletedCount} session(s) successfully`,
                deletedCount: result.deletedCount || 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to clear history' });
    }
});

export default router;
