
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Hack for __dirname in ESM if needed, but we are just running with ts-node or node
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function listModels() {
    console.log('API Key present:', !!process.env.GOOGLE_API_KEY);
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('No GOOGLE_API_KEY found in environment');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // For listing models, we might need to use a different method if not directly exposed on genAI instance in older SDKs,
    // but typically it's strictly correct model names we need.
    // The SDK itself implies we might just try commonly known valid models if list is hard, 
    // but let's try to verify if we can fetch them.
    // Actually, the node SDK might not have a helper for listing models directly on the top class in all versions.
    // Let's rely on the error message suggestion "Call ListModels".
    // Since the SDK wraps the API, if the SDK doesn't expose it, we can curl.

    console.log('Checking commonly known models...');
    const modelsToCheck = [
        // Gemini 2.5 (Experimental/Preview)
        'gemini-2.5-pro',
        'gemini-2.5-pro-preview-05-06',
        'gemini-2.5-flash',

        // Gemini 2.0 (Stable/Exp)
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.0-pro-exp-02-05',

        // Gemini 1.5 (Stable)
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-8b',

        // Legacy
        'gemini-pro',
        'gemini-1.0-pro'
    ];

    for (const modelName of modelsToCheck) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.countTokens('Hello world');
            console.log(`✅ Model available: ${modelName}`);
        } catch (error: any) {
            console.log(`❌ Model unavailable: ${modelName}`);
            console.log(`   Reason: ${error.message}`);
        }
    }
}

listModels();
