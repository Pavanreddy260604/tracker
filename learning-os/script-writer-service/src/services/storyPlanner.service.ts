
import { Bible } from '../models/Bible';
import { Scene } from '../models/Scene';
import { aiServiceManager } from './ai.manager';

export class StoryPlannerService {
    public async ensureGlobalOutline(bible: any): Promise<void> {
        const targetScale = Math.max(20, Math.floor((bible.targetSceneCount || 60) / 3));
        if (bible.globalOutline && bible.globalOutline.length >= targetScale) return;
        
        const { MASTER_OUTLINE_PROMPT } = require('../prompts/hollywood');
        const prompt = MASTER_OUTLINE_PROMPT
            .replace('{{logline}}', bible.logline || bible.title)
            .replace('{{target_scale}}', targetScale.toString());
        try {
            console.log('[GlobalOutline] Generating for logline:', bible.logline || bible.title);
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let outline = JSON.parse(cleanJson);
            if (!Array.isArray(outline) && typeof outline === 'object') {
                outline = outline.beats || outline.story_arc || outline.master_story_arc || Object.values(outline)[0];
            }
            if (Array.isArray(outline)) {
                bible.globalOutline = outline;
                await bible.save();
                console.log('[StoryPlanner] Global Outline Generated for Bible:', bible._id);
            }
        } catch (err) {
            console.error('[GlobalOutline] Failed to generate:', err);
        }
    }

    public async updateRecursiveSummary(bible: any): Promise<void> {
        const { RECURSIVE_SUMMARY_PROMPT } = require('../prompts/hollywood');
        const recentScenes = await Scene.find({ bibleId: bible._id }).sort({ createdAt: -1 }).limit(5).lean();
        if (recentScenes.length === 0) return;
        const scenesText = recentScenes.reverse().map((s: any) => `### ${s.title}\n${s.content}`).join('\n\n');
        const prompt = RECURSIVE_SUMMARY_PROMPT.replace('{{recent_scenes}}', scenesText).replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');
        try {
            const newSummary = await aiServiceManager.chat(prompt);
            bible.storySoFar = newSummary.trim();
            await bible.save();
            console.log('[StoryPlanner] Story So Far updated recursive summary.');
        } catch (err) {
            console.error('[RecursiveSummary] Failed:', err);
        }
    }

    public async generateBlockBeatSheet(bibleId: string, startScene: number, count: number = 10): Promise<any[]> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('Bible not found');
        const { BLOCK_BEAT_SHEET_PROMPT } = require('../prompts/hollywood');
        const prompt = BLOCK_BEAT_SHEET_PROMPT
            .replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.')
            .replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.')
            .replace(/{{start_scene}}/g, startScene.toString())
            .replace(/{{end_scene}}/g, (startScene + count - 1).toString());
        try {
            console.log(`[StoryPlanner] Planning Block: Scenes ${startScene}-${startScene + count - 1}`);
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let block = JSON.parse(cleanJson);
            if (!Array.isArray(block) && typeof block === 'object') block = block.scenes || block.beats || Object.values(block)[0];
            return Array.isArray(block) ? block : [];
        } catch (err) {
            console.error('[BlockBeatSheet] Failed:', err);
            return [];
        }
    }

    public async generateBeatSheet(request: any, samples: any[], cast: any[]): Promise<any> {
        const { BEAT_SHEET_PROMPT } = require('../prompts/hollywood');
        const bible = request.bibleId ? await Bible.findById(request.bibleId) : null;
        
        let prompt = BEAT_SHEET_PROMPT
            .replace('{{idea}}', request.idea)
            .replace('{{genre}}', request.genre || 'Drama')
            .replace('{{tone}}', request.tone || 'Neutral');

        if (bible) {
            prompt = prompt.replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');
            prompt = prompt.replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.');
        } else {
            prompt = prompt.replace('{{story_so_far}}', 'Stand-alone scene.').replace('{{global_outline}}', 'None.');
        }

        try {
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (err) {
            console.error('[BeatSheet] Generation failed:', err);
            return null;
        }
    }
}

export const storyPlannerService = new StoryPlannerService();
