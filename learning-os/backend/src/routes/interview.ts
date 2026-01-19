import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { OllamaService } from '../services/ollama.service.js';
import { DSAProblem } from '../models/DSAProblem.js';

const router = express.Router();
const ollama = new OllamaService();

// POST /api/interview/start
// Start a new interview session
router.post('/start', authenticate, async (req: any, res) => {
    try {
        const { duration, questionCount, difficulty, topics } = req.body;

        // 1. Try to fetch real problems from DB first (if they suffice)
        // OR Use Ollama to generate fresh questions
        // For Simulator, we'll use Ollama to ensure we have descriptions/test cases context

        console.log(`Starting interview for ${req.userId}: ${difficulty}, ${questionCount} questions`);

        let questions = await ollama.generateQuestions(questionCount || 1, difficulty || 'medium', topics || [], req.body.language || 'javascript');

        if (!Array.isArray(questions) || questions.length === 0) {
            console.error('[Interview Start] Failed to generate valid questions from Ollama');
            return res.status(500).json({
                success: false,
                error: 'Failed to generate interview questions. AI service might be miscalibrated or unavailable.'
            });
        }

        const session = new InterviewSession({
            userId: req.userId,
            config: {
                duration: duration || 30, // minutes
                questionCount: questions.length,
                difficulty: difficulty || 'medium',
            },
            questions: questions.map((q: any) => ({
                problemName: q.title || 'Untitled Problem',
                description: (q.description || 'No description provided.') + `\n\n### Function Signature\n\`\`\`javascript\n${q.signature || '// Code here'}\n\`\`\``,
                status: 'pending'
            })),
            status: 'in-progress'
        });

        await session.save();

        res.json({ success: true, data: session });
    } catch (error: any) {
        console.error('Start Interview Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start interview. Is Ollama running?'
        });
    }
});

// POST /api/interview/submit
// Submit code for a specific question
router.post('/submit', authenticate, async (req: any, res) => {
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

        // Evaluate Code via Ollama
        const evaluation = await ollama.evaluateCode(question.description, code, session.config.language || 'javascript');

        // Update Session
        question.userCode = code;
        question.feedback = evaluation.feedback;
        question.score = evaluation.score;
        question.status = evaluation.status === 'pass' ? 'solved' : 'failed';

        // Save sub-doc change
        session.markModified('questions');
        await session.save();

        res.json({ success: true, data: evaluation });
    } catch (error: any) {
        console.error('Submit Code Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Evaluation failed'
        });
    }
});

// POST /api/interview/end
// Finish user interview
router.post('/end', authenticate, async (req: any, res) => {
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
