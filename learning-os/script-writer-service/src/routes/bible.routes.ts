import express from 'express';
import { Bible } from '../models/Bible';
import { exportService } from '../services/export.service';
import { scriptGenerator } from '../services/scriptGenerator.service';
import { vectorService } from '../services/vector.service';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs';

const router = express.Router();

router.use(authenticate);

type AssistantPreferencesInput = {
    defaultMode?: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives?: string[];
};

function normalizeAssistantPreferences(
    raw: unknown,
    existing?: AssistantPreferencesInput | null
): AssistantPreferencesInput | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }

    const input = raw as Record<string, unknown>;
    const defaultMode = typeof input.defaultMode === 'string' ? input.defaultMode : existing?.defaultMode;
    if (defaultMode && !['ask', 'edit', 'agent'].includes(defaultMode)) {
        throw new Error('INVALID_ASSISTANT_DEFAULT_MODE');
    }

    const replyLanguage = typeof input.replyLanguage === 'string'
        ? input.replyLanguage.trim()
        : existing?.replyLanguage;
    const transliteration = typeof input.transliteration === 'boolean'
        ? input.transliteration
        : existing?.transliteration;

    const savedDirectives = input.savedDirectives !== undefined
        ? input.savedDirectives
        : existing?.savedDirectives;

    if (savedDirectives !== undefined && !Array.isArray(savedDirectives)) {
        throw new Error('INVALID_ASSISTANT_DIRECTIVES');
    }

    const normalizedDirectives = (savedDirectives || [])
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);

    return {
        defaultMode: (defaultMode as 'ask' | 'edit' | 'agent') || 'ask',
        replyLanguage: replyLanguage || undefined,
        transliteration,
        savedDirectives: normalizedDirectives
    };
}

