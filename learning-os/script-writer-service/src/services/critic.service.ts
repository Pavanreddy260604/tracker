import { OllamaService } from './ollama.service';

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
    private ollama: OllamaService;

    constructor() {
        this.ollama = new OllamaService();
    }

    async evaluateScene(sceneContent: string, sceneGoal: string, genre: string, language: string = 'English'): Promise<CritiqueResult> {
        const prompt = `
        You are a professional Hollywood Script Consultant. Your job is to provide an objective, high-level evaluation of the following screenplay scene.
        
        CONTEXT:
        Language: ${language}
        Genre: ${genre}
        Dramatic Goal: ${sceneGoal}
        
        SCENE CONTENT:
        """
        ${sceneContent}
        """
        
        Analyze the scene for:
        1. FORMATTING: Absolute fidelity to Industry Standard Screenplay Format.
        2. DIALOGUE: Naturalism, subtext, and character voice. Avoid "on-the-nose" exposition.
        3. PACING: Tension, momentum, and scene economy (enter late, leave early).
        4. GOAL: Effectiveness in achieving the stated dramatic goal.

        Return a JSON object with the following structure:
        {
            "score": [0-100 integer],
            "grade": ["A", "B", "C", "D", "F"],
            "summary": "Professional verdict.",
            "formattingIssues": ["list", "of", "errors"],
            "dialogueIssues": ["list", "of", "critiques"],
            "pacingIssues": ["list", "of", "notes"],
            "suggestions": ["3 specific items for improvement or 'Elite Polish' if score is 90+"]
        }
        
        Be precise and objective. If the scene is already elite (90+), focus your suggestions on subtle nuances and professional polish rather than pointing out flaws for the sake of it.
        ONLY RETURN THE RAW JSON.
        `;

        try {
            const response = await this.ollama.generateCompletion(prompt, {
                temperature: 0.3, // Low temp for analytical consistency
                format: "json"
            });

            // Clean markdown blocks if present
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson) as CritiqueResult;

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
