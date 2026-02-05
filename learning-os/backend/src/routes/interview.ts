import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { OllamaService } from '../services/ollama.service.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { ExecutionService } from '../services/execution.service.js';
import { Question } from '../models/Question.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const ollama = new OllamaService();

// POST /api/interview/start
// Start a new interview session
router.post('/start', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const { duration, language, questionsConfig } = req.body;
        // questionsConfig = [{ difficulty: 'easy', topics: ['Array'] }, ...]

        if (!questionsConfig || !Array.isArray(questionsConfig) || questionsConfig.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid question configuration.' });
        }

        console.log(`Starting interview for ${req.userId} with ${questionsConfig.length} custom questions.`);

        const finalQuestions: any[] = [];

        // Process each question slot in parallel
        await Promise.all(questionsConfig.map(async (config: any, index: number) => {
            const { difficulty, topics } = config;

            // 1. Try to find an existing question in DB
            // Note: To avoid duplicates within the same session, we might need sequential processing or smarter exclusion.
            // For V1 Parallel, let's try to fetch random matching.

            let question = await import('../models/Question.js').then(m => m.Question.aggregate([
                {
                    $match: {
                        difficulty: difficulty,
                        // rough topic match (at least one)
                        topics: { $in: topics || [] }
                    }
                },
                { $sample: { size: 1 } }
            ])).then(res => res[0]);

            // 2. If not found, GENERATE IT
            if (!question) {
                console.log(`[Interview] Slot ${index + 1}: Generating ${difficulty} ${topics?.join('+')} question...`);
                try {
                    const generated = await ollama.generateCuratedQuestion(difficulty, topics);
                    if (generated && generated.title) {
                        // Save new question
                        const q = new (await import('../models/Question.js')).Question(generated);
                        await q.save();
                        question = q;
                        console.log(`[Interview] Generated: ${q.title}`);
                    }
                } catch (e) {
                    console.error('[Interview] Generation failed for slot', index, e);
                }
            }

            // 3. Last fallback (Any question)
            if (!question) {
                question = await import('../models/Question.js').then(m => m.Question.findOne());
            }

            if (question) {
                finalQuestions[index] = question; // Maintain order
            }
        }));

        // Filter out any nulls (failed generation + failed fallback)
        const validQuestions = finalQuestions.filter(q => q);

        if (validQuestions.length === 0) {
            return res.status(500).json({ success: false, error: 'Failed to prepare questions.' });
        }

        const session = new InterviewSession({
            userId: req.userId,
            config: {
                duration: duration || 30,
                questionCount: validQuestions.length,
                difficulty: 'mixed', // Since it's per-question
                language: language || 'javascript'
            },
            questions: validQuestions.map((q: any) => {
                const lang = language?.toLowerCase() || 'javascript';
                const template = q.templates?.[lang] || q.templates?.['javascript'] || '// No template';

                return {
                    questionId: q._id,
                    problemName: q.title,
                    difficulty: q.difficulty,
                    description: q.description + `\n\n### Function Signature\n\`\`\`${lang}\n${template}\n\`\`\``,
                    status: 'pending',
                    testCases: q.testCases?.filter((tc: any) => !tc.isHidden).map((tc: any) => ({ input: tc.input, expectedOutput: tc.expectedOutput })) || []
                };
            }),
            status: 'in-progress'
        });

        await session.save();
        res.json({ success: true, data: session });

    } catch (error: any) {
        console.error('Start Interview Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start interview.'
        });
    }
});

