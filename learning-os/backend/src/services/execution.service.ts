import axios from 'axios';

interface PistonResponse {
    language: string;
    version: string;
    run: {
        stdout: string;
        stderr: string;
        output: string;
        code: number;
        signal: string | null;
    };
}

export class ExecutionService {
    private baseUrl = 'https://emkc.org/api/v2/piston';

    /**
     * Map internal language names to Piston runtime names
     */
    private getRuntime(language: string): { language: string, version: string } {
        const langMap: Record<string, { language: string, version: string }> = {
            'javascript': { language: 'javascript', version: '18.15.0' },
            'typescript': { language: 'typescript', version: '5.0.3' },
            'python': { language: 'python', version: '3.10.0' },
            'java': { language: 'java', version: '15.0.2' },
            'cpp': { language: 'c++', version: '10.2.0' },
            'go': { language: 'go', version: '1.16.2' }
        };
        return langMap[language.toLowerCase()] || langMap['javascript'];
    }

    /**
     * Execute code generically
     */
    async execute(language: string, code: string, stdin: string = ''): Promise<PistonResponse> {
        const runtime = this.getRuntime(language);

        try {
            const response = await axios.post(`${this.baseUrl}/execute`, {
                language: runtime.language,
                version: runtime.version,
                files: [
                    { content: code }
                ],
                stdin: stdin
            });
            return response.data;
        } catch (error: any) {
            console.error('Piston Execution Error:', error.message);
            throw new Error('Code execution unavailable. Please try again.');
        }
    }

    /**
     * Run a specific test case check (Boilerplate injection usually needed here)
     * For MVP, we will rely on the user writing code that reads stdin or we wrap it.
     * LeetCode style: we wrap the user function with a main runner.
     */
    async runTest(language: string, userCode: string, testCase: { input: string, expected: string }): Promise<{ passed: boolean, actual: string, error?: string }> {
        // We need language specific wrappers to call the function with input
        // This is complex for a full system. 
        // SIMPLIFICATION: We will assume the user code + a runner script.

        // Construct the full runnable code based on language
        const runnableCode = this.wrapCode(language, userCode, testCase.input);

        const result = await this.execute(language, runnableCode);

        if (result.run.code !== 0) {
            return { passed: false, actual: '', error: result.run.stderr };
        }

        const actualOutput = result.run.stdout.trim();
        const expectedOutput = testCase.expected.trim();

        // Weak equality check (ignoring trailing newlines)
        return {
            passed: actualOutput === expectedOutput,
            actual: actualOutput
        };
    }

    private wrapCode(language: string, userCode: string, input: string): string {
        // Enterprise Grade: Dynamic Function Wrapper
        // Instead of hardcoding 'twoSum', we find the function definition in the user code.

        // Match function name: 
        // JS: function name(...) or const name = (...)
        // Py: def name(...):

        if (language === 'javascript') {
            const funcMatch = userCode.match(/function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*function|const\s+(\w+)\s*=\s*\(/);
            const funcName = funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3]) : 'solution';

            // Handle array inputs correctly for Apply (e.g. twoSum(arr, target)) vs Single (isValid(s))
            // This is tricky without metadata. We'll try to spread if looks like array, else single.
            // BETTER: AI Questions usually come with a wrapper template.
            // For now, let's look at the input format.
            // If input contains multiple args separated by valid commas OUTSIDE brackets, it's multiple.
            // But test case input is just a string. 
            // We will assume the input string is a valid JS Array of arguments [arg1, arg2]

            return `
${userCode}

// Enterprise Runner
try {
    const args = ${input.startsWith('[') ? input : `[${input}]`};
    const result = ${funcName}(...args);
    console.log(JSON.stringify(result));
} catch (e) {
    console.log("Error: " + e.message);
    process.exit(1);
}
`;
        }

        if (language === 'python') {
            const funcMatch = userCode.match(/def\s+(\w+)\s*\(/);
            const funcName = funcMatch ? funcMatch[1] : 'solution';

            return `
import json
import sys
from typing import *

${userCode}

# Enterprise Runner
if __name__ == '__main__':
    try:
        # Piston stdin handling or mocked input string
        # We inject input directly
        args = [${input.replace(/\n/g, ',')}]
        
        # Call dynamically
        if '${funcName}' in locals():
            result = ${funcName}(*args)
            print(json.dumps(result))
        else:
            print("Error: Function '${funcName}' not found", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Runtime Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
`;
        }

        return userCode;
    }
}
