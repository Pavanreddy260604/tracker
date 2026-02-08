import express from 'express';
import { treatmentService } from '../services/treatment.service';
import { Treatment } from '../models/Treatment';
import { authenticate } from '../middleware/auth.js';
import { Bible } from '../models/Bible';

const router = express.Router();

router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}

async function assertTreatmentAccess(treatmentId: string, userId?: string) {
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) return null;
    await assertBibleAccess(treatment.bibleId.toString(), userId);
    return treatment;
}

// POST /api/treatment/generate
// Generate a Beat Sheet (Preview only)
router.post('/generate', async (req, res) => {
    const { logline, style } = req.body;
    if (!logline) return res.status(400).json({ error: 'Logline is required' });

    try {
        const data = await treatmentService.generatePreview(logline, style);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[TreatmentAPI] Generate Error:', error);
        res.status(500).json({ error: error.message || 'Generation failed' });
    }
});

// POST /api/treatment/save
// Save a confirmed Treatment
router.post('/save', async (req, res) => {
    const { bibleId, logline, acts, style } = req.body;
    if (!bibleId || !acts) return res.status(400).json({ error: 'Bible ID and acts are required' });

    try {
        await assertBibleAccess(bibleId, req.userId);
        const treatment = await treatmentService.saveTreatment(bibleId, logline, acts, style);
        res.json({ success: true, data: treatment });
    } catch (error: any) {
        console.error('[TreatmentAPI] Save Error:', error);
        if (error.message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: error.message || 'Save failed' });
        }
    }
});

// GET /api/treatment/bible/:bibleId
// List treatments for a project
router.get('/bible/:bibleId', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const treatments = await Treatment.find({ bibleId: req.params.bibleId }).sort({ createdAt: -1 });
        res.json({ success: true, data: treatments });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: 'Failed to fetch treatments' });
        }
    }
});

// POST /api/treatment/convert
// Convert Treatment to Scenes
router.post('/convert', async (req, res) => {
    const { treatmentId } = req.body;
    if (!treatmentId) return res.status(400).json({ error: 'Treatment ID is required' });

    try {
        await assertTreatmentAccess(treatmentId, req.userId);
        const result = await treatmentService.convertToScenes(treatmentId);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[TreatmentAPI] Convert Error:', error);
        if (error.message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: error.message || 'Conversion failed' });
        }
    }
});

export const treatmentRoutes = router;
