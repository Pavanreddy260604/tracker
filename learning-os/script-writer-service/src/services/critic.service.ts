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
        You are a ruthless, world-class Hollywood Script Consultant. Your reputation depends on your ability to catch every flaw. You are the gatekeeper of quality.
        
        TASK: Perform a BRUTAL EXECUTIVE AUDIT of the screenplay scene below. 
        Start with a SCORE of 100 and apply the following DEDUCTION PROTOCOL:
        
        1. FORMATTING (-10 to -30): Deduct 10 points for each major deviation from WGA standards (sluglines, character cues, margins).
        2. DIALOGUE (-5 to -40): 
           - Deduct 15 points for "On-the-nose" exposition (characters saying what they feel/know instead of using subtext).
           - Deduct 10 points for "Wooden/Generic" voices that sound identical.
           - Deduct 5 points for every line that doesn't use a TACTIC (deflect, intimidate, etc.).
        3. PACING (-5 to -20): 
           - Deduct 10 points if the scene doesn't "Enter late and leave early."
           - Deduct 5 points for "Director's notes" in action lines (telling instead of showing).
        4. DRAMATIC GOAL (-20 to -50): If the scene fails to move the story forward or achieve its stated goal, deduct 30+ points.
        
        SCORING SCALE:
        90-100: Masterpiece (A) - Professional-ready.
        80-89: Solid (B) - Good craft, minor subtext issues.
        70-79: Average (C) - Readable, but needs significant work.
        <70: Failing (D/F) - Amateurish or mechanically broken.

        CONTEXT:
        Language: ${language}
        Genre: ${genre}
        Dramatic Goal: ${sceneGoal}
        
        SCENE CONTENT:
        """
        ${sceneContent}
        """
        
        Return a JSON object with the following structure:
        {
            "score": [final integer after deductions],
            "grade": ["A", "B", "C", "D", "F"],
            "summary": "Your brutally honest executive verdict (max 2 sentences).",
            "formattingIssues": ["list of deductions made", "or empty if 0"],
            "dialogueIssues": ["list of wooden lines/on-the-nose hits", "or empty if brilliant"],
            "pacingIssues": ["list of where the scene drags", "unnecessary fluff"],
            "suggestions": ["3 mandatory, aggressive prescriptions for rewriting."]
        }
        
        Be surgical. If the scene is mediocre, a score of 80 is TOO HIGH. A score of 82 means it is ALMOST production-ready. 
        If it's regular work, it should be in the 60s or 70s.
        ONLY RETURN THE RAW JSON.
        `;

        try {
            const response = await aiServiceManager.chat(prompt, {
                temperature: 0.0, // Zero temp for absolute scoring consistency
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
