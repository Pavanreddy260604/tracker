
import { Router } from 'express';
import { adminService } from '../services/admin.service';
import multer from 'multer';
import { extractTextFromFile } from '../utils/fileParser';

const router = Router();

// Configure multer for memory storage (file buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @route   GET /api/script/admin/master-scripts
 * @desc    Get all professional master scripts
 */
router.get('/master-scripts', async (req, res) => {
    try {
        const scripts = await adminService.getAllMasterScripts();
        res.json(scripts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts
 * @desc    Upload a new master script (Pending status) - Accepts multipart form data
 */
router.post('/master-scripts', upload.single('file'), async (req, res) => {
    try {
        const { title, director, language, tags, rawContent } = req.body;
        let finalContent = rawContent || '';

        // If a file was uploaded, parse its content and override manual rawContent
        if (req.file) {
            console.log(`[AdminAPI] Received file upload: ${req.file.originalname} (${req.file.mimetype})`);
            finalContent = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
        }

        if (!finalContent || finalContent.trim().length === 0) {
            return res.status(400).json({ error: 'Script content is required (either via file upload or raw text)' });
        }

        // Reconstruct the script data
        const scriptData = {
            title,
            director,
            language,
            tags,
            rawContent: finalContent
        };

        const script = await adminService.createMasterScript(scriptData);
        res.status(201).json(script);
    } catch (error: any) {
        console.error('[AdminAPI] Master script creation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts/:id/process
 * @desc    Trigger AI ingestion/indexing of a master script
 */
router.post('/master-scripts/:id/process', async (req, res) => {
    try {
        // Run in background but notify start
        adminService.processMasterScript(req.params.id).catch(err => {
            console.error(`[AdminAPI] Background processing failed for ${req.params.id}:`, err);
        });

        res.json({ message: 'Ingestion started in background', scriptId: req.params.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
