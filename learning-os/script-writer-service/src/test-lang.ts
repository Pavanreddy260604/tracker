
import { scriptGenerator } from './services/scriptGenerator.service';

const runTest = async () => {
    console.log("🚀 Testing Multilingual Generation (Telugu Transliterated)...\n");

    const request = {
        userId: "USER123", // Dummy ID
        idea: "Two friends fighting over the last samosa.",
        format: "reel" as const,
        style: "dialogue-driven" as const,
        genre: "Comedy",
        language: "Telugu" // Should trigger the "Enduku ra" style logic
    };

    console.log(`Prompting for: ${request.language} (${request.format})`);
    console.log("Waiting for stream...\n");

    try {
        let fullScript = "";

        for await (const chunk of scriptGenerator.generateScript(request)) {
            process.stdout.write(chunk); // Stream to console
            fullScript += chunk;
        }

        console.log("\n\n✅ Stream complete.");

        if (fullScript.length < 50) {
            console.error("❌ Error: Script seems too short.");
            process.exit(1);
        }

        // Manual visual check required by user to confirm "Enduku ra" style
        console.log("\nPLEASE VERIFY: Does the dialogue look like 'Enduku ra' style?");

    } catch (error) {
        console.error("\n❌ Generation Failed:", error);
        process.exit(1);
    }
};

runTest();
