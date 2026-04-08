import express from 'express';
import mongoose from 'mongoose';
import { Scene } from '../models/Scene';
import { Bible } from '../models/Bible'; // Import Bible model
import { scriptGenerator } from '../services/scriptGenerator.service';
import { criticService } from '../services/critic.service'; // Import Critic Service
import { FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}

async function assertSceneAccess(sceneId: string, userId?: string) {
    const scene = await Scene.findById(sceneId);
    if (!scene) return null;
    await assertBibleAccess(scene.bibleId.toString(), userId);
    return scene;
}

function handleAccessError(error: any, res: express.Response) {
    if ((error as Error).message === 'ACCESS_DENIED') {
        res.status(403).json({ error: 'Access denied' });
        return true;
    }
    return false;
}

function isSequenceConflict(error: any): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as any;
    if (e.code !== 11000) return false;
    const keyPattern = e.keyPattern || {};
    if (keyPattern.bibleId && keyPattern.sequenceNumber) return true;
    const message = String(e.message || '');
    return message.includes('bibleId_1_sequenceNumber_1');
}

// GET /api/scene/bible/:bibleId - List all scenes for a project
router.get('/bible/:bibleId', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const scenes = await Scene.find({ bibleId: req.params.bibleId })
            .sort({ sequenceNumber: 1 });
        res.json({ success: true, data: scenes });
    } catch (error) {
        console.error('[SceneAPI] List Error:', error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to fetch scenes' });
        }
    }
});

// POST /api/scene - Create a new scene
router.post('/', async (req, res) => {
    const { bibleId, slugline, summary, sequenceNumber } = req.body;

    // Input validation
    if (!bibleId || typeof bibleId !== 'string') {
        return res.status(400).json({ error: 'Bible ID is required and must be a string' });
    }

    if (!slugline || typeof slugline !== 'string' || slugline.trim().length === 0) {
        return res.status(400).json({ error: 'Slugline is required and cannot be empty' });
    }

    // Validate slugline format (should look like a scene header)
    const sluglinePattern = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+$/i;
    if (!sluglinePattern.test(slugline.trim())) {
        return res.status(400).json({
            error: 'Invalid slugline format. Expected format: "INT. LOCATION - TIME" or "EXT. LOCATION - TIME"'
        });
    }

    // Validate sequenceNumber if provided
    if (sequenceNumber !== undefined && (!Number.isInteger(sequenceNumber) || sequenceNumber < 1)) {
        return res.status(400).json({ error: 'Sequence number must be a positive integer' });
    }

    // Limit summary length
    const MAX_SUMMARY_LENGTH = 2000;
    if (summary && typeof summary === 'string' && summary.length > MAX_SUMMARY_LENGTH) {
        return res.status(400).json({ error: `Summary must be less than ${MAX_SUMMARY_LENGTH} characters` });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        const createScene = async (seq: number) => {
            return Scene.create({
                bibleId,
                sequenceNumber: seq,
                slugline: slugline.trim(),
                summary: summary?.trim() || '',
                status: 'planned',
                content: ''
            });
        };

        // Explicit sequence number: fail fast with conflict if already taken.
        if (sequenceNumber !== undefined) {
            try {
                const newScene = await createScene(sequenceNumber);
                return res.json({ success: true, data: newScene });
            } catch (error) {
                if (isSequenceConflict(error)) {
                    return res.status(409).json({ error: `Sequence number ${sequenceNumber} already exists for this project` });
                }
                throw error;
            }
        }

        // Auto sequence allocation with retry for concurrent writers.
        const MAX_SEQUENCE_RETRIES = 5;
        for (let attempt = 1; attempt <= MAX_SEQUENCE_RETRIES; attempt++) {
            const lastScene = await Scene.findOne({ bibleId })
                .sort({ sequenceNumber: -1 })
                .select('sequenceNumber')
                .lean();
            const nextSequence = (lastScene?.sequenceNumber || 0) + 1;

            try {
                const newScene = await createScene(nextSequence);
                return res.json({ success: true, data: newScene });
            } catch (error) {
                if (isSequenceConflict(error) && attempt < MAX_SEQUENCE_RETRIES) {
                    continue;
                }
                if (isSequenceConflict(error)) {
                    return res.status(409).json({ error: 'Could not allocate a unique scene sequence. Please retry.' });
                }
                throw error;
            }
        }

        return res.status(409).json({ error: 'Could not allocate a unique scene sequence. Please retry.' });
    } catch (error) {
        console.error('[SceneAPI] Create Error:', error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to create scene' });
        }
    }
});