function formatAssistantContext(raw: unknown): string | undefined {
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        return trimmed || undefined;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }

    const context = raw as Record<string, any>;
    const sections: string[] = [];

    if (context.project && typeof context.project === 'object') {
        const projectLines = [
            'PROJECT SUMMARY',
            typeof context.project.title === 'string' ? `Title: ${context.project.title}` : '',
            typeof context.project.logline === 'string' ? `Logline: ${context.project.logline}` : '',
            typeof context.project.genre === 'string' ? `Genre: ${context.project.genre}` : '',
            typeof context.project.tone === 'string' ? `Tone: ${context.project.tone}` : '',
            typeof context.project.language === 'string' ? `Language: ${context.project.language}` : ''
        ].filter(Boolean);

        if (projectLines.length > 1) {
            sections.push(projectLines.join('\n'));
        }
    }

    if (context.scene && typeof context.scene === 'object') {
        const sceneLines = [
            'ACTIVE SCENE',
            typeof context.scene.id === 'string' ? `Scene ID: ${context.scene.id}` : '',
            typeof context.scene.name === 'string' ? `Scene: ${context.scene.name}` : ''
        ].filter(Boolean);

        if (sceneLines.length > 1) {
            sections.push(sceneLines.join('\n'));
        }
    }

    if (context.script && typeof context.script === 'object' && typeof context.script.excerpt === 'string' && context.script.excerpt.trim()) {
        sections.push(`OPEN SCENE SCRIPT\n${context.script.excerpt.trim().slice(0, 12000)}`);
    }

    if (context.selection && typeof context.selection === 'object' && typeof context.selection.text === 'string' && context.selection.text.trim()) {
        const selectionLines = [
            'ACTIVE SELECTION',
            typeof context.selection.lineStart === 'number' && typeof context.selection.lineEnd === 'number'
                ? `Lines: ${context.selection.lineStart}-${context.selection.lineEnd}`
                : '',
            typeof context.selection.charCount === 'number' ? `Characters: ${context.selection.charCount}` : '',
            context.selection.text.trim()
        ].filter(Boolean);
        sections.push(selectionLines.join('\n'));
    }

    if (context.reply && typeof context.reply === 'object') {
        const replyLines = [
            'REPLY PREFERENCES',
            typeof context.reply.language === 'string' ? `Reply Language: ${context.reply.language}` : '',
            typeof context.reply.transliteration === 'boolean'
                ? `Transliteration: ${context.reply.transliteration ? 'enabled' : 'disabled'}`
                : ''
        ].filter(Boolean);

        if (replyLines.length > 1) {
            sections.push(replyLines.join('\n'));
        }
    }

    if (context.assistantPreferences && typeof context.assistantPreferences === 'object') {
        const directives = Array.isArray(context.assistantPreferences.savedDirectives)
            ? context.assistantPreferences.savedDirectives.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];
        const preferenceLines = [
            'SAVED ASSISTANT PREFERENCES',
            typeof context.assistantPreferences.defaultMode === 'string' ? `Default Mode: ${context.assistantPreferences.defaultMode}` : '',
            typeof context.assistantPreferences.replyLanguage === 'string' ? `Preferred Reply Language: ${context.assistantPreferences.replyLanguage}` : '',
            typeof context.assistantPreferences.transliteration === 'boolean'
                ? `Preferred Transliteration: ${context.assistantPreferences.transliteration ? 'enabled' : 'disabled'}`
                : '',
            directives.length > 0 ? `Directives:\n- ${directives.slice(0, 8).join('\n- ')}` : ''
        ].filter(Boolean);

        if (preferenceLines.length > 1) {
            sections.push(preferenceLines.join('\n'));
        }
    }

    return sections.length > 0 ? sections.join('\n\n') : undefined;
}

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

        // Log to file for debugging (server-side only)
        try {
            fs.appendFileSync('error_log.txt', `[${new Date().toISOString()}] List Error: ${msg}\nStack: ${stack}\nUser: ${userId}\n\n`);
        } catch (e) {
            console.error('Failed to write to log file', e);
        }

        console.error('[BibleAPI] List Error:', error);

        // Security: Never expose stack traces or internal error details to clients
        res.status(500).json({
            error: 'Failed to fetch projects',
            requestId: Date.now().toString(36) // For support reference without exposing internals
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
        const rawAssistantPreferences = req.body.assistantPreferences;
        const assistantPreferences = rawAssistantPreferences === undefined
            ? {
                defaultMode: 'ask' as const,
                savedDirectives: [] as string[]
            }
            : normalizeAssistantPreferences(rawAssistantPreferences);

        if (!assistantPreferences) {
            return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
        }

        const newBible = await Bible.create({
            userId: req.userId,
            title,
            logline: logline || '',
            genre: genre || 'Drama',
            tone: tone || 'Serious',
            language: language || 'English',
            rules: [],
            assistantPreferences
        });

        res.json({ success: true, data: newBible });
    } catch (error) {
        if ((error as Error).message === 'INVALID_ASSISTANT_DEFAULT_MODE' || (error as Error).message === 'INVALID_ASSISTANT_DIRECTIVES') {
            return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
        }
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

// POST /api/bible/:id/assistant - Project-scoped assistant for Ask mode without an active scene
router.post('/:id/assistant', async (req, res) => {
    const { instruction, language, target, currentContext } = req.body;
    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
        return res.status(400).json({ error: 'Instruction is required' });
    }

    try {
        await assertBibleAccess(req.params.id, req.userId);

        const normalizedTarget = target === 'selection' ? 'selection' : 'scene';
        const rawSelection = req.body.selection;
        const selection = rawSelection && typeof rawSelection.text === 'string' && rawSelection.text.trim()
            ? {
                text: rawSelection.text,
                start: typeof rawSelection.start === 'number' ? rawSelection.start : undefined,
                end: typeof rawSelection.end === 'number' ? rawSelection.end : undefined,
                lineStart: typeof rawSelection.lineStart === 'number' ? rawSelection.lineStart : undefined,
                lineEnd: typeof rawSelection.lineEnd === 'number' ? rawSelection.lineEnd : undefined,
                lineCount: typeof rawSelection.lineCount === 'number' ? rawSelection.lineCount : undefined,
                charCount: typeof rawSelection.charCount === 'number' ? rawSelection.charCount : undefined,
                preview: typeof rawSelection.preview === 'string' ? rawSelection.preview : undefined
            }
            : null;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const stream = scriptGenerator.assistProject(req.params.id, instruction, {
            language,
            mode: 'ask',
            target: normalizedTarget,
            currentContent: formatAssistantContext(currentContext),
            selection
        });

        for await (const chunk of stream) {
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied' });
        }
        console.error('[BibleAPI] Assistant Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Assistant request failed' });
        } else {
            res.end();
        }
    }
});

