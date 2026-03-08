import { aiServiceManager } from './ai.manager';

interface CritiqueResult {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    summary: string;
    formattingIssues: string[];
    dialogueIssues: string[];
    pacingIssues: string[];
    suggestions: string[];
}

export class CriticService {
    async evaluateScene(sceneContent: string, sceneGoal: string, genre: string, language: string = 'English'): Promise<CritiqueResult> {
        const prompt = `
        You are a ruthless, elite Hollywood Script Doctor performing an Executive Scene Audit.
        Your job is to provide an objective, unflinching breakdown of the following screenplay scene. Do not flatter the writer. Be brutally honest. If the scene is boring, say so. If the dialogue is clunky, point it out.

        CONTEXT:
        Language: ${language}
        Genre: ${genre}
        Dramatic Goal: ${sceneGoal}
        
        SCENE CONTENT:
        """
        ${sceneContent}
        """
        
        Analyze the scene for:
        1. FORMATTING: Absolute fidelity to Industry Standard Screenplay Format. Call out any sloppy formatting.
        2. DIALOGUE: Naturalism, subtext, and character voice. Ruthlessly identify "on-the-nose" exposition or wooden lines.
        3. PACING: Tension, momentum, and scene economy. Does it enter late and leave early? Where does the scene drag?
        4. GOAL: Does it actually achieve the stated dramatic goal, or does it wander aimlessly?

        Return a JSON object with the following structure:
        {
            "score": [0-100 integer],
            "grade": ["A", "B", "C", "D", "F"],
            "summary": "Your brutally honest executive verdict (max 3 sentences).",
            "formattingIssues": ["list", "of", "sloppy", "errors", "or empty if perfect"],
            "dialogueIssues": ["list", "of", "wooden lines", "on-the-nose exposition", "or empty if brilliant"],
            "pacingIssues": ["list", "of", "where the scene drags", "unnecessary action lines"],
            "suggestions": ["3 aggressive, specific prescriptions for rewriting the scene. If the score is 90+, provide 'Elite Polish' suggestions."]
        }
        
        Be precise, surgical, and unsparing.
        ONLY RETURN THE RAW JSON.
        `;

        try {
            const response = await aiServiceManager.chat(prompt, {
                temperature: 0.3, // Low temp for analytical consistency
                format: "json"
            });

            // Robust JSON extraction using regex
            let jsonString = response;

            // 1. Try to find content between { and }
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                jsonString = match[0];
            } else {
                // 2. If no braces found, try cleaning markdown blocks
                jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            try {
                return JSON.parse(jsonString) as CritiqueResult;
            } catch (parseError) {
                console.warn("[CriticService] Initial JSON parse failed, attempting aggressive cleanup:", parseError);
                // 3. Last ditch cleanup: remove everything before first { and after last }
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                    return JSON.parse(jsonString) as CritiqueResult;
                }
                throw parseError;
            }

        } catch (error) {
            console.error("Critic evaluation failed:", error);
            // Fallback result
            return {
                score: 0,
                grade: 'F',
                summary: "Error generating critique.",
                formattingIssues: [],
                dialogueIssues: [],
                pacingIssues: [],
                suggestions: ["System error. Please try again."]
            };
        }
    }
}

export const criticService = new CriticService();
