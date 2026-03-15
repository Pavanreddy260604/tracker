import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { BackendTopic } from '../models/BackendTopic.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { knowledgeSync } from '../services/knowledgeSync.service.js';
import { aiMentorService } from '../services/aiMentor.service.js';

const router = Router();
router.use(authenticate);

const backendTopicSchema = z.object({
    topicName: z.string().min(1).max(200),
    category: z.enum(['node', 'express', 'database', 'auth', 'api', 'system-design', 'devops', 'security', 'testing', 'performance', 'other']),
    type: z.enum(['theory', 'feature', 'bug-fix', 'refactor', 'optimization']).default('theory'),
    status: z.enum(['completed', 'in_progress', 'planned']).default('completed'),
    filesModified: z.string().default(''),
    bugsFaced: z.string().max(2000).default(''),
    notes: z.string().max(5000).default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Backend Topics 2.0 & SRS
    subTopics: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCompleted: z.boolean(),
    })).optional(),
    resources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        type: z.enum(['video', 'article', 'docs', 'course']),
    })).optional(),
    nextReviewDate: z.string().optional(),
    reviewStage: z.number().optional(),
});

router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const requestedLimit = parseInt(req.query.limit as string) || 20;
        const limit = Math.min(Math.max(1, requestedLimit), 100); // Cap at 100 max
        const category = req.query.category as string;

        const filter: Record<string, unknown> = { userId: req.userId };
        if (category) filter.category = category;

        const [topics, total] = await Promise.all([
            BackendTopic.find(filter)
                .sort({ date: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            BackendTopic.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: { topics, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
        });
    } catch (error) {
        console.error('Get topics error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch topics' });
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const topic = await BackendTopic.findOne({ _id: req.params.id, userId: req.userId });
        if (!topic) {
            res.status(404).json({ success: false, error: 'Topic not found' });
            return;
        }
        res.json({ success: true, data: { topic } });
    } catch (error) {
        console.error('Get topic error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch topic' });
    }
});

router.post('/', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = backendTopicSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const topic = await BackendTopic.create({ ...result.data, userId: req.userId });

        // Asynchronously sync the new topic to ChromaDB for Universal RAG Search
        knowledgeSync.syncBackendTopic(topic).catch(err => console.error('[BackendTopic] RAG Sync Error:', err));

        res.status(201).json({ success: true, data: { topic } });
    } catch (error) {
        console.error('Create topic error:', error);
        res.status(500).json({ success: false, error: 'Failed to create topic' });
    }
});

router.put('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = backendTopicSchema.partial().safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const topic = await BackendTopic.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: result.data },
            { new: true, runValidators: true }
        );

        if (!topic) {
            res.status(404).json({ success: false, error: 'Topic not found' });
            return;
        }

        // Asynchronously sync the updated topic to ChromaDB
        knowledgeSync.syncBackendTopic(topic).catch(err => console.error('[BackendTopic] RAG Sync Error:', err));

        res.json({ success: true, data: { topic } });
    } catch (error) {
        console.error('Update topic error:', error);
        res.status(500).json({ success: false, error: 'Failed to update topic' });
    }
});

router.delete('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const topic = await BackendTopic.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!topic) {
            res.status(404).json({ success: false, error: 'Topic not found' });
            return;
        }

        // Asynchronously delete the topic from ChromaDB
        knowledgeSync.deleteFromVector(req.params.id as string).catch(err => console.error('[BackendTopic] RAG Delete Error:', err));

        res.json({ success: true, data: { message: 'Topic deleted' } });
    } catch (error) {
        console.error('Delete topic error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete topic' });
    }
});

router.post('/:id/audit', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const audit = await aiMentorService.auditTopic(id);
        res.json({ success: true, data: audit });
    } catch (error: any) {
        console.error('Audit error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to perform audit' });
    }
});

export default router;
