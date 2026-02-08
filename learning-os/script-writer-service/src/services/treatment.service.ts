import { Treatment, ITreatment } from '../models/Treatment';
import { Scene } from '../models/Scene';
import { aiServiceManager } from './ai.manager';
import { buildBeatSheetPrompt } from '../prompts/hollywood';
import mongoose from 'mongoose';

export class TreatmentService {

    /**
     * Generates a Beat Sheet (Treatment) from a logline using Ollama.
     * Returns the structured object (preview) but does not save it yet.
     */
    async generatePreview(logline: string, style: string = 'Save The Cat'): Promise<any> {
        const prompt = buildBeatSheetPrompt(logline, style);

        console.log(`[TreatmentService] Generating beat sheet for: "${logline}"`);

        try {
            // Use non-streaming chat with JSON mode enabled for reliability
            const response = await aiServiceManager.chat(prompt, [], true);

            let jsonStr = response.trim();

            // Sanitize markdown if present (even in JSON mode models sometimes add it)
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

            // Find valid JSON boundaries
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const data = JSON.parse(jsonStr);
            return data;
        } catch (error) {
            console.error('[TreatmentService] Failed to generate/parse Beat Sheet JSON:', error);
            throw new Error('AI failed to generate a valid Beat Sheet structure. Please try again.');
        }
    }

    /**
     * Saves a confirmed Treatment to database.
     */
    async saveTreatment(bibleId: string, logline: string, acts: any[], style: string = 'Save The Cat'): Promise<ITreatment> {
        const treatment = await Treatment.create({
            bibleId: new mongoose.Types.ObjectId(bibleId),
            logline,
            style,
            acts
        });
        return treatment;
    }

    /**
     * Converts a Treatment into actual Scene documents.
     */
    async convertToScenes(treatmentId: string): Promise<{ count: number, scenes: any[] }> {
        const treatment = await Treatment.findById(treatmentId);
        if (!treatment) throw new Error('Treatment not found');

        const scenesCreated = [];
        let seq = 1;

        // Get current max sequence number to append
        const lastScene = await Scene.findOne({ bibleId: treatment.bibleId }).sort({ sequenceNumber: -1 });
        if (lastScene) seq = lastScene.sequenceNumber + 1;

        for (const act of treatment.acts) {
            for (const beat of act.beats) {
                const scene = await Scene.create({
                    bibleId: treatment.bibleId,
                    sequenceNumber: seq++,
                    slugline: `EXT. ${beat.name.toUpperCase()} - DAY`, // Placeholder
                    summary: beat.description,
                    goal: `Execute beat: ${beat.name}`,
                    status: 'planned'
                });
                scenesCreated.push(scene);
            }
        }

        return { count: scenesCreated.length, scenes: scenesCreated };
    }
}

export const treatmentService = new TreatmentService();
