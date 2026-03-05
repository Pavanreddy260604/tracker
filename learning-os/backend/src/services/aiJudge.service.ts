import { AIClientService, AIServiceError } from './aiClient.service.js';

export class AIJudgeService extends AIClientService {
    public async analyzeCode(
        problemDescription: string,
        userCode: string,
        language: string,
        correctnessScore: number
    ): Promise<{ feedback: string; complexityAnalysis: string }> {
        const prompt = `You are a senior code reviewer.
Language: ${language}
Correctness score: ${correctnessScore}/100

Problem:
${problemDescription}

Candidate code:
${userCode}

Return ONLY valid JSON:
{
  "feedback": "Concise but specific code review",
  "complexityAnalysis": "Time O(...), Space O(...) with short explanation"
}`;

        try {
            const response = await this.chat(prompt, [], true);
            const jsonCandidate = this.extractJsonCandidate(response, false);
            const parsed = jsonCandidate
                ? this.safeParseJson<{ feedback?: unknown; complexityAnalysis?: unknown }>(jsonCandidate)
                : null;

            if (
                parsed &&
                typeof parsed.feedback === 'string' &&
                typeof parsed.complexityAnalysis === 'string'
            ) {
                return {
                    feedback: parsed.feedback,
                    complexityAnalysis: parsed.complexityAnalysis,
                };
            }

            throw new AIServiceError('Invalid analysis format returned by AI.', {
                recoverable: true,
                context: 'code_analysis',
            });
        } catch (error) {
            throw new AIServiceError('Failed to analyze code. Please try again.', {
                recoverable: true,
                cause: this.toError(error),
                context: 'code_analysis',
            });
        }
    }

    public async runCode(
        description: string,
        code: string,
        language: string
    ): Promise<{ output: string; status: 'error' | 'success' }> {
        const prompt = `Compiler/Interpreter for ${language}. Problem: ${description}. Code: ${code}. Return [STATUS: SUCCESS|ERROR] and [OUTPUT: ...].`;
        try {
            const response = await this.chat(prompt, [], false);
            const statusMatch = response.match(/\[STATUS:\s*(.*?)\]/i);
            const outputMatch =
                response.match(/\[OUTPUT:\s*([\s\S]*?)\]/i) || response.match(/\[OUTPUT:\s*(.*?)$/i);

            return {
                status:
                    statusMatch && statusMatch[1].trim().toUpperCase() === 'SUCCESS'
                        ? 'success'
                        : 'error',
                output: outputMatch ? outputMatch[1].trim() : response,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { status: 'error', output: `Execution failed: ${message}` };
        }
    }

    public async generateInterviewFeedback(sessionData: any): Promise<string> {
        let prompt = `You are a Senior Engineering Manager evaluating a candidate's technical interview performance.
Provide a concise, encouraging, but constructive overall feedback summary (3-4 paragraphs) using markdown.

Context:
Total Score: ${sessionData.totalScore}/100

Sections:
`;

        if (Array.isArray(sessionData.sections)) {
            sessionData.sections.forEach((sec: any) => {
                prompt += `- ${sec.name} (${sec.type}): Score ${sec.sectionScore}/100\n`;
            });
        }

        prompt += `\nFocus on their strong areas and specific topics they should practice next. Be professional and supportive.`;

        try {
            return await this.chat(prompt, [], false);
        } catch (error) {
            return "Your overall performance showed a good grasp of core concepts. Focus on taking your time to understand edge cases and practicing more complex algorithmic patterns to improve execution speed.";
        }
    }
}
