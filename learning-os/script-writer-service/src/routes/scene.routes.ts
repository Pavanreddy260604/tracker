import express from 'express';
import mongoose from 'mongoose';
import { Scene } from '../models/Scene';
import { Bible } from '../models/Bible'; // Import Bible model
import { scriptGenerator } from '../services/scriptGenerator.service';
import { criticService } from '../services/critic.service'; // Import Critic Service
import { FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

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

    if (!bibleId || !slugline) {
        return res.status(400).json({ error: 'Bible ID and Slugline are required' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        // Auto-increment sequence if not provided
        let seq = sequenceNumber;
        if (!seq) {
            const lastScene = await Scene.findOne({ bibleId }).sort({ sequenceNumber: -1 });
            seq = (lastScene?.sequenceNumber || 0) + 1;
        }

        const newScene = await Scene.create({
            bibleId,
            sequenceNumber: seq,
            slugline,
            summary,
            status: 'planned',
            content: ''
        });

        res.json({ success: true, data: newScene });
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
        const updatedScene = await Scene.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
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
    const { userId, style, format, characterIds, sceneLength, language } = req.body;

    try {
        const scene = await Scene.findById(req.params.id).populate('bibleId');
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId._id.toString(), req.userId);

        let previousContext = '';
        if (scene.sequenceNumber > 1) {
            const prevScene = await Scene.findOne({
                bibleId: scene.bibleId._id,
                sequenceNumber: scene.sequenceNumber - 1
            });

            if (prevScene) {
                const contextContent = prevScene.summary || prevScene.content.slice(0, 500);
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
            userId: req.userId || userId || 'anonymous',
            idea: promptIdea,
            format: (format as any) || 'film',
            style: (style as any) || 'classic',
            bibleId: scene.bibleId._id.toString(),
            characterIds: characterIds,
            previousContext: previousContext,
            sceneLength: sceneLength || 'medium',
            language: language || 'English'
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
            if (!res.headersSent) res.status(500).json({ error: 'Generation failed', details: (error as Error).message });
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
            const attempt1Content = await scriptGenerator.reviseSceneBatch(originalContent, scene.critique, scene.goal || scene.summary, false, currentBestScore, language);
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
                const attempt2Content = await scriptGenerator.reviseSceneBatch(originalContent, attempt1Critique, scene.goal || scene.summary, true, currentBestScore, language);
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

export const sceneRoutes = router;
