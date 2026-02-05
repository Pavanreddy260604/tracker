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

    async evaluateScene(sceneContent: string, sceneGoal: string, genre: string): Promise<CritiqueResult> {
        const prompt = `
        You are a harsh Hollywood Script Reader and Critic. Your job is to evaluate the following screenplay scene.
        
        CONTEXT:
        Genre: ${genre}
        Dramatic Goal: ${sceneGoal}
        
        SCENE CONTENT:
        """
        ${sceneContent}
        """
        
        Analyze the scene for:
        1. FORMATTING: Are sluglines, action lines, and dialogue formatted correctly? (Check for Standard Screenplay Format)
        2. DIALOGUE: Is it natural? Is it too expositional ("on the nose")? 
        3. PACING: Does it drag? Does it start late and leave early?
        4. GOAL: Did it achieve the dramatic goal?

        Return a JSON object with the following structure:
        {
            "score": [0-100 integer],
            "grade": ["A", "B", "C", "D", "F"],
            "summary": "1-2 sentence overall verdict.",
            "formattingIssues": ["list", "of", "formatting", "errors"],
            "dialogueIssues": ["list", "of", "dialogue", "critiques"],
            "pacingIssues": ["list", "of", "pacing", "notes"],
            "suggestions": ["3 specific actionable improvements"]
        }
        
        Be critical. Do not hallucinate errors. If it is good, give it a high score.
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