// PUT /api/scene/:id - Update scene
router.put('/:id', async (req, res) => {
    try {
        await assertSceneAccess(req.params.id, req.userId);

        // Whitelist allowed fields to prevent mass assignment
        const allowedFields = ['slugline', 'summary', 'goal', 'content', 'status',
            'feedback', 'charactersInvolved', 'mentionedItems'];
        const updateData: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Validate status enum
        if (updateData.status && !['planned', 'drafted', 'reviewed', 'final'].includes(updateData.status as string)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Validate required fields aren't being cleared
        if (updateData.slugline === '' || updateData.summary === '') {
            return res.status(400).json({ error: 'slugline and summary cannot be empty' });
        }

        const updatedScene = await Scene.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        res.json({ success: true, data: updatedScene });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to update scene' });
        }
    }
});

// DELETE /api/scene/:id - Delete a scene
router.delete('/:id', async (req, res) => {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) {
            return res.status(404).json({ error: 'Scene not found' });
        }

        const deletedScene = await Scene.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Scene deleted', data: deletedScene });
    } catch (error) {
        console.error('[SceneAPI] Delete Error:', error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to delete scene' });
        }
    }
});

// POST /api/scene/:id/generate - Generate content for a scene
router.post('/:id/generate', async (req, res) => {
    const { style, format, characterIds, sceneLength, language } = req.body;

    try {
        const scene = await Scene.findById(req.params.id).populate('bibleId');
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId._id.toString(), req.userId);

        // Validate style parameter
        const validStyles = ['classic', 'tarantino', 'nolan', 'sorkin', 'wes_anderson', 'fincher'];
        const validatedStyle = validStyles.includes(style) ? style : 'classic';

        // Validate format parameter
        const validFormats = ['film', 'tv', 'short'];
        const validatedFormat = validFormats.includes(format) ? format : 'film';

        // Validate sceneLength parameter
        const validLengths = ['short', 'medium', 'long'];
        const validatedLength = validLengths.includes(sceneLength) ? sceneLength : 'medium';

        // Validate characterIds is an array if provided
        if (characterIds && !Array.isArray(characterIds)) {
            return res.status(400).json({ error: 'characterIds must be an array' });
        }

        let previousContext = '';
        if (scene.sequenceNumber > 1) {
            const prevScene = await Scene.findOne({
                bibleId: scene.bibleId._id,
                sequenceNumber: scene.sequenceNumber - 1
            });

            if (prevScene) {
                const contextContent = prevScene.summary || (prevScene.content ? prevScene.content.slice(0, 500) : 'No previous content');
                previousContext = `In the previous scene (${prevScene.slugline}): ${contextContent}`;
                if (scene.previousSceneSummary !== previousContext) {
                    scene.previousSceneSummary = previousContext;
                    await scene.save();
                }
            }
        }

        const promptIdea = `
            SCENE HEADER: ${scene.slugline}
            
            ACTION SUMMARY:
            ${scene.summary}
            
            GOAL:
            ${scene.goal || 'Advance the plot.'}
            
            Generate the full dialogue and action for ONLY this scene.
            `;

        const request = {
            userId: req.userId || 'anonymous',
            idea: promptIdea,
            format: validatedFormat,
            style: validatedStyle,
            bibleId: scene.bibleId._id.toString(),
            characterIds: characterIds,
            previousContext: previousContext,
            sceneLength: validatedLength,
            language: language || 'English',
            era: req.body.era // Optional Era Context
        };

        let fullContent = '';

        for await (const chunk of scriptGenerator.generateScript(request)) {
            res.write(chunk);
            fullContent += chunk;
        }

        scene.content = fullContent;
        scene.status = 'drafted';
        await scene.save();

        res.end();

    } catch (error) {
        console.error('[SceneAPI] Generate Error:', error);
        if (!handleAccessError(error, res)) {
            if (!res.headersSent) res.status(500).json({ error: 'Generation failed' });
            else res.end();
        }
    }
});

// POST /api/scene/:id/critique - Analyze the scene
router.post('/:id/critique', async (req, res) => {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        const bible = await Bible.findOne({ _id: scene.bibleId });
        const genre = bible?.genre || 'General';
        const language = (bible as any)?.language || 'English';

        const contentToCritique = req.body.content || scene.content;

        if (!contentToCritique) {
            return res.status(400).json({ error: 'Scene has no content to critique' });
        }

        const result = await criticService.evaluateScene(contentToCritique, scene.goal || scene.summary, genre, language);

        scene.critique = result;
        scene.status = 'reviewed';

        const currentBest = scene.highScore?.critique?.score || 0;
        const newScore = result.score || 0;

        if (newScore >= currentBest) {
            scene.highScore = {
                content: contentToCritique,
                critique: result,
                savedAt: new Date()
            };
        }

        await scene.save();

        res.json({
            success: true,
            data: result,
            isNewBest: newScore >= currentBest,
            highScore: scene.highScore?.critique?.score || 0
        });
    } catch (error) {
        console.error('[SceneAPI] Critique Error:', error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Critique failed' });
        }
    }
});

