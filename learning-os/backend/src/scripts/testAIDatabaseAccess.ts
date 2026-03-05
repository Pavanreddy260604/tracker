
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AIChatService } from '../services/aiChat.service.js';
import { UserActivity } from '../models/UserActivity.js';
import { User } from '../models/User.js';

dotenv.config();

// Mongoose specific configuration to handle stricter queries if needed but mainly connection
mongoose.set('strictQuery', false);

async function testAccess() {
    console.log("1. Connecting to DB...");
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');
        console.log("   Connected.");
    } catch (e) {
        console.error("DB Connection Failed:", e);
        process.exit(1);
    }

    // Find or create a test user
    let user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
        console.log("   Creating test user...");
        try {
            user = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                passwordHash: '$2a$12$GwF7.20s/jF/jF/jF/jF/jF/jF/jF/jF/jF/jF/examplehash', // valid bcrypt-like string or just any string if validation is loose
                roles: ['user']
            });
        } catch (uErr: any) {
            console.error("   User Creation Failed:", uErr.message);
            if (uErr.errors) console.error("   User Validation Errors:", JSON.stringify(uErr.errors, null, 2));
            process.exit(1);
        }
    }

    // Create a fresh activity log
    console.log("2. Creating test activity log...");
    try {
        await UserActivity.create({
            userId: user._id,
            type: 'navigation', // Valid enum value
            description: 'Visited the Secret Admin Panel at ' + new Date().toISOString(),
            metadata: { path: '/admin/secret' }, // Properly structured metadata
            timestamp: new Date()
        });
        console.log("   Activity created.");
    } catch (e: any) {
        console.error("   Failed to create activity:", e.message);
        if (e.errors) console.error("   Validation Errors:", JSON.stringify(e.errors, null, 2));
        process.exit(1);
    }

    // Instantiate AI with this user
    console.log("3. Initializing AI with Database Access...");
    // Use 'mistral' or whatever model is available locally. 
    // If 'mistral' fails, try 'llama3' or check what user has.
    const ai = new AIChatService('mistral', user._id.toString());

    // Ask question
    const question = "What was my last recorded activity on the system? Be specific.";
    console.log(`4. Asking AI (Ollama): "${question}"`);

    try {
        // We use the public chat method which should handle tools internally now
        const answer = await ai.chat(question);
        console.log("\n--- AI RESPONSE ---");
        console.log(answer);
        console.log("-------------------");
    } catch (err: any) {
        console.error("AI Failed. Make sure Ollama is running (ollama serve). Error:", err.message);
    } finally {
        await mongoose.disconnect();
    }
}

testAccess();
