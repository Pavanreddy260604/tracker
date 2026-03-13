
import { MasterScriptParserService } from './src/services/masterScriptParser.service';

async function testTitlePageCoverage() {
    const parser = new MasterScriptParserService();

    const testCases = [
        {
            name: "Standard Screenplay (Inception Style)",
            content: `INCEPTION\nBy\nChristopher Nolan\nSHOOTING SCRIPT\n\nFADE IN:\n\nDAWN. CRASHING SURF.\nINT. JAPANESE CASTLE - DAY\nThe man is dragged.`
        },
        {
            name: "Stage Play (SCENE based)",
            content: `THE TEMPEST\nBy William Shakespeare\n\nSCENE 1\n\nOn a ship at sea: a tempestuous noise of thunder and lightning heard.\nEnter a Ship-Master and a Boatswain.\n\nSHIP-MASTER\nBoatswain!`
        },
        {
            name: "Minimal Script (No Title Page)",
            content: `INT. DARK ROOM - NIGHT\n\nSilence. Then, a match flares.`
        }
    ];

    console.log("=== UNIVERSAL PARSER COVERAGE TEST ===");

    for (const test of testCases) {
        console.log(`\n--- Testing: ${test.name} ---`);
        const result = parser.parse(test.content, `v_test_${Date.now()}`);

        const missingLines: number[] = [];
        for (let i = 1; i <= result.sourceLines.length; i++) {
            const isCovered = result.elements.some(e => i >= e.sourceStartLine && i <= e.sourceEndLine);
            if (!isCovered) missingLines.push(i);
        }

        if (missingLines.length === 0) {
            console.log(`✅ SUCCESS: All ${result.sourceLines.length} lines covered.`);
        } else {
            console.log(`❌ FAILURE: Missing coverage for lines: ${missingLines.join(', ')}`);
            result.sourceLines.filter(l => missingLines.includes(l.lineNo)).forEach(l => {
                console.log(`   [Line ${l.lineNo}] "${l.rawText}"`);
            });
        }
    }
}

testTitlePageCoverage().catch(console.error);