// POST /api/scene/:id/fix - Apply AI fixes based on critique
router.post('/:id/fix', async (req, res) => {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        if (!scene.critique) {
            return res.status(400).json({ error: 'Scene must be analyzed before applying fixes' });
        }

        const originalContent = scene.content;
        if (!originalContent) {
            return res.status(400).json({ error: 'Scene has no content to fix' });
        }

        console.log(`[SceneAPI] Quality Guard Starting: ${scene.slugline}`);
        const startTime = Date.now();

        const currentBestScore = scene.highScore?.critique?.score || scene.critique?.score || 0;
        const bible = await mongoose.model('Bible').findById(scene.bibleId).lean();
        const genre = (bible as any)?.genre || 'General';

        const language = (bible as any)?.language || 'English';

        let bestAttempt: { content: string, critique: any } | null = null;

        try {
            // --- ATTEMPT 1 ---
            console.log(`[SceneAPI] Audit Chain: Attempt 1 (${language})...`);
            const t1 = Date.now();
            const attempt1Content = await scriptGenerator.reviseSceneBatch(originalContent, scene.critique, scene.goal || scene.summary, false, currentBestScore, language, scene.bibleId, scene._id);
            const attempt1Critique = await criticService.evaluateScene(attempt1Content, scene.goal || scene.summary, genre, language);
            console.log(`[SceneAPI] Attempt 1 complete in ${Date.now() - t1}ms. Score: ${attempt1Critique.score}`);

            bestAttempt = { content: attempt1Content, critique: attempt1Critique };

            // If Attempt 1 already beats the quality record, we are done
            // If it matches or is lower, we try once more to break the plateau (unless it's already elite)
            if (attempt1Critique.score <= currentBestScore && currentBestScore < 95) {
                console.log(`[SceneAPI] Attempt 1 (${attempt1Critique.score}) stagnant or below benchmark (${currentBestScore}). Triggering Self-Correction...`);

                // --- ATTEMPT 2 (SELF-CORRECTION) ---
                const t2 = Date.now();
                // Pass targetScore and language to make prompt more aggressive and localized
                const attempt2Content = await scriptGenerator.reviseSceneBatch(originalContent, attempt1Critique, scene.goal || scene.summary, true, currentBestScore, language, scene.bibleId, scene._id);
                const attempt2Critique = await criticService.evaluateScene(attempt2Content, scene.goal || scene.summary, genre, language);
                console.log(`[SceneAPI] Attempt 2 complete in ${Date.now() - t2}ms. Score: ${attempt2Critique.score}`);

                // ACCEPTANCE LOGIC: If Attempt 2 is better than Attempt 1, we take it.
                // However, we still prioritize the version that BEATS the benchmark.
                if (attempt2Critique.score > attempt1Critique.score) {
                    console.log(`[SceneAPI] Quality Improved to ${attempt2Critique.score}`);
                    bestAttempt = { content: attempt2Content, critique: attempt2Critique };
                } else {
                    console.log(`[SceneAPI] Self-correction did not improve score beyond Attempt 1.`);
                }
            } else {
                console.log(`[SceneAPI] Benchmark reached/exceeded on first try.`);
            }

            // Generate Audit Notes for the best version
            const tAudit = Date.now();
            const auditNotes = await scriptGenerator.generateAuditNotes(originalContent, bestAttempt.content);
            console.log(`[SceneAPI] Audit Notes generated in ${Date.now() - tAudit}ms`);

            console.log(`[SceneAPI] Quality Guard Cycle Finished in ${Date.now() - startTime}ms. Final Score: ${bestAttempt.critique.score}`);

            res.json({
                success: true,
                data: {
                    content: bestAttempt.content,
                    critique: bestAttempt.critique,
                    auditNotes: auditNotes,
                    isSuperior: bestAttempt!.critique.score > currentBestScore,
                    benchmarkScore: currentBestScore,
                    latencyMs: Date.now() - startTime
                }
            });

        } catch (chainError) {
            console.error('[SceneAPI] Audit Chain failed midway:', chainError);

            // PRODUCTION FALLBACK: If we have at least one attempt, return it instead of a 500 error
            if (bestAttempt) {
                console.warn('[SceneAPI] Returning partial success fallback results.');
                const auditNotesFallback = "Note: Professional audit was interrupted due to high latency, however a quality revision was still successfully prepared.";
                return res.json({
                    success: true,
                    data: {
                        content: bestAttempt.content,
                        critique: bestAttempt.critique,
                        auditNotes: auditNotesFallback,
                        isSuperior: (bestAttempt as any).critique.score >= currentBestScore,
                        benchmarkScore: currentBestScore,
                        isPartial: true
                    }
                });
            }
            throw chainError;
        }
    } catch (error) {
        console.error('[SceneAPI] Fix Error:', error);
        if (!handleAccessError(error, res)) {
            if (!res.headersSent) res.status(500).json({ error: 'Failed to apply fixes' });
            else res.end();
        }
    }
});

