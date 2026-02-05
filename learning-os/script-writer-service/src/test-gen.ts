
import { scriptGenerator } from './services/scriptGenerator.service';

const runTest = async () => {
    console.log("🚀 Testing Script Generation (Ollama Connection)...\n");

    const request = {
        userId: "USER123", // Dummy ID needed for ScriptRequest validation
        idea: "A time traveler tries to prevent a sandwich from falling.",
        format: "reel" as const, // Shortest format for quick test
        style: "nolan" as const,
        genre: "Sci-Fi"
    };

    console.log(`Prompting for: ${request.format} in style of ${request.style}`);
    console.log("Waiting for stream...\n");

    try {
        let fullScript = "";

        for await (const chunk of scriptGenerator.generateScript(request)) {
            process.stdout.write(chunk); // Stream to console
            fullScript += chunk;
        }

        console.log("\n\n✅ Stream complete.");

        if (fullScript.length < 50) {
            console.error("❌ Error: Script seems too short. Something might be wrong.");
            process.exit(1);
        }

    } catch (error) {
        console.error("\n❌ Generation Failed:", error);
        process.exit(1);
    }
};

runTest();
