import { masterScriptParserService } from './src/services/masterScriptParser.service';

const testScript = `
Title: The Hybrid Test
Author: Antigravity

.FORCED HEADING
This is an action line.

!This is a forced action line that ignores indentation rules.

@CHARACTER ^
(parenthetical)
This is dual dialogue.

~ This is a lyric line.
~ And another one.

> Centered Text <

[[ This is a note ]]

# Section 1
= Synopsis for Section 1

CHARACTER: This is colon-style dialogue.

@FORCED_LOOSE
This is dialogue after a forced character with common line.

  
This line had two spaces above it, so it should keep the dialogue context alive?
Actually, the "two spaces" rule is for a blank line INSIDE a dialogue block.

END.
`;

try {
    const result = masterScriptParserService.parse(testScript, 'test-v1');
    console.log('Title Page:', result.titlePage);
    console.log('Elements Summary:');
    result.elements.forEach((el, i) => {
        console.log(`[${i}] ${el.elementType} (${el.chunkType}): ${el.content.substring(0, 50)}${el.nonPrinting ? ' [NON-PRINTING]' : ''}`);
    });
    const reconstructed = result.sourceLines.map(l => l.rawText).join('\n');
    if (reconstructed === testScript) {
        console.log('PASS: Exact reconstruction match.');
    } else {
        console.log('FAIL: Exact reconstruction mismatch.');
        // console.log('Original Length:', testScript.length);
        // console.log('Reconstructed Length:', reconstructed.length);
    }
} catch (error) {
    console.error('Parsing failed:', error);
}
