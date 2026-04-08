import { ChromaClient } from "chromadb";
import * as dotenv from "dotenv";
import * as path from "path";

// Load backend .env
dotenv.config({ path: path.join(__dirname, "../.env") });

async function purgeStaleCollection() {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    const client = new ChromaClient({ path: chromaUrl });
    const COLLECTION_NAME = "learning_os_knowledge";

    console.log(`[Purge] Connecting to ChromaDB at ${chromaUrl}...`);
    
    try {
        await client.deleteCollection({ name: COLLECTION_NAME });
        console.log(`[Purge] Successfully deleted collection: ${COLLECTION_NAME}`);
        console.log(`[Purge] It will be re-created with dimension 1024 on next use.`);
    } catch (error: any) {
        if (error.message?.includes("does not exist")) {
            console.log(`[Purge] Collection ${COLLECTION_NAME} did not exist. No action needed.`);
        } else {
            console.error(`[Purge] Failed to delete collection:`, error.message);
        }
    }
}

purgeStaleCollection();
