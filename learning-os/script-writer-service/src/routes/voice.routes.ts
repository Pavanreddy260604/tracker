import { Router } from 'express';
import multer from 'multer';
import { voiceService } from '../services/voice.service';
import { authenticate } from '../middleware/auth.js';
import { Bible } from '../models/Bible';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB cap to prevent abuse
}); // Keep files in memory for processing

// Require auth for all voice routes
router.use(authenticate);

// POST /api/voice/ingest
router.post('/ingest', upload.single('file'), async (req, res) => {
    try {
        const { bibleId, characterId } = req.body;
        const file = req.file;

        if (!file || !bibleId) {
            return res.status(400).json({ success: false, error: 'Missing file or bibleId' });
        }

        const bible = await Bible.findOne({ _id: bibleId, userId: req.userId });
        if (!bible) {
            return res.status(403).json({ success: false, error: 'Access denied for this project' });
        }

        const allowedTypes = ['application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ success: false, error: 'Unsupported file type. Use PDF or plain text.' });
        }

        const count = await voiceService.ingestReferenceMaterial(
            bibleId,
            file.buffer,
            file.mimetype,
            file.originalname,
            characterId // Pass optional characterId
        );

        res.json({ success: true, count, message: `Successfully ingested ${count} samples.` });

    } catch (error: any) {
        console.error('Ingestion failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