// GET /api/bible/:id/export - Export full script
router.get('/:id/export', async (req, res) => {
    try {
        await assertBibleAccess(req.params.id, req.userId);
        const format = (req.query.format as 'fountain' | 'txt' | 'json' | 'pdf') || 'fountain';

        if (format === 'pdf') {
            const pdfBuffer = await exportService.generatePDF(req.params.id);
            res.header('Content-Type', 'application/pdf');
            res.header('Content-Disposition', `attachment; filename="script.pdf"`);
            res.send(pdfBuffer);
            return;
        }

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
        const bible = await assertBibleAccess(req.params.id, req.userId);

        // Whitelist allowed fields to prevent mass assignment
        const allowedFields = ['title', 'logline', 'genre', 'tone', 'language', 'visualStyle', 'rules', 'assistantPreferences'];
        const updateData: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Validate title is not empty
        if (updateData.title === '') {
            return res.status(400).json({ error: 'Title cannot be empty' });
        }

        // Validate genre against allowed values
        const validGenres = ['Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Action', 'Romance', 'Documentary'];
        if (updateData.genre && !validGenres.includes(updateData.genre as string)) {
            return res.status(400).json({ error: `Invalid genre. Allowed: ${validGenres.join(', ')}` });
        }

        // Validate rules is an array
        if (updateData.rules && !Array.isArray(updateData.rules)) {
            return res.status(400).json({ error: 'Rules must be an array' });
        }

        if (req.body.assistantPreferences !== undefined) {
            try {
                const normalizedPreferences = normalizeAssistantPreferences(
                    req.body.assistantPreferences,
                    bible.assistantPreferences as AssistantPreferencesInput | undefined
                );

                if (!normalizedPreferences) {
                    return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
                }

                updateData.assistantPreferences = normalizedPreferences;
            } catch (error) {
                const message = (error as Error).message;
                if (message === 'INVALID_ASSISTANT_DEFAULT_MODE' || message === 'INVALID_ASSISTANT_DIRECTIVES') {
                    return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
                }
                throw error;
            }
        }

        const updatedBible = await Bible.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: updateData },
            { new: true, runValidators: true }
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

// DELETE /api/bible/:id - Delete project and all linked data
router.delete('/:id', async (req, res) => {
    try {
        const bibleId = req.params.id;
        await assertBibleAccess(bibleId, req.userId);

        // Import models dynamically to avoid potential circular dependencies.
        const [{ Scene }, { Character }, { Treatment }, { VoiceSample }] = await Promise.all([
            import('../models/Scene.js'),
            import('../models/Character.js'),
            import('../models/Treatment.js'),
            import('../models/VoiceSample.js')
        ]);

        // Remove vectors first so semantic retrieval cannot return stale project data.
        await vectorService.deleteSamplesByBibleId(bibleId);

        const [sceneResult, characterResult, treatmentResult, voiceResult] = await Promise.all([
            Scene.deleteMany({ bibleId }),
            Character.deleteMany({ bibleId }),
            Treatment.deleteMany({ bibleId }),
            VoiceSample.deleteMany({ bibleId })
        ]);

        await Bible.findByIdAndDelete(bibleId);

        res.json({
            success: true,
            data: {
                message: 'Project and all related data deleted',
                deleted: {
                    scenes: sceneResult.deletedCount || 0,
                    characters: characterResult.deletedCount || 0,
                    treatments: treatmentResult.deletedCount || 0,
                    voiceSamples: voiceResult.deletedCount || 0
                }
            }
        });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied' });
        }
        console.error('[BibleAPI] Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

export const bibleRoutes = router;
