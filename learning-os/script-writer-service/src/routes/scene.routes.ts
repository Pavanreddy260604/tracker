import express from 'express';
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

        // Optionally resequence remaining scenes (not implemented for now)
        // You could renumber sequenceNumber here if needed

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
    const { userId, style, format, characterIds, sceneLength } = req.body;

    try {
        const scene = await Scene.findById(req.params.id).populate('bibleId');
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId._id.toString(), req.userId);

        // Context Retrieval: Find the previous scene to provide "Memory"
        let previousContext = '';
        if (scene.sequenceNumber > 1) {
            const prevScene = await Scene.findOne({
                bibleId: scene.bibleId._id,
                sequenceNumber: scene.sequenceNumber - 1
            });

            if (prevScene) {
                // Use summary if available, falling back to content preview
                const contextContent = prevScene.summary || prevScene.content.slice(0, 500);
                previousContext = `In the previous scene (${prevScene.slugline}): ${contextContent}`;
                // Save this linkage for future reference
                if (scene.previousSceneSummary !== previousContext) {
                    scene.previousSceneSummary = previousContext;
                    await scene.save();
                }
            }
        }

        // Construct the "Idea" based on the Scene Summary + Context
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
            sceneLength: sceneLength || 'medium'
        };

        // Streaming logic
        let fullContent = '';

        for await (const chunk of scriptGenerator.generateScript(request)) {
            res.write(chunk);
            fullContent += chunk;
        }

        // Save to Scene Model
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
        if (!scene.content) return res.status(400).json({ error: 'Scene has no content to critique' });

        // Fetch Bible metadata for Genre context
        const bible = await Bible.findOne({ _id: scene.bibleId });
        const genre = bible?.genre || 'General';

        // Run Critique
        const result = await criticService.evaluateScene(scene.content, scene.goal || scene.summary, genre);

        // Save to Scene
        scene.critique = result;
        scene.status = 'reviewed';
        await scene.save();

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[SceneAPI] Critique Error:', error);
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Critique failed' });
        }
    }
});

export const sceneRoutes = router;
