import { AIClientService, AIServiceError } from './aiClient.service.js';

export class QuestionGenerationService extends AIClientService {
    public async generateQuestions(
        count: number,
        difficulty: string,
        topics: string[],
        language = 'javascript'
    ): Promise<any[]> {
        const langConfig = this.getLanguageConfig(language);
        const prompt = `You are a technical interviewer API.
Generate ${count} ${difficulty}-level coding interview problems about: ${topics.join(', ') || 'General Algorithms'}.
Language: ${language}

Return ONLY a valid JSON array of objects.
Schema per object:
{
  "title": "Problem Title",
  "description": "Full problem description in markdown",
  "signature": "Function signature code only (no extra text)"
}

Important:
- Do not output text before/after JSON.
- Do not wrap JSON in markdown.
- ${langConfig.promptNote}
- Signature style reference:
${langConfig.referenceSignature}`;

        try {
            const response = await this.chat(prompt, [], true);
            const jsonCandidate = this.extractJsonCandidate(response, true);
            const parsed = jsonCandidate ? this.safeParseJson<unknown>(jsonCandidate) : null;

            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed && typeof parsed === 'object') {
                return [parsed];
            }

            const regexFallback = this.parseQuestionFallback(response);
            if (regexFallback) {
                return regexFallback;
            }

            throw new AIServiceError(
                'Failed to generate interview questions. AI returned invalid JSON.',
                { recoverable: true, context: 'question_generation' }
            );
        } catch (error) {
            throw new AIServiceError('Failed to generate interview questions.', {
                recoverable: true,
                cause: this.toError(error),
                context: 'question_generation',
            });
        }
    }

    public async generateCuratedQuestion(
        difficulty: string,
        topics: string[],
        language = 'javascript'
    ): Promise<Record<string, unknown> | null> {
        const questions = await this.generateQuestions(1, difficulty, topics, language);
        if (questions && questions.length > 0) {
            const q = questions[0];
            return {
                title: q.title,
                description: q.description,
                difficulty,
                topics,
                type: 'coding',
                testCases: [],
                boilerplate: q.signature ? { javascript: q.signature } : undefined,
            };
        }
        return null;
    }

    private getLanguageConfig(lang: string) {
        const normalized = lang.toLowerCase();
        switch (normalized) {
            case 'python':
                return {
                    promptNote: 'Ensure Python code uses correct indentation (4 spaces) and type hints.',
                    referenceSignature:
                        'def two_sum(nums: list[int], target: int) -> list[int]:\n    # your code\n    pass',
                };
            case 'java':
                return {
                    promptNote: 'Provide a class named Solution with a public method.',
                    referenceSignature:
                        'class Solution {\n  public int[] twoSum(int[] nums, int target) { return new int[]{}; }\n}',
                };
            case 'cpp':
            case 'c++':
                return {
                    promptNote: 'Provide a class Solution with a public method.',
                    referenceSignature:
                        'class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {}; } };',
                };
            case 'go':
                return {
                    promptNote: 'Provide a function with correct Go signatures.',
                    referenceSignature: 'func twoSum(nums []int, target int) []int { return nil }',
                };
            default:
                return {
                    promptNote: 'Use standard JavaScript function syntax.',
                    referenceSignature: 'function twoSum(nums, target) {\n  // your code\n}',
                };
        }
    }

    private parseQuestionFallback(response: string): any[] | null {
        const titleMatch = response.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const descMatch = response.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const sigMatch = response.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);

        if (!titleMatch || !descMatch || !sigMatch) {
            return null;
        }

        return [
            {
                title: titleMatch[1],
                description: descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                signature: sigMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
            },
        ];
    }
}
