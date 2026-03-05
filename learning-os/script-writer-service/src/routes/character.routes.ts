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

        // Whitelist allowed fields to prevent mass assignment
        const allowedFields = ['name', 'age', 'role', 'voice', 'traits', 'motivation'];
        const updateData: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Validate role enum
        const validRoles = ['protagonist', 'antagonist', 'supporting', 'minor'];
        if (updateData.role && !validRoles.includes(updateData.role as string)) {
            return res.status(400).json({ success: false, error: `Invalid role. Allowed: ${validRoles.join(', ')}` });
        }

        // Validate age is positive
        if (updateData.age !== undefined && (typeof updateData.age !== 'number' || updateData.age < 0)) {
            return res.status(400).json({ success: false, error: 'Age must be a positive number' });
        }

        // Validate name is not empty
        if (updateData.name === '') {
            return res.status(400).json({ success: false, error: 'Name cannot be empty' });
        }

        // Validate traits is an array
        if (updateData.traits && !Array.isArray(updateData.traits)) {
            return res.status(400).json({ success: false, error: 'Traits must be an array' });
        }

        const character = await characterService.updateCharacter(id, updateData);
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
