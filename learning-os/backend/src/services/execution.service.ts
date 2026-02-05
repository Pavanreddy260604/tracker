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
    private resultMarker = '__RESULT__';

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
        const runtime = langMap[language.toLowerCase()];
        if (!runtime) {
            throw new Error(`Unsupported language: ${language}`);
        }
        return runtime;
    }

    /**
     * Execute code generically
     */
    async execute(language: string, code: string, stdin: string = ''): Promise<PistonResponse> {
        const runtime = this.getRuntime(language);

        if (code.length > 50_000) {
            throw new Error('Code payload too large (50k char limit).');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/execute`, {
                language: runtime.language,
                version: runtime.version,
                files: [
                    { content: code }
                ],
                stdin: stdin
            }, { timeout: 10000 }); // INFRA: 10s Timeout limit to prevent hanging processes
            return response.data;
        } catch (error: any) {
            console.error('Piston Execution Error:', error.message);
            throw new Error('Code execution unavailable. Please try again.');
        }
    }

    /**
     * Execute user code with provided raw input and return extracted output.
     */
    async executeWithInput(
        language: string,
        userCode: string,
        input: string
    ): Promise<{ actual: string; stdout: string; error?: string }> {
        const args = this.parseInputArgs(input);
        const runnableCode = this.wrapCode(language, userCode, args);
        const result = await this.execute(language, runnableCode, input);

        if (result.run.code !== 0) {
            return {
                actual: this.extractActualOutput(result.run.stdout),
                stdout: result.run.stdout,
                error: result.run.stderr || result.run.output || 'Runtime Error'
            };
        }

        const actualOutput = this.extractActualOutput(result.run.stdout);
        return { actual: actualOutput, stdout: result.run.stdout };
    }

    /**
     * Run a specific test case check (Boilerplate injection usually needed here)
     * For MVP, we will rely on the user writing code that reads stdin or we wrap it.
     * LeetCode style: we wrap the user function with a main runner.
     */
    async runTest(
        language: string,
        userCode: string,
        testCase: { input: string; expected: string }
    ): Promise<{ passed: boolean; actual: string; error?: string }> {
        const result = await this.executeWithInput(language, userCode, testCase.input);

        if (result.error) {
            return { passed: false, actual: result.actual, error: result.error };
        }

        const passed = this.compareOutputs(result.actual, testCase.expected);
        return { passed, actual: result.actual };
    }

    private wrapCode(language: string, userCode: string, args: any[]): string {
        // Enterprise Grade: Dynamic Function Wrapper
        // Instead of hardcoding 'twoSum', we find the function definition in the user code.

        // Match function name: 
        // JS: function name(...) or const name = (...)
        // Py: def name(...):

        if (language === 'javascript') {
            const funcMatch = userCode.match(/function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*function|const\s+(\w+)\s*=\s*\(/);
            const funcName = funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3]) : 'solution';

            const argsJson = JSON.stringify(args ?? []);
            const marker = this.resultMarker;

            return `
${userCode}

// Enterprise Runner
try {
    const args = ${argsJson};
    const result = ${funcName}(...args);
    let serialized;
    try {
        serialized = JSON.stringify(result);
        if (serialized === undefined) serialized = String(result);
    } catch (e) {
        serialized = String(result);
    }
    console.log("${marker}" + serialized);
} catch (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exit(1);
}
`;
        }

        if (language === 'python') {
            const funcMatch = userCode.match(/def\s+(\w+)\s*\(/);
            const funcName = funcMatch ? funcMatch[1] : 'solution';

            const argsJson = JSON.stringify(args ?? []);
            const argsJsonLiteral = JSON.stringify(argsJson);
            const marker = this.resultMarker;

            return `
import json
import sys
from typing import *

${userCode}

def _serialize(value):
    try:
        return json.dumps(value)
    except Exception:
        return str(value)

# Enterprise Runner
if __name__ == '__main__':
    try:
        args = json.loads(${argsJsonLiteral})

        if '${funcName}' in locals():
            result = ${funcName}(*args)
            print("${marker}" + _serialize(result))
        else:
            print("Function '${funcName}' not found", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
`;
        }

        return userCode;
    }

    private parseInputArgs(input: string): any[] {
        if (!input) return [];
        const lines = input
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        if (lines.length === 0) return [];

        return lines.map((line) => {
            const parsed = this.safeJsonParse(line);
            return parsed.ok ? parsed.value : line;
        });
    }

    private safeJsonParse(value: string): { ok: boolean; value: any } {
        try {
            return { ok: true, value: JSON.parse(value) };
        } catch (error) {
            return { ok: false, value };
        }
    }

    private extractActualOutput(stdout: string): string {
        if (!stdout) return '';
        const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            const line = lines[i];
            if (line.includes(this.resultMarker)) {
                return line.split(this.resultMarker).pop()?.trim() || '';
            }
        }
        return stdout.trim();
    }

    private normalizeOutput(raw: string): { raw: string; parsed: any; isJson: boolean } {
        const trimmed = raw.trim();
        if (!trimmed) return { raw: '', parsed: '', isJson: false };

        const parsed = this.safeJsonParse(trimmed);
        if (parsed.ok) {
            return { raw: trimmed, parsed: parsed.value, isJson: true };
        }

        return { raw: trimmed, parsed: trimmed, isJson: false };
    }

    private compareOutputs(actual: string, expected: string): boolean {
        const actualNormalized = this.normalizeOutput(actual);
        const expectedNormalized = this.normalizeOutput(expected);

        if (actualNormalized.isJson && expectedNormalized.isJson) {
            return this.deepEqual(actualNormalized.parsed, expectedNormalized.parsed);
        }

        return actualNormalized.raw === expectedNormalized.raw;
    }

    private deepEqual(a: any, b: any): boolean {
        if (a === b) return true;

        if (Number.isNaN(a) && Number.isNaN(b)) return true;

        if (typeof a !== typeof b) return false;

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i += 1) {
                if (!this.deepEqual(a[i], b[i])) return false;
            }
            return true;
        }

        if (a && b && typeof a === 'object' && typeof b === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            for (const key of keysA) {
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            return true;
        }

        return false;
    }
}
