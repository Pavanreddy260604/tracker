import axios from 'axios';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { BackendTopic } from '../models/BackendTopic.js';
import { RoadmapNode } from '../models/RoadmapNode.js';
import { RoadmapEdge } from '../models/RoadmapEdge.js';
import { UserActivity } from '../models/UserActivity.js';

/**
 * Custom error class for AI service failures.
 * Allows frontend to distinguish between recoverable and non-recoverable errors.
 */
export class AIServiceError extends Error {
    public readonly recoverable: boolean;
    public readonly cause?: Error;
    public readonly context?: string;

    constructor(message: string, options: { recoverable?: boolean; cause?: Error; context?: string } = {}) {
        super(message);
        this.name = 'AIServiceError';
        this.recoverable = options.recoverable ?? true;
        this.cause = options.cause;
        this.context = options.context;
    }
}

export class OllamaService {
    private baseUrl: string;
    private primaryModel: string;
    private fallbackModels: string[];
    private userId?: string;

    constructor(model?: string, userId?: string) {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        // User Preference: Deepseek -> GPT-OSS -> Others -> Small Models
        this.primaryModel = model || process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';
        this.userId = userId;

        // Defined fallback chain based on user preference
        this.fallbackModels = [
            'gpt-oss:120b-cloud',       // 2nd Choice
            'glm-4.6:cloud',            // 3rd Choice
            'qwen3-coder:480b-cloud',   // 4th Choice

            // Smaller / Local Models (Last Resort)
            'gemma3:4b',
            'tinyllama:latest',
            'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest'
        ];
    }

