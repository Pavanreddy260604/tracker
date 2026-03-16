import { Character } from '../models/Character';
import { aiServiceManager } from './ai.manager';
import { CHARACTER_DISCOVERY_PROMPT } from '../prompts/hollywood';
import mongoose from 'mongoose';

export class CharacterDiscoveryService {
    /**
     * Scans generated text for new characters and adds them to the project Bible.
     */
    async discoverAndSave(bibleId: string, text: string): Promise<number> {
        console.log(`[CharacterDiscovery] Scanning text for bibleId ${bibleId}...`);

        try {
            // 1. Get existing characters names to avoid duplicates
            const existingCharacters = await Character.find({ bibleId }).select('name').lean();
            const existingNames = existingCharacters.map(c => c.name.toUpperCase());

            // 2. Build Prompt
            const prompt = CHARACTER_DISCOVERY_PROMPT
                .replace('{{existing_cast}}', existingNames.length > 0 ? existingNames.join(', ') : 'No existing characters.')
                .replace('{{story_text}}', text);

            // 3. Call AI
            const response = await aiServiceManager.chat(prompt, { format: 'json', temperature: 0.1 });
            
            // 4. Parse JSON
            let newCharacters: any[] = [];
            try {
                const cleanJson = response.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
                newCharacters = JSON.parse(cleanJson);
            } catch (e) {
                console.warn('[CharacterDiscovery] Failed to parse AI JSON response:', e);
                return 0;
            }

            if (!Array.isArray(newCharacters)) {
                console.warn('[CharacterDiscovery] AI did not return a valid array of characters.');
                return 0;
            }

            // 5. Filter and Save
            let addedCount = 0;
            for (const charData of newCharacters) {
                const normalizedName = charData.name.trim().toUpperCase();
                
                // Case-insensitive check
                if (existingNames.includes(normalizedName)) {
                    continue;
                }

                const aiRole = (charData.role || '').toLowerCase();
                
                // SKIP MINOR/INCIDENTAL CHARACTERS (as requested by user)
                if (aiRole === 'minor' || aiRole === 'incidental') {
                    console.log(`[CharacterDiscovery] Skipping minor/incidental character: ${charData.name}`);
                    continue;
                }

                let role: any = 'supporting';
                if (aiRole === 'antagonist') role = 'antagonist';
                // If AI suggests 'major', we map to 'supporting' (don't auto-assign protagonist)
                // but we definitely save them because they aren't minor.

                await Character.create({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    name: charData.name.trim(),
                    role: role,
                    motivation: charData.motivation || '',
                    traits: Array.isArray(charData.traits) ? charData.traits : [],
                    voice: {
                        description: charData.voiceDescription || `Discovered from story generation.`,
                        sampleLines: charData.sampleDialogue ? [charData.sampleDialogue] : []
                    }
                });
                
                existingNames.push(normalizedName);
                addedCount++;
                console.log(`[CharacterDiscovery] Added new character: ${charData.name}`);
            }

            return addedCount;
        } catch (err) {
            console.error('[CharacterDiscovery] Fatal error during discovery:', err);
            return 0;
        }
    }
}

export const characterDiscoveryService = new CharacterDiscoveryService();