// POST /api/scene/:id/assisted-edit - Stream an AI refactor of the scene
router.post('/:id/assisted-edit', async (req, res) => {
    const { instruction, language, mode, target, currentContent, model, transliteration } = req.body;
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });

    try {
        const scene = await Scene.findById(req.params.id);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId.toString(), req.userId);

        const normalizedMode = mode === 'ask' || mode === 'edit' || mode === 'agent' ? mode : 'edit';
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

        const stream = scriptGenerator.assistedEdit(req.params.id, instruction, {
            language,
            mode: normalizedMode,
            target: normalizedTarget,
            currentContent: typeof currentContent === 'string' ? currentContent : undefined,
            selection,
            model,
            transliteration
        });

        let isClosed = false;
        req.on('close', () => {
            isClosed = true;
        });

        for await (const chunk of stream) {
            if (isClosed) break;
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        console.error('[SceneAssistant] Edit Error:', error);
        if (!handleAccessError(error, res)) {
            if (!res.headersSent) res.status(500).json({ error: 'Edit failed' });
            else res.end();
        }
    }
});

// GET /api/scene/:id/assistant-history - Get chat history for a scene
router.get('/:id/assistant-history', async (req, res) => {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        res.json({ success: true, data: scene.assistantChatHistory || [] });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to fetch history' });
        }
    }
});

// DELETE /api/scene/:id/assistant-history - Clear chat history or delete a specific message
router.delete('/:id/assistant-history', async (req, res) => {
    const { messageId } = req.body;
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        if (messageId) {
            // Delete specific message
            scene.assistantChatHistory = scene.assistantChatHistory?.filter(
                (m: any) => m._id?.toString() !== messageId
            );
        } else {
            // Clear all
            scene.assistantChatHistory = [];
        }

        await scene.save();
        res.json({ success: true, data: scene.assistantChatHistory });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to delete history' });
        }
    }
});

// PUT /api/scene/:id/assistant-history - Update a specific message in history
router.put('/:id/assistant-history', async (req, res) => {
    const { messageId, content } = req.body;
    if (!messageId || !content) return res.status(400).json({ error: 'MessageId and content required' });

    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        const message = scene.assistantChatHistory?.find(
            (m: any) => m._id?.toString() === messageId
        );

        if (!message) return res.status(404).json({ error: 'Message not found' });

        message.content = content;
        await scene.save();

        res.json({ success: true, data: scene.assistantChatHistory });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to update history' });
        }
    }
});

// POST /api/scene/:id/commit-edit - Commit a proposed edit
router.post('/:id/commit-edit', async (req, res) => {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        console.log(`[SceneAssistant] Committing edit for scene ${req.params.id}`);
        const success = await scriptGenerator.commitAssistedEdit(req.params.id);

        const responseData = { success: true, data: { success } };
        console.log(`[SceneAssistant] Sending response for ${req.params.id}:`, JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        console.error(`[SceneAssistant] Error in commit-edit for ${req.params.id}:`, error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ success: false, error: 'Commit failed', data: null });
        }
    }
});

// POST /api/scene/:id/discard-edit - Discard a proposed edit
router.post('/:id/discard-edit', async (req, res) => {
    try {
        console.log(`[SceneAssistant] Discarding edit for scene ${req.params.id}`);
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });

        if (scene.pendingContent) {
            scene.pendingContent = undefined;
            scene.lastInstruction = undefined;
            await scene.save();
        }
        const responseData = { success: true, data: { success: true } };
        console.log(`[SceneAssistant] Sending discard response for ${req.params.id}:`, JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        console.error(`[SceneAssistant] Error in discard-edit for ${req.params.id}:`, error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ success: false, error: 'Discard failed', data: null });
        }
    }
});

export const sceneRoutes = router;