// POST /api/interview/submit
// Submit code for a specific question
router.post('/submit', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const { sessionId, questionIndex, code } = req.body;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const question = session.questions[questionIndex];
        if (!question) {
            return res.status(400).json({ success: false, error: 'Invalid question index' });
        }

        // 1. Fetch Real Question & Test Cases
        const dbQuestion = await Question.findById(question.questionId);
        if (!dbQuestion && question.questionId) {
            console.error("Question ID found but doc missing:", question.questionId);
            throw new Error("Linked question data is missing");
        }

        let correctnessScore = 0;
        let testResults: any[] = [];
        let executionFeedback = "Execution failed silently.";
        let passedCount = 0;
        let totalCount = 0;

        // 2. Execute Code against Test Cases (Deterministic Grading)
        if (dbQuestion && dbQuestion.testCases.length > 0) {
            const executor = new ExecutionService();
            const language = session.config.language || 'javascript';
            let errorCount = 0;
            totalCount = dbQuestion.testCases.length;

            for (const [index, tc] of dbQuestion.testCases.entries()) {
                const res = await executor.runTest(language, code, { input: tc.input, expected: tc.expectedOutput });
                testResults.push({
                    index,
                    input: tc.input,
                    expected: tc.expectedOutput,
                    actual: res.actual,
                    passed: res.passed,
                    error: res.error,
                    isHidden: tc.isHidden
                });
                if (res.passed) passedCount++;
                if (res.error) errorCount++;
            }
            correctnessScore = Math.round((passedCount / totalCount) * 100);

            executionFeedback = `Passed ${passedCount}/${totalCount} test cases.`;
            if (errorCount > 0) executionFeedback += ` ${errorCount} runtime error(s) detected.`;
            if (correctnessScore < 100) executionFeedback += " Check your logic against edge cases.";
        } else {
            // Fallback for old sessions or generated questions (Skip execution)
            console.warn("No linked DB question found, skipping deterministic grading.");
            correctnessScore = 0;
        }

        // 3. AI Analysis (Style & Complexity)
        const analysis = await ollama.analyzeCode(question.description, code, session.config.language || 'javascript', correctnessScore);

        // Update Session
        question.userCode = code;
        question.feedback = `### Execution Result\n${executionFeedback}\n\n### AI Feedback\n${analysis.feedback}\n\n**Complexity Analysis:** ${analysis.complexityAnalysis}`;

        // Final Score combines correctness (80%) and AI score (20%)? 
        // Or just Correctness for "Pass/Fail" and AI for "Review"?
        // LeetCode is 100% correctness. Let's strictly use correctness for status.
        question.score = correctnessScore;
        question.status = correctnessScore === 100 ? 'solved' : 'failed';

        // Save sub-doc change
        session.markModified('questions');
        await session.save();

        const clientResults = testResults.map((result) => {
            if (result.isHidden) {
                return {
                    index: result.index,
                    passed: result.passed,
                    error: result.error,
                    isHidden: true
                };
            }
            return {
                index: result.index,
                input: result.input,
                expected: result.expected,
                actual: result.actual,
                passed: result.passed,
                error: result.error,
                isHidden: false
            };
        });

        res.json({
            success: true,
            data: {
                status: question.status === 'solved' ? 'pass' : 'fail',
                score: correctnessScore,
                feedback: question.feedback,
                summary: totalCount > 0 ? { passed: passedCount, total: totalCount } : undefined,
                testResults: clientResults
            }
        });
    } catch (error: any) {
        console.error('Submit Code Error:', error);
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
                res.end(); // Close connection
            }

        } else {
            // Non-streaming fallback
            const response = await ollama.generateResponse(systemPrompt);
            res.json({ success: true, data: { reply: response } });
        }

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'AI failed to respond.' });
        }
    }
});

// POST /api/interview/run
// Dry run code against test cases (no grading, no DB save)
router.post('/run', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const { sessionId, questionIndex, code, customInput } = req.body;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

        const question = session.questions[questionIndex];
        if (!question.questionId) {
            return res.json({
                success: true,
                output: "Running legacy AI questions is disabled. Please start a new session.",
                status: "success"
            });
        }

        const dbQuestion = await Question.findById(question.questionId);
        if (!dbQuestion) return res.status(404).json({ success: false, error: 'Question data missing' });

        const executor = new ExecutionService();
        const language = session.config.language || 'javascript';

        if (customInput !== undefined && customInput !== null) {
            const rawInput = String(customInput);
            const runResult = await executor.executeWithInput(language, code, rawInput);
            const status = runResult.error ? 'error' : 'success';

            return res.json({
                success: true,
                data: {
                    status,
                    summary: { passed: runResult.error ? 0 : 1, total: 1 },
                    testResults: [
                        {
                            index: 0,
                            input: rawInput,
                            actual: runResult.actual,
                            passed: !runResult.error,
                            error: runResult.error,
                            isCustom: true
                        }
                    ]
                }
            });
        }

        // Run against visible test cases ONLY for "Run" button
        const publicCases = dbQuestion.testCases.filter(tc => !tc.isHidden);

        if (publicCases.length === 0) {
            return res.json({
                success: true,
                data: {
                    status: 'success',
                    summary: { passed: 0, total: 0 },
                    testResults: []
                }
            });
        }

        let passedCount = 0;
        let errorCount = 0;
        const testResults = [];

        for (const [index, tc] of publicCases.entries()) {
            const result = await executor.runTest(language, code, { input: tc.input, expected: tc.expectedOutput });
            if (result.passed) passedCount++;
            if (result.error) errorCount++;
            testResults.push({
                index,
                input: tc.input,
                expected: tc.expectedOutput,
                actual: result.actual,
                passed: result.passed,
                error: result.error,
                isHidden: false
            });
        }

        const status = errorCount > 0 ? 'error' : passedCount === publicCases.length ? 'success' : 'fail';

        res.json({
            success: true,
            data: {
                status,
                summary: { passed: passedCount, total: publicCases.length },
                testResults
            }
        });

    } catch (error: any) {
        console.error('Run Code Error:', error);
        res.status(500).json({ success: false, error: 'Execution failed' });
    }
});

// POST /api/interview/end
// Finish user interview
router.post('/end', authenticate, writeLimiter, async (req: any, res) => {
    try {
        const { sessionId } = req.body;

        const session = await InterviewSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        session.status = 'completed';
        session.endedAt = new Date();

        // Calculate Total Score
        const totalScore = session.questions.reduce((acc, q) => acc + (q.score || 0), 0) / session.questions.length;
        session.totalScore = Math.round(totalScore);

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

        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error fetching session' });
    }
});

export default router;
