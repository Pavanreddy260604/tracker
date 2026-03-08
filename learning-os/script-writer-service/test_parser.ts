import { chunkerService } from './src/services/chunker.service';

async function runTest() {
    console.log("=== UNIVERSAL HEURISTIC PARSER STRESS TEST ===");

    // Sample 1: Left-Aligned (Common in plain text exports)
    const samplePage = `
INT. SPACESHIP - DAY

The spaceship lands. 
Ranbir emerges from with the smoke. He too has a manka around
his neck. He looks around the place with curiosity.

PK
Chal bhai log.. Are dara nahi..
chala chala.

PK emerges from the smoke as well.

PK (CONT'D)
Aisa tukkur tukkur ka dekhat ho?

RANBIR
Humra ek tho sawaal hai..

PK
Ka?

RANBIR
Tohaar last tame ihaan kittat baar
dhulai hua tha ?

Ranbir turns around and heads towards the spaceship
PK Stops him

PK
Aree uhaan kahan jaat ho? Ihaan
chala..

RANBIR
Lull saala..

End credits
144.
    `;

    // Sample 2: Professional Indentation (Final Draft Style)
    const indentedSample = `
INT. OFFICE - DAY

The Boss sits at his desk.

                    BOSS
          Where is the report?

                    CLERK
          (nervous)
          I forgot it, sir.

The Boss sighs.
    `;

    console.log("\n--- Testing Left-Aligned Sample ---");
    const result1 = await chunkerService.parseScreenplay(samplePage);
    console.log(`Dialogue Chunks: ${result1.stats.dialogueCount}`);
    result1.chunks.filter(c => c.type === 'dialogue').slice(0, 5).forEach(c => console.log(`[${c.speaker}] ${c.content}`));

    console.log("\n--- Testing Indented Sample (Layout-Aware) ---");
    const result2 = await chunkerService.parseScreenplay(indentedSample);
    console.log(`Dialogue Chunks: ${result2.stats.dialogueCount}`);
    result2.chunks.filter(c => c.type === 'dialogue').slice(0, 5).forEach(c => console.log(`[${c.speaker}] ${c.content}`));

    // Simulate 1,000 pages (~50,000 lines of text)
    // 100,000 pages would literally crash V8 string memory limits in a quick test script,
    // so we'll test 10,000 pages to prove it can handle massive enterprise loads.
    const PAGE_COUNT = 10000;
    console.log("Generating " + PAGE_COUNT + " page script...");
    const massiveScript = Array(PAGE_COUNT).fill(samplePage).join('\n');
    console.log("Generated " + massiveScript.length.toLocaleString() + " characters of text.");

    console.log("\nStarting Universal Heuristic Parsing...");
    const startTime = Date.now();

    const result = await chunkerService.parseScreenplay(massiveScript);

    const endTime = Date.now();
    console.log("\n=== RESULTS ===");
    console.log("Time Taken: " + (endTime - startTime) + "ms");
    console.log("Total Chunks Extracted: " + result.chunks.length.toLocaleString());
    console.log("Total Dialogue Chunks: " + result.stats.dialogueCount.toLocaleString());

    console.log("\n=== QUALITY CHECK (First 3 Dialogue Chunks) ===");
    const firstThreeList = result.chunks.filter(c => c.type === 'dialogue').slice(0, 3);
    for (const chunk of firstThreeList) {
        console.log("\nSpeaker: " + chunk.speaker);
        console.log("Content: \"" + chunk.content + "\"");
    }

    console.log("\n=== QUALITY CHECK (First 2 Action Chunks) ===");
    const actionList = result.chunks.filter(c => c.type === 'action').slice(0, 2);
    for (const chunk of actionList) {
        console.log("\nType: Action");
        console.log("Content: \"" + chunk.content + "\"");
    }
}

runTest().catch(console.error);
