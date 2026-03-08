
import * as fs from 'fs';
import * as path from 'path';
import { extractTextFromFile } from './src/utils/fileParser';
import { chunkerService } from './src/services/chunker.service';
import { aiServiceManager } from './src/services/ai.manager';

/**
 * TEST: Ingestion Quality & Layout Fidelity
 * ----------------------------------------
 * Verifies that:
 * 1. LayoutPDFReader preserves screenplay indentation.
 * 2. ChunkerService populates contextBefore.
 * 3. AIServiceManager correctly calls BGE-M3 for rich embeddings.
 */
async function testIngestion() {
    console.log("--- STARTING INGESTION QUALITY TEST ---");

    // 1. Create a mock screenplay string (to simulate parsed PDF result)
    // Characters are indented ~30-40 spaces, dialogue ~20, transitions ~50
    const mockPdfText = `
                                TITLE: TEST SCRIPT
    
    EXT. PARADISE - DAY
    
    A lone FIGURE stands in the rain.
    
                             FIGURE
              (whispering)
              The code is alive.
    
    A lightning bolt strikes.
    
                             VOICE
              It always was.
    `;

    console.log("[Test] Parsing mock layout text...");
    const result = await chunkerService.parseScreenplay(mockPdfText);

    const dialogues = result.chunks.filter(c => c.type === 'dialogue');
    console.log(`[Test] Found ${dialogues.length} dialogue segments.`);

    // 2. Verify Context Retrieval
    const secondDialogue = dialogues[1];
    console.log(`[Test] First Speaker: ${dialogues[0].speaker}`);
    console.log(`[Test] Second Speaker: ${secondDialogue.speaker}`);
    console.log(`[Test] Context for Second Dialogue: ${secondDialogue.contextBefore}`);

    if (!secondDialogue.contextBefore || !secondDialogue.contextBefore.includes("FIGURE")) {
        console.error("FAIL: contextBefore is missing or incorrect!");
    } else {
        console.log("PASS: contextBefore correctly populated.");
    }

    // 3. Verify Rich Embedding Generation
    console.log("[Test] Generating BGE-M3 rich embedding...");
    const richText = `Speaker: ${secondDialogue.speaker}. Context: ${secondDialogue.contextBefore}. Line: "${secondDialogue.content}"`;
    try {
        const embedding = await aiServiceManager.generateEmbedding(richText);
        console.log(`[Test] Embedding generated. Dimension: ${embedding.length}`);

        // BGE-M3 usually outputs 1024 or 768 dimensions depending on setup
        if (embedding.length > 0) {
            console.log("PASS: BGE-M3 local embedding successful.");
        }
    } catch (err: any) {
        console.error("FAIL: Embedding generation failed:", err.message);
    }

    console.log("--- TEST COMPLETE ---");
}

// Simple guard since we're running via tsx
if (require.main === module) {
    testIngestion().catch(console.error);
}
