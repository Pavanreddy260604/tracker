import { Scene } from '../models/Scene';
import { Bible } from '../models/Bible';

export class ExportService {

    async compileProject(bibleId: string, format: 'fountain' | 'txt' | 'json'): Promise<string> {
        // Validate bibleId
        if (!bibleId || typeof bibleId !== 'string') {
            throw new Error('Invalid bible ID provided');
        }

        const bible = await Bible.findById(bibleId);
        const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });

        if (!bible) throw new Error('Bible not found');

        if (format === 'json') {
            return JSON.stringify({ bible, scenes }, null, 2);
        }

        let output = '';

        // Title Page (Fountain Standard)
        // Sanitize title to prevent injection in output
        const sanitizedTitle = this.sanitizeFountainText(bible.title || 'Untitled');
        output += `Title: ${sanitizedTitle}\n`;
        output += `Credit: Written by\n`;
        output += `Author: Screenwriter AI\n`;
        output += `Draft date: ${new Date().toLocaleDateString()}\n`;
        output += `Contact: \n`;
        output += `\n`; // End Title Page
        output += `\n`;

        // Scenes
        for (const scene of scenes) {
            output += `\n`; // Space before scene header
            // Sanitize slugline
            const sanitizedSlugline = this.sanitizeFountainText(scene.slugline || 'INT. UNKNOWN - TIME');
            output += `${sanitizedSlugline.toUpperCase()}\n`;

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

                // Sanitize content
                const sanitizedContent = this.sanitizeFountainText(cleanContent);
                output += `\n${sanitizedContent}\n`;
            } else {
                // If no content, just print the summary as a note
                const sanitizedSummary = this.sanitizeFountainText(scene.summary || 'No summary');
                output += `\n[[Scene Summary: ${sanitizedSummary}]]\n`;
            }
        }

        return output;
    }

    /**
     * Sanitize text for Fountain format output.
     * Prevents potential injection issues and ensures clean output.
     */
    private sanitizeFountainText(text: string): string {
        if (!text || typeof text !== 'string') {
            return '';
        }
        // Remove any potentially dangerous characters while preserving formatting
        // Limit length to prevent abuse
        const MAX_LENGTH = 50000;
        const sanitized = text
            .replace(/\0/g, '') // Remove null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters

        return sanitized.length > MAX_LENGTH
            ? sanitized.slice(0, MAX_LENGTH) + '\n[Content truncated due to length]'
            : sanitized;
    }
}

export const exportService = new ExportService();
