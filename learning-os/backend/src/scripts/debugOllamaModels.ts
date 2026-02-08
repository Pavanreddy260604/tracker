
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const modelsToTest = [
    'deepseek-v3.1:671b-cloud',
    'gpt-oss:120b-cloud',
    'glm-4.6:cloud',
    'qwen3-coder:480b-cloud',
    'gemma3:4b',
    'tinyllama:latest',
    'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest'
];

async function testModel(model: string) {
    console.log(`\nTesting Model: ${model}...`);
    try {
        const start = Date.now();
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: model,
            prompt: "Say 'OK'",
            stream: false,
            options: { num_predict: 5 } // Keep it very short
        }, { timeout: 10000 }); // 10s timeout

        const duration = Date.now() - start;
        console.log(`✅ SUCCESS (${duration}ms): ${response.data.response.trim()}`);
        return true;
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`❌ CONNECTION FAILED: Is Ollama running at ${OLLAMA_URL}?`);
            process.exit(1);
        }

        const status = error.response?.status;
        const msg = error.response?.data?.error || error.message;
        console.error(`❌ FAILED (Status ${status}): ${msg}`);
        return false;
    }
}

async function runDebug() {
    console.log(`Debugging Ollama Connectivity at ${OLLAMA_URL}`);
    console.log("------------------------------------------------");

    // 1. Check Version (Health Check)
    try {
        const v = await axios.get(`${OLLAMA_URL}/api/version`);
        console.log(`Ollama Version: ${v.data.version}`);
    } catch (e) {
        console.error("Critical: Could not reach Ollama /api/version");
    }

    // 2. Test Models
    for (const model of modelsToTest) {
        await testModel(model);
    }
}

runDebug();
