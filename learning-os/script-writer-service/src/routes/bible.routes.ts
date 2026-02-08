import express from 'express';
import { Bible } from '../models/Bible';
import { exportService } from '../services/export.service';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.use(authenticate);

async function assertBibleAccess(id: string, userId?: string) {
    const bible = await Bible.findOne({ _id: id, userId });
    if (!bible) {
        throw new Error('ACCESS_DENIED');
    }
    return bible;
}

// GET /api/bible - List all projects for a user
router.get('/', async (req, res) => {
    const userId = req.userId;

    try {
        const bibles = await Bible.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: bibles });
    } catch (error) {
        const msg = (error as Error).message;
        const stack = (error as Error).stack;
        // Log to file for debugging since we can't see console
        try {
            fs.appendFileSync('error_log.txt', `[${new Date().toISOString()}] List Error: ${msg}\nStack: ${stack}\nUser: ${userId}\n\n`);
        } catch (e) {
            console.error('Failed to write to log file', e);
        }

        console.error('[BibleAPI] List Error:', error);
        res.status(500).json({
            error: 'Failed to fetch projects',
            details: msg,
            stack: process.env.NODE_ENV === 'development' ? stack : undefined
        });
    }
});

// POST /api/bible - Create a new project
router.post('/', async (req, res) => {
    const { title, logline, genre, tone, language } = req.body;

    if (!req.userId || !title) {
        return res.status(400).json({ error: 'User ID and Title are required' });
    }

    try {
        const newBible = await Bible.create({
            userId: req.userId,
            title,
            logline: logline || '',
            genre: genre || 'Drama',
            tone: tone || 'Serious',
            language: language || 'English',
            rules: []
        });

        res.json({ success: true, data: newBible });
    } catch (error) {
        console.error('[BibleAPI] Create Error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// GET /api/bible/:id - Get project details
router.get('/:id', async (req, res) => {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        res.json({ success: true, data: bible });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// GET /api/bible/:id/export - Export full script
router.get('/:id/export', async (req, res) => {
    try {
        await assertBibleAccess(req.params.id, req.userId);
        const format = (req.query.format as 'fountain' | 'txt' | 'json') || 'fountain';
        const content = await exportService.compileProject(req.params.id, format);

        if (format === 'json') {
            res.header('Content-Type', 'application/json');
            res.send(content);
        } else {
            res.header('Content-Type', 'text/plain');
            res.header('Content-Disposition', `attachment; filename="script.${format}"`);
            res.send(content);
        }
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied' });
        }
        console.error('[BibleAPI] Export Error:', error);
        res.status(500).json({ error: 'Failed to export project' });
    }
});

// PUT /api/bible/:id - Update project
router.put('/:id', async (req, res) => {
    try {
        await assertBibleAccess(req.params.id, req.userId);
        const updatedBible = await Bible.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: req.body },
            { new: true }
        );
        if (!updatedBible) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ success: true, data: updatedBible });
    } catch (error) {
        console.error('[BibleAPI] Update Error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE /api/bible/:id - Delete project and all its scenes
router.delete('/:id', async (req, res) => {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);

        // Import Scene model dynamically to avoid circular dependencies
        const { Scene } = await import('../models/Scene.js');

        // Delete all scenes associated with this project
        await Scene.deleteMany({ bibleId: req.params.id });

        // Delete the project itself
        await Bible.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Project and all scenes deleted' });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied' });
        }
        console.error('[BibleAPI] Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

export const bibleRoutes = router;
