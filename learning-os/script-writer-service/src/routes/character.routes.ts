import { Router } from 'express';
import { characterService } from '../services/character.service';
import { authenticate } from '../middleware/auth.js';
import { Bible } from '../models/Bible';
import { Character } from '../models/Character';

const router = Router();

router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) {
        throw new Error('ACCESS_DENIED');
    }
    return bible;
}

async function assertCharacterAccess(characterId: string, userId?: string) {
    const character = await Character.findById(characterId);
    if (!character) return null;
    await assertBibleAccess(character.bibleId.toString(), userId);
    return character;
}

// GET /api/character/bible/:bibleId
router.get('/bible/:bibleId', async (req, res) => {
    try {
        const { bibleId } = req.params;
        await assertBibleAccess(bibleId, req.userId);
        const characters = await characterService.getCharactersByBible(bibleId);
        res.json({ success: true, data: characters });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/character/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const character = await assertCharacterAccess(id, req.userId);
        if (!character) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character
router.post('/', async (req, res) => {
    try {
        const { bibleId } = req.body;
        await assertBibleAccess(bibleId, req.userId);
        const character = await characterService.createCharacter({ ...req.body, bibleId });
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/character/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await assertCharacterAccess(id, req.userId);
        const character = await characterService.updateCharacter(id, req.body);
        if (!character) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/character/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await assertCharacterAccess(id, req.userId);
        const success = await characterService.deleteCharacter(id);
        if (!success) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, message: 'Character deleted' });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

export const characterRoutes = router;
