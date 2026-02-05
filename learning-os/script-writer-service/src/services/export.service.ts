import { Scene } from '../models/Scene';
import { Bible } from '../models/Bible';

export class ExportService {

    async compileProject(bibleId: string, format: 'fountain' | 'txt' | 'json'): Promise<string> {
        const bible = await Bible.findById(bibleId);
        const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });

        if (!bible) throw new Error('Bible not found');

        if (format === 'json') {
            return JSON.stringify({ bible, scenes }, null, 2);
        }

        let output = '';

        // Title Page (Fountain Standard)
        output += `Title: ${bible.title}\n`;
        output += `Credit: Written by\n`;
        output += `Author: Screenwriter AI\n`;
        output += `Draft date: ${new Date().toLocaleDateString()}\n`;
        output += `Contact: \n`;
        output += `\n`; // End Title Page
        output += `\n`;

        // Scenes
        for (const scene of scenes) {
            output += `\n`; // Space before scene header
            output += `${scene.slugline.toUpperCase()}\n`;
            // output += `\n`; // Space after header (optional, Fountain parsers handle it)

            if (scene.content) {
                // Remove existing FADE IN/sluglines if they are redundant in the content
                // But generally users might have edited them.
                // For safety, we just append the content.
                // ideally we strip the first line if it matches the slugline to avoid double headers
                let cleanContent = scene.content.trim();
                const lines = cleanContent.split('\n');
                if (lines.length > 0 && lines[0].includes(scene.slugline)) {
                    cleanContent = lines.slice(1).join('\n').trim();
                }

                output += `\n${cleanContent}\n`;
            } else {
                // If no content, just print the summary as a note
                output += `\n[[Scene Summary: ${scene.summary}]]\n`;
            }
        }

        return output;
    }
}

export const exportService = new ExportService();
