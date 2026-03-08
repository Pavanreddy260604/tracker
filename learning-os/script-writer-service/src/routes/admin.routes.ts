
import { Router } from 'express';
import { adminService } from '../services/admin.service';
import multer from 'multer';
import { extractTextFromFile } from '../utils/fileParser';
import { MasterScript } from '../models/MasterScript';

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
        res.json({ success: true, data: scripts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/chunks
 * @desc    Get all indexed chunks for a specific master script
 */
router.get('/master-scripts/:id/chunks', async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const chunks = await adminService.getMasterScriptChunks(req.params.id, scriptVersion);
        res.json({ success: true, data: chunks });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/reconstructed
 * @desc    Get the exact reconstructed script text for a specific version
 */
router.get('/master-scripts/:id/reconstructed', async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const reconstructed = await adminService.getMasterScriptReconstructedScript(req.params.id, scriptVersion);
        res.json({ success: true, data: reconstructed });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/validation-report
 * @desc    Get latest (or version-scoped) validation report for a master script
 */
router.get('/master-scripts/:id/validation-report', async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const report = await adminService.getMasterScriptValidationReport(req.params.id, scriptVersion);
        res.json({ success: true, data: report });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
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
        let normalizedTags: string[] = [];

        // If a file was uploaded, parse its content and override manual rawContent
        if (req.file) {
            console.log(`[AdminAPI] Received file upload: ${req.file.originalname} (${req.file.mimetype})`);
            finalContent = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
        }

        if (Array.isArray(tags)) {
            normalizedTags = tags.map(value => String(value).trim()).filter(Boolean);
        } else if (typeof tags === 'string' && tags.trim().length > 0) {
            try {
                const parsed = JSON.parse(tags);
                normalizedTags = Array.isArray(parsed)
                    ? parsed.map(value => String(value).trim()).filter(Boolean)
                    : [];
            } catch {
                normalizedTags = tags.split(',').map((value: string) => value.trim()).filter(Boolean);
            }
        }

        if (!finalContent || finalContent.trim().length === 0) {
            return res.status(400).json({ error: 'Script content is required (either via file upload or raw text)' });
        }

        // Reconstruct the script data
        const scriptData = {
            title,
            director,
            language,
            tags: normalizedTags,
            rawContent: finalContent
        };

        const script = await adminService.createMasterScript(scriptData);
        res.status(201).json({ success: true, data: script });
    } catch (error: any) {
        console.error('[AdminAPI] Master script creation failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts/:id/process
 * @desc    Trigger AI ingestion/indexing of a master script
 */
router.post('/master-scripts/:id/process', async (req, res) => {
    try {
        const script = await MasterScript.findById(req.params.id).select('status processingScriptVersion gateStatus');
        if (!script) {
            return res.status(404).json({ success: false, error: 'Master script not found' });
        }
        if (script.status === 'processing') {
            return res.status(202).json({
                success: true,
                data: {
                    message: 'Ingestion already in progress',
                    scriptId: req.params.id,
                    scriptVersion: script.processingScriptVersion || null,
                    gateStatus: script.gateStatus || 'pending'
                }
            });
        }

        const runInfo = await adminService.startMasterScriptProcessing(req.params.id);

        res.status(202).json({
            success: true,
            data: {
                message: 'Ingestion started in background',
                scriptId: req.params.id,
                scriptVersion: runInfo.scriptVersion,
                gateStatus: runInfo.gateStatus
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts/:id/audit
 * @desc    Trigger a Great Expectations audit for a script version
 */
router.post('/master-scripts/:id/audit', async (req, res) => {
    try {
        const scriptVersion = typeof req.body?.scriptVersion === 'string' ? req.body.scriptVersion : undefined;
        const result = await adminService.runGeAudit(req.params.id, scriptVersion);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   DELETE /api/script/admin/master-scripts/:id
 * @desc    Delete a master script and all associated embeddings/data
 */
router.delete('/master-scripts/:id', async (req, res) => {
    try {
        await adminService.deleteMasterScript(req.params.id);
        res.json({ success: true, data: { message: 'Master script deleted successfully' } });
    } catch (error: any) {
        console.error(`[AdminAPI] Failed to delete script ${req.params.id}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
