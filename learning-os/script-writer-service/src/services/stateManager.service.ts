
import { Character } from '../models/Character';
import { aiServiceManager } from './ai.manager';

export class StateManagerService {
    public buildCharacterContext(characters: any[]): string {
        if (!characters || characters.length === 0) return 'No specific character data available.';
        return characters.map(c => {
            let bio = `- **${c.name.toUpperCase()}** (${c.role || 'supporting'})`;
            if (c.traits?.length) bio += ` | Traits: ${c.traits.join(', ')}`;
            if (c.motivation) bio += ` | Motivation: ${c.motivation}`;
            if (c.currentStatus) bio += ` | Status: ${c.currentStatus}`;
            
            if (c.voice) {
                let voiceInfo = '';
                if (c.voice.description) voiceInfo += `Voice: ${c.voice.description}. `;
                if (c.voice.accent) voiceInfo += `Accent: ${c.voice.accent}. `;
                if (c.voice.sampleLines?.length) voiceInfo += `Sample: "${c.voice.sampleLines[0]}"`;
                if (voiceInfo) bio += ` | ${voiceInfo.trim()}`;
            }

            if (c.relationships?.length) {
                bio += ` | Relationships: ${c.relationships.map((r: any) => `${r.targetCharName}: ${r.dynamic}`).join(', ')}`;
            }

            return bio;
        }).join('\n');
    }

    public async extractAndSaveState(content: string, characters: any[]): Promise<void> {
        if (!characters.length || !content) return;
        
        const { STATE_EXTRACTION_PROMPT } = require('../prompts/hollywood');
        const characterNames = characters.map(c => c.name).join(', ');
        const prompt = STATE_EXTRACTION_PROMPT
            .replace('{{content}}', content)
            .replace('{{characters}}', characterNames);

        try {
            const response = await aiServiceManager.chat(prompt, { format: 'json', temperature: 0 });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            const updatesList = Array.isArray(parsed) ? parsed : (parsed.updates || []);

            const tasks = characters.map(async (char) => {
                const update = Array.isArray(updatesList) 
                    ? updatesList.find((u: any) => u.name === char.name)
                    : updatesList[char.name];

                if (update) {
                    const status = update.newStatus || update.status;
                    if (status) char.currentStatus = status;
                    
                    if (Array.isArray(update.itemsGained)) {
                        char.inventory = Array.from(new Set([...(char.inventory || []), ...update.itemsGained]));
                    }
                    if (Array.isArray(update.itemsLost)) {
                        char.inventory = (char.inventory || []).filter((item: string) => !update.itemsLost.includes(item));
                    }
                    
                    await Character.findByIdAndUpdate(char._id, {
                        currentStatus: char.currentStatus,
                        inventory: char.inventory
                    });
                    console.log(`[StateManager] Updated state for ${char.name}`);
                }
            });

            await Promise.all(tasks);
        } catch (err) {
            console.error('[StateManager] Failed to extract/save state:', err);
        }
    }
}

export const stateManagerService = new StateManagerService();
