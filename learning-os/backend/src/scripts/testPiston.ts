import { ExecutionService } from '../services/execution.service.js';

const runTest = async () => {
    const executor = new ExecutionService();
    console.log("🚀 Testing Piston Integration...");

    // Test 1: Simple execution
    console.log("\n1. Simple Console Log (JS)");
    const res1 = await executor.execute('javascript', 'console.log("Hello Piston")');
    console.log(`Result: ${res1.run.stdout.trim()} (Expected: Hello Piston)`);

    // Test 2: Two Sum Wrapper (JS)
    console.log("\n2. Two Sum Wrapper (JS)");
    const codeJS = `
    function twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
            const complement = target - nums[i];
            if (map.has(complement)) {
                return [map.get(complement), i];
            }
            map.set(nums[i], i);
        }
        return [];
    }
    `;
    const inputJS = "[2,7,11,15]\n9";
    // Wrapper logic in service expects arguments separated by comma/newline trick
    // My quick wrapper logic in execution.service.ts was: input.replace(/\n/g, ',')
    // So "[2,7,11,15]\n9" -> "[2,7,11,15],9"

    // Let's test the wrapCode logic indirectly via runTest logic (but we can't access private)
    // Actually, `runTest` calls `wrapCode`.
    const testResult = await executor.runTest('javascript', codeJS, { input: inputJS, expected: '[0,1]' });
    console.log(`Pass: ${testResult.passed} | Output: ${testResult.actual}`);

    // Test 3: Python Wrapper
    console.log("\n3. Valid Parentheses (Python)");
    const codePy = `
def isValid(s: str) -> bool:
    stack = []
    map = {")": "(", "}": "{", "]": "["}
    for char in s:
        if char in map:
            top = stack.pop() if stack else '#'
            if map[char] != top:
                return False
        else:
            stack.append(char)
    return not stack
    `;
    const inputPy = '"()"';
    const testResultPy = await executor.runTest('python', codePy, { input: inputPy, expected: 'true' });
    console.log(`Pass: ${testResultPy.passed} | Output: ${testResultPy.actual}`);
};

runTest();
