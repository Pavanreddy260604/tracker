import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { activityService } from '../services/activity.service.js';
import { knowledgeSync } from '../services/knowledgeSync.service.js';
import {
    createDSAProblem,
    deleteDSAProblemById,
    getDSAProblemById,
    listDSAProblems,
    normalizeDSAProblemPayload,
    serializeDSAProblem,
    updateDSAProblemById,
} from '../services/dsa.service.js';

const router = Router();
router.use(authenticate);

// Validation schema
const dsaProblemSchema = z.object({
    problemName: z.string().min(1).max(200),
    platform: z.enum(['leetcode', 'gfg', 'codeforces', 'codechef', 'hackerrank', 'neetcode', 'other']).default('leetcode'),
    topic: z.string().min(1).max(100),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    timeSpent: z.number().min(0).max(1440).default(0),
    status: z.enum(['solved', 'revisit', 'attempted']).default('solved'),
    patternLearned: z.string().max(500).default(''),
    mistakes: z.string().max(1000).default(''),
    solutionLink: z.string().max(500).default(''),
    notes: z.string().max(5000).default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // DSA 2.0 Fields
    nextReviewDate: z.string().optional(), // ISODate string
    reviewStage: z.number().optional(),
    reviewInterval: z.number().optional(),
    easeFactor: z.number().optional(),
    solutionCode: z.string().optional(),
    timeComplexity: z.string().max(50).optional(),
    spaceComplexity: z.string().max(50).optional(),
    companyTags: z.array(z.string()).optional(),
    confidenceLevel: z.number().min(1).max(5).optional(),
    simpleExplanation: z.string().max(2000).optional(),
});

const dsaProblemUpdateSchema = dsaProblemSchema
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required.',
    });

const listProblemsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    topic: z.string().trim().min(1).max(100).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

/**
 * GET /api/dsa-problems
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const parsedQuery = listProblemsQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            res.status(400).json({ success: false, error: parsedQuery.error.errors[0].message });
            return;
        }

        const { page, limit, topic, difficulty } = parsedQuery.data;
        const result = await listDSAProblems(req.userId!, {
            page,
            limit,
            topic,
            difficulty,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Get problems error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch problems' });
    }
});

/**
 * POST /api/dsa-problems
 */
router.post('/', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = dsaProblemSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const problem = await createDSAProblem(req.userId!, normalizeDSAProblemPayload(result.data));

        // Record activity for streak
        activityService.recordActivity(req.userId!, 'dsa').catch(err => console.error(err));

        // Sync to RAG
        if (problem) {
            knowledgeSync.syncDSAProblem(problem).catch(err => console.error('[DSA] RAG Sync Error:', err));
        }

        res.status(201).json({ success: true, data: { problem: serializeDSAProblem(problem.toObject()) } });
    } catch (error) {
        console.error('Create problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to create problem' });
    }
});

/**
 * GET /api/dsa-problems/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const problemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const problem = await getDSAProblemById(req.userId!, problemId);

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        res.json({ success: true, data: { problem } });
    } catch (error) {
        console.error('Get problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch problem' });
    }
});

/**
 * PUT /api/dsa-problems/:id
 */
router.put('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = dsaProblemUpdateSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const problemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const problem = await updateDSAProblemById(req.userId!, problemId, normalizeDSAProblemPayload(result.data));

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        // Record activity for streak
        activityService.recordActivity(req.userId!, 'dsa').catch(err => console.error(err));

        // Sync to RAG
        knowledgeSync.syncDSAProblem(problem).catch(err => console.error('[DSA] RAG Sync Error:', err));

        res.json({ success: true, data: { problem: problem ? serializeDSAProblem(problem.toObject()) : problem } });
    } catch (error) {
        console.error('Update problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to update problem' });
    }
});

/**
 * DELETE /api/dsa-problems/:id
 */
router.delete('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const problemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const problem = await deleteDSAProblemById(req.userId!, problemId);

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        // Delete from RAG Vector Store
        knowledgeSync.deleteFromVector(problemId as string).catch(err => console.error('[DSA] RAG Delete Error:', err));

        res.json({ success: true, data: { message: 'Problem deleted' } });
    } catch (error) {
        console.error('Delete problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete problem' });
    }
});

export default router;
