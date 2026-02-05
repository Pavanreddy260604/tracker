
import axios from 'axios';

const runTest = async () => {
    console.log("🚀 Testing API Endpoint (POST /generate)...\n");

    try {
        const response = await axios.post('http://localhost:5001/api/script/generate', {
            userId: "USER123", // Dummy ID for validation
            idea: "A cat that can fly",
            format: "reel",
            style: "anderson",
            language: "English"
        }, {
            responseType: 'stream'
        });

        console.log("Connected to stream. Receiving data:\n");

        response.data.on('data', (chunk: Buffer) => {
            process.stdout.write(chunk.toString());
        });

        response.data.on('end', () => {
            console.log("\n\n✅ API Stream complete.");
        });

    } catch (error: any) {
        console.error("\n❌ API Request Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
};

// Wait a bit for server to start if running immediately after
setTimeout(runTest, 2000);