    private async wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async makeRequest(endpoint: string, payload: any, retries = 3): Promise<any> {
        // Create full list of models to try: Primary -> Fallbacks
        // Use a Set to avoid duplicates if primary is also in fallback list
        const modelsToTry = Array.from(new Set([this.primaryModel, ...this.fallbackModels]));

        for (const model of modelsToTry) {
            console.log(`[OllamaService] Attempting with model: ${model}`);

            // Retry loop for the CURRENT model (handling temporary glitches/rate limits)
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    // Update payload with current model
                    const currentPayload = { ...payload, model };
                    return await axios.post(`${this.baseUrl}${endpoint}`, currentPayload);
                } catch (error: any) {
                    if (axios.isAxiosError(error) && error.response) {
                        const status = error.response.status;

                        // If it's a Rate Limit (429) or Service Unavailable (503), WAIT and RETRY same model
                        if ((status === 429 || status === 503) && attempt < retries) {
                            const delay = attempt * 2000;
                            console.warn(`[Ollama] ${model} Busy (Status ${status}). Retrying in ${delay}ms...`);
                            await this.wait(delay);
                            continue;
                        }
                    }

                    // Specific error handling for "model not found" (404) -> Break retry loop immediately to try next model
                    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
                        console.warn(`[Ollama] Model ${model} not found. Switching to next model...`);
                        break; // Break inner loop, effectively going to next model in outer loop
                    }

                    // If max retries reached for this model, break inner loop to try next model
                    if (attempt === retries) {
                        console.warn(`[Ollama] Model ${model} failed after ${retries} attempts. Switching to next model...`);
                    }
                }
            }
        }

        throw new Error('All AI models failed to respond.');
    }

    async generateResponse(prompt: string): Promise<string> {
        try {
            const response = await this.makeRequest('/api/generate', {
                prompt: prompt,
                stream: false
            });
            return response.data.response;
        } catch (error: any) {
            console.error('Ollama Chat Error:', error.message);
            return "I'm having trouble thinking right now. Please check if my brain (Ollama) is running.";
        }
    }

    async *generateResponseStream(prompt: string): AsyncGenerator<string, void, unknown> {
        // Legacy wrapper for single-prompt streaming
        yield* this.generateChatStream([{ role: 'user', content: prompt }]);
    }

    async *generateChatStream(messages: { role: string; content: string }[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
        const modelsToTry = Array.from(new Set([this.primaryModel, ...this.fallbackModels]));

        for (const model of modelsToTry) {
            console.log(`[OllamaStream] Attempting with model: ${model}`);
            try {
                const payload: any = {
                    model: model,
                    messages: messages,
                    stream: true
                };

                if (systemPrompt) {
                    // Prepend system prompt if provided
                    payload.messages = [{ role: 'system', content: systemPrompt }, ...messages];
                }

                const response = await axios.post(`${this.baseUrl}/api/chat`, payload, {
                    responseType: 'stream',
                    timeout: 60000 // 60s timeout for model loading
                });

                console.log(`[OllamaStream] Success with model: ${model}`); // DEBUG: Confirm which model worked

                // If successful, yield the stream
                for await (const chunk of response.data) {
                    const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            // Ollama /api/chat returns 'message.content'
                            if (json.message && json.message.content) {
                                yield json.message.content;
                            }
                            if (json.done) return;
                        } catch (parseError) {
                            // Log incomplete JSON chunks for debugging but continue streaming
                            console.debug('[OllamaStream] Skipping incomplete JSON chunk');
                        }
                    }
                }
                // If stream finishes normally, return.
                return;

            } catch (error: any) {
                console.warn(`[OllamaStream] Model ${model} failed: ${error.message}`);
                // If this was the last model, yield error
                if (model === modelsToTry[modelsToTry.length - 1]) {
                    console.error('All AI models failed to stream.');
                    yield "I'm having trouble connecting to my brain (Ollama). Please check if local LLM is running.";
                }
                // Otherwise continue to next model
            }
        }
    }

    async generateQuestions(count: number, difficulty: string, topics: string[], language: string = 'javascript'): Promise<any[]> {
        return this.generateQuestionsInternal(count, difficulty, topics, language);
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

    private async generateQuestionsInternal(count: number, difficulty: string, topics: string[], language: string = 'javascript'): Promise<any[]> {
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
        - Do not output any text before or after the JSON.
        - Do not wrap the JSON in markdown code blocks.
        - ${langConfig.promptNote}`;

        try {
            console.log(`[Ollama] Generating questions...`);
            const response = await this.chat(prompt, [], true);

            // ... (Existing parsing logic) ...
            let jsonStr = response.trim();
            const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (arrayMatch) jsonStr = arrayMatch[0];
            else {
                const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (objectMatch) jsonStr = objectMatch[0];
                else jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) return parsed;
                if (typeof parsed === 'object' && parsed !== null) return [parsed];
            } catch (e) {
                // Regex fallback
                const titleMatch = response.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const descMatch = response.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                const sigMatch = response.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (titleMatch && descMatch && sigMatch) {
                    return [{
                        title: titleMatch[1],
                        description: descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                        signature: sigMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
                    }];
                }
            }

            // Instead of silent fallback, throw structured error so UI can show retry button
            console.error('[Ollama] Question generation failed: invalid response format');
            throw new AIServiceError(
                'Failed to generate interview questions. AI returned invalid format.',
                { recoverable: true, context: 'question_generation' }
            );

        } catch (error) {
            console.error('[Ollama] Question generation error:', error);
            throw new AIServiceError(
                'Failed to generate interview questions. AI service unavailable.',
                { recoverable: true, cause: error as Error, context: 'question_generation' }
            );
        }
    }

    async analyzeCode(problemDescription: string, userCode: string, language: string, correctnessScore: number): Promise<{ feedback: string; complexityAnalysis: string }> {
        // Re-implementing to ensure it uses the new architecture (implicit via chat() or makeRequest)
        const prompt = `Analyze this code... (shortened for brevity)`;
        // Actually, I should just let the original analyzeCode stand if I can, but I am replacing a huge chunk.
        // Let's implement it to be safe.
        return this.analyzeCodeInternal(problemDescription, userCode, language, correctnessScore);
    }

    private async analyzeCodeInternal(problemDescription: string, userCode: string, language: string, correctnessScore: number): Promise<{ feedback: string; complexityAnalysis: string }> {
        const prompt = `You are a Senior Principal Engineer. Code Verification: ${correctnessScore}%. Language: ${language}. Problem: ${problemDescription}. Code: ${userCode}. Analyze Time/Space complexity and style. Return JSON { "feedback": "...", "complexityAnalysis": "..." }`;
        try {
            const response = await this.chat(prompt, [], true);
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('[Ollama] Code analysis error:', error);
            throw new AIServiceError(
                'Failed to analyze code. Please try again.',
                { recoverable: true, cause: error as Error, context: 'code_analysis' }
            );
        }
    }

    async runCode(description: string, code: string, language: string): Promise<{ output: string; status: 'error' | 'success' }> {
        const prompt = `Compiler/Interpreter for ${language}. Problem: ${description}. Code: ${code}. Run it against example. Return [STATUS: ...] [OUTPUT: ...]`;
        try {
            const response = await this.chat(prompt, [], false);
            const statusMatch = response.match(/\[STATUS: (.*?)\]/i);
            const outputMatch = response.match(/\[OUTPUT:([\s\S]*)\]/i) || response.match(/\[OUTPUT: (.*?)\]/i);
            return {
                status: (statusMatch && statusMatch[1].toUpperCase() === 'SUCCESS') ? 'success' : 'error',
                output: outputMatch ? outputMatch[1].trim() : response
            };
        } catch (error) {
            console.error('[Ollama] Code execution error:', error);
            // Keep this as a return (not throw) since execution errors are expected sometimes
            return { status: 'error', output: `Execution failed: ${(error as Error).message || 'Unknown error'}` };
        }
    }

    async chat(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        return this.chatInternal(message, history, jsonMode);
    }

    private async chatInternal(message: string, history: any[] = [], jsonMode: boolean = false): Promise<string> {
        try {
            const tools = this.getToolsDefinition();
            const payload: any = {
                messages: [
                    ...history,
                    { role: 'user', content: message }
                ],
                stream: false,
                format: jsonMode ? 'json' : undefined,
                tools: (this.userId && !jsonMode) ? tools : undefined // Only use tools if userId is present and not in strict JSON mode
            };

            const response = await this.makeRequest('/api/chat', payload);
            const responseMsg = response.data.message;

            // Handle Tool Calls if present
            if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
                console.log(`[Ollama] Tool calls detected:`, responseMsg.tool_calls.length);

                // Add assistant's tool call message to history
                const newHistory = [
                    ...history,
                    { role: 'user', content: message },
                    responseMsg // The message containing tool_calls
                ];

                // Execute tools
                for (const toolCall of responseMsg.tool_calls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = toolCall.function.arguments;

                    const toolResult = await this.executeTool(functionName, functionArgs);

                    // Add tool result to history
                    newHistory.push({
                        role: 'tool',
                        content: JSON.stringify(toolResult),
                        name: functionName
                    });
                }

                // Call LLM again with tool results
                const followUpResponse = await this.makeRequest('/api/chat', {
                    messages: newHistory,
                    stream: false
                });
                return followUpResponse.data.message.content;
            }

            return responseMsg.content;
        } catch (error) {
            console.error('[Ollama] Chat error after all model attempts:', error);
            throw new AIServiceError(
                'AI Service is currently unavailable. All models failed to respond.',
                { recoverable: true, cause: error as Error, context: 'chat' }
            );
        }
    }

    // --- System Awareness Tools ---
    private getToolsDefinition() {
        return [
            {
                type: 'function',
                function: {
                    name: 'getRecentLogs',
                    description: 'Get the user\'s daily activity logs for the last N days.',
                    parameters: {
                        type: 'object',
                        properties: {
                            days: { type: 'number', description: 'Number of days to look back' }
                        },
                        required: ['days']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'getUserActivity',
                    description: 'Get high-resolution system activity (clicks, navigation) for the last N minutes.',
                    parameters: {
                        type: 'object',
                        properties: {
                            minutes: { type: 'number', description: 'Minutes to look back' }
                        },
                        required: ['minutes']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'getDSAStats',
                    description: 'Get statistics about solved DSA problems.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'Topic filter' },
                            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'getRoadmap',
                    description: 'Get the user\'s learning roadmap.',
                    parameters: { type: 'object', properties: {} }
                }
            }
        ];
    }

    private async executeTool(name: string, args: any): Promise<any> {
        if (!this.userId) return { error: "User context missing" };
        console.log(`[Ollama-Tool] Executing ${name}`, args);

        try {
            switch (name) {
                case "getRecentLogs":
                    const limit = args.days || 7;
                    return await DailyLog.find({ userId: this.userId }).sort({ date: -1 }).limit(limit).lean();

                case "getUserActivity":
                    const minutes = args.minutes || 10;
                    const since = new Date(Date.now() - minutes * 60 * 1000);
                    return await UserActivity.find({
                        userId: this.userId,
                        timestamp: { $gte: since }
                    }).sort({ timestamp: -1 }).limit(20).lean();

                case "getDSAStats":
                    const query: any = { userId: this.userId, status: 'solved' };
                    if (args.topic) query.topic = new RegExp(args.topic, 'i');
                    if (args.difficulty) query.difficulty = args.difficulty;
                    const count = await DSAProblem.countDocuments(query);
                    const problems = await DSAProblem.find(query).select('problemName difficulty topic date').limit(5).lean();
                    return { totalSolved: count, recent: problems };

                case "getRoadmap":
                    const [nodes, edges] = await Promise.all([
                        RoadmapNode.find({ userId: this.userId }).lean(),
                        RoadmapEdge.find({ userId: this.userId }).lean()
                    ]);
                    return { nodes, edges };

                default:
                    return { error: "Tool not found" };
            }
        } catch (error: any) {
            console.error(`[Ollama-Tool] Error executing ${name}:`, error);
            return { error: error.message };
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
    /**
     * Generate a FULL curated question to be saved in the database.
     * This is used by the seed/generation script, not during the interview.
     */
    async generateCuratedQuestion(difficulty: string, topics: string[]): Promise<any> {
        const prompt = `
        Create a UNIQUE coding interview problem.
        Difficulty: ${difficulty}
        Topics: ${topics.join(', ') || 'General Algorithms'} (Mix these concepts if possible)
        
        Provide the response in STRICT JSON format matching this structure:
        {
            "title": "Problem Title",
            "slug": "problem-title-slug",
            "description": "Markdown description of the problem...",
            "difficulty": "${difficulty}",
            "topics": ${JSON.stringify(topics)}, 
            "templates": {
                "javascript": "// Function signature...",
                "python": "# Function signature..."
            },
            "testCases": [
                { "input": "...", "expectedOutput": "...", "isHidden": false },
                { "input": "...", "expectedOutput": "...", "isHidden": false },
                { "input": "...", "expectedOutput": "...", "isHidden": true }
            ]
        }
        
        IMPORTANT Requirements:
        1. "templates" MUST contain valid boilerplate code.
        2. "testCases" MUST be valid. Input should be stringified if it's an array/object.
        3. "slug" should be URL-safe (kebab-case).
        4. "description" should include examples.
        5. DO NOT return "Two Sum" or "Fibonacci". Be creative but standard.
        `;

        try {
            const response = await this.chat(prompt, [], true);
            // Robust JSON extraction
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            // Find first { and last }
            const start = jsonStr.indexOf('{');
            const end = jsonStr.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error("Invalid JSON");

            return JSON.parse(jsonStr.substring(start, end + 1));
        } catch (error) {
            console.error('Ollama Generation Error:', error);
            return null;
        }
    }
}
