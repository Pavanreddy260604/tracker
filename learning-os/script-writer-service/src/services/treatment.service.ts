import { Treatment, ITreatment } from '../models/Treatment';
import { Scene } from '../models/Scene';
import { ollamaService } from './ollama.service';
import { buildBeatSheetPrompt } from '../prompts/hollywood';
import mongoose from 'mongoose';

export class TreatmentService {

    /**
     * Generates a Beat Sheet (Treatment) from a logline using Ollama.
     * Returns the structured object (preview) but does not save it yet.
     */
    async generatePreview(logline: string, style: string = 'Save The Cat'): Promise<any> {
        const prompt = buildBeatSheetPrompt(logline, style);

        let fullResponse = '';
        console.log(`[TreatmentService] Generating beat sheet for: "${logline}"`);

        // Use chatStream to get the JSON
        // Note: We might want a non-streaming method in ollamaService for JSON tasks, 
        // but we can just consume the stream here.
        const stream = ollamaService.chatStream([
            { role: 'user', content: prompt }
        ]);

        for await (const chunk of stream) {
            fullResponse += chunk;
        }

        // Clean up JSON (Ollama sometimes adds markdown blocks)
        const jsonStr = fullResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const data = JSON.parse(jsonStr);
            return data;
        } catch (error) {
            console.error('[TreatmentService] Failed to parse JSON:', fullResponse);
            throw new Error('AI failed to generate a valid Beat Sheet structure. Please try again.');
        }
    }

    /**
     * Saves a confirmed Treatment to database.
     */
    async saveTreatment(bibleId: string, logline: string, acts: any[]): Promise<ITreatment> {
        const treatment = await Treatment.create({
            bibleId: new mongoose.Types.ObjectId(bibleId),
            logline,
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
