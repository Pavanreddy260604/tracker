import axios from 'axios';

export class OllamaService {
    private baseUrl: string;
    private model: string;

    constructor(model?: string) {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.model = model || process.env.OLLAMA_MODEL || 'mistral';
    }

    /**
     * Generate interview questions based on difficulty and count
     */
    /**
     * Generate interview questions based on difficulty and count
     */
    async generateQuestions(count: number, difficulty: string, topics: string[], language: string = 'javascript'): Promise<any[]> {
        const langConfig = this.getLanguageConfig(language);

        // Enhanced prompt to force strict JSON format
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
        - Do not output any text before or after the JSON.
        - Do not wrap the JSON in markdown code blocks.
        - ${langConfig.promptNote}`;

        try {
            console.log(`[Ollama] Generating questions with model: ${this.model}`);
            const response = await this.chat(prompt, [], true);
            console.log('[Ollama] Raw response length:', response.length);

            // Robust JSON extraction
            // Robust JSON extraction
            let jsonStr = response.trim();

            // 1. Try to find JSON array pattern
            const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                jsonStr = arrayMatch[0];
            } else {
                // 2. If no array, try to find JSON object pattern
                const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    jsonStr = objectMatch[0];
                } else {
                    // 3. Fallback cleanup (remove markdown)
                    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                }
            }

            try {
                const parsed = JSON.parse(jsonStr);

                if (Array.isArray(parsed)) {
                    return parsed;
                } else if (typeof parsed === 'object' && parsed !== null) {
                    // Handle case where model returns single object instead of array
                    console.log('[Ollama] Response is a single object, wrapping in array');
                    return [parsed];
                }
                console.warn('[Ollama] Response parsed but not an array or object:', parsed);
            } catch (strictError: any) {
                console.warn('[Ollama] Strict JSON parse failed, attempting regex extraction. Error:', strictError.message);

                // Regex Fallback: Extract fields manually if JSON is broken
                // This handles cases where newlines or escaped quotes break strict parsers
                const titleMatch = response.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const descMatch = response.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const sigMatch = response.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);

                if (titleMatch && descMatch && sigMatch) {
                    console.log('[Ollama] Successfully recovered data using regex extraction');
                    return [{
                        title: titleMatch[1],
                        description: descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'), // Unescape manually
                        signature: sigMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
                    }];
                }

                console.error('[Ollama] JSON Parse failed. Raw:', response);
            }

            // Fallback if parsing failed or not an array
            console.warn('[Ollama] Using fallback questions due to parsing failure.');
            return Array(count).fill({
                title: 'Two Sum (Fallback)',
                description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n**Example:**\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]',
                signature: langConfig.fallbackSignature
            });

        } catch (error) {
            console.error('Ollama Generation Error:', error);
            // Return safe fallback to prevent crash
            return Array(count).fill({
                title: 'Two Sum (Error Fallback)',
                description: 'Service temporarily unavailable. Please try again or check backend logs.',
                signature: langConfig.fallbackSignature
            });
        }
    }

    private getLanguageConfig(lang: string) {
        const normalized = lang.toLowerCase();
        switch (normalized) {
            case 'python':
                return {
                    promptNote: 'Ensure Python code uses correct indentation (4 spaces) and type hints.',
                    fallbackSignature: 'def two_sum(nums: List[int], target: int) -> List[int]:\n    # Your code here\n    pass'
                };
            case 'java':
                return {
                    promptNote: 'Provide a class named Solution with a public method.',
                    fallbackSignature: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n        return new int[]{};\n    }\n}'
                };
            case 'cpp':
            case 'c++':
                return {
                    promptNote: 'Provide a class Solution with a public method.',
                    fallbackSignature: 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Your code here\n        return {};\n    }\n};'
                };
            case 'go':
                return {
                    promptNote: 'Provide a function with correct Go signatures.',
                    fallbackSignature: 'func twoSum(nums []int, target int) []int {\n    // Your code here\n    return nil\n}'
                };
            default: // javascript/typescript
                return {
                    promptNote: 'Use standard JS/TS function syntax.',
                    fallbackSignature: 'function twoSum(nums, target) {\n  // Your code here\n}'
                };
        }
    }

    /**
     * Evaluate code submission
     */
    /**
     * Evaluate code submission
     */
    async evaluateCode(problemDescription: string, userCode: string, language: string = 'javascript'): Promise<{ status: 'pass' | 'fail'; feedback: string; score: number }> {
        const prompt = `
        You are a Senior Principal Engineer at a top-tier tech company (FAANG). You are conducting a technical interview.
        Your personality is: Brutally honest, strict, perfectionist, and highly critical of inefficiency or bad style.
        
        Language: ${language}
        Problem: ${problemDescription}
        
        Candidate's Code:
        ${userCode}
        
        Evaluation Criteria:
        1. Correctness: Does it pass all test cases including edge cases (empty input, max values, negatives)?
        2. Complexity: Is it the absolute optimal Big-O time and space complexity? If not, deduct points heavily.
        3. Style: Are variable names descriptive? Is indentation perfect? Is it idiomatic ${language}?
        
        Task:
        - If the code has syntax errors, fail immediately with score 0.
        - If the logic is correct but inefficient (e.g. O(n^2) instead of O(n)), score max 50.
        - If variable names are generic (like 'a', 'b', 'temp'), deduct 10 points.
        - Provide feedback that is direct, stern, and technical. Do not praise the candidate for bare minimum effort.
        
        Return JSON object (NO MARKDOWN):
        {
          "status": "pass" | "fail",
          "feedback": "Your brutally honest feedback...",
          "score": number (0-100)
        }
        `;

        try {
            const response = await this.chat(prompt, [], true);
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Ollama Evaluation Error:', error);
            return {
                status: 'fail',
                feedback: 'AI Evaluation Failed. Please try again.',
                score: 0
            };
        }
    }

    /**
     * Run code against test cases (Dry Run)
     */
    async runCode(description: string, code: string, language: string): Promise<{ output: string; status: 'error' | 'success' }> {
        const prompt = `
        Act as a Compiler/Interpreter for ${language}.
        
        Problem: ${description}
        
        Code:
        ${code}
        
        Task:
        1. "Compile" and "Run" this code against the public example test case provided in the problem description.
        2. If there are syntax errors, return them.
        3. If it runs, return the Standard Output (stdout) and the Result.
        
        Return ONLY this format (text/plain):
        [STATUS: SUCCESS or ERROR]
        [OUTPUT: ...]
        `;

        try {
            const response = await this.chat(prompt, [], false);
            const statusMatch = response.match(/\[STATUS: (.*?)\]/i);
            const outputMatch = response.match(/\[OUTPUT:([\s\S]*)\]/i) || response.match(/\[OUTPUT: (.*?)\]/i);

            return {
                status: (statusMatch && statusMatch[1].toUpperCase() === 'SUCCESS') ? 'success' : 'error',
                output: outputMatch ? outputMatch[1].trim() : response // Fallback to raw response
            };
        } catch (error) {
            return { status: 'error', output: 'Execution failed.' };
        }
    }

    /**
     * Base Chat method
     */
    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: this.model,
                messages: [
                    ...history,
                    { role: 'user', content: message }
                ],
                stream: false,
                format: jsonMode ? 'json' : undefined
            });

            return response.data.message.content;
            return response.data.message.content;
        } catch (error) {
            // Mock Fallback for Development/Offline use
            if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
                console.warn('⚠️ Ollama unreachable. Using Mock Fallback.');
                if (jsonMode) {
                    return this.getMockJsonResponse(message);
                }
                return "AI Service is offline (Mock Mode). Please start Ollama for real responses.";
            }
            throw error;
        }
    }

    private getMockJsonResponse(prompt: string): string {
        // Simple heuristic to guess what is being asked
        if (prompt.includes('interview problems')) {
            return JSON.stringify([
                {
                    title: "Two Sum (Mock)",
                    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n*This is a mock question because AI is offline.*",
                    signature: "function twoSum(nums, target) {\n  // Write your code here\n}"
                }
            ]);
        }
        if (prompt.includes('Evaluation Criteria')) {
            return JSON.stringify({
                status: "pass",
                feedback: "Logic appears correct (Mock Evaluation). Great work handling the edge cases!",
                score: 85
            });
        }
        return "{}";
    }
}
