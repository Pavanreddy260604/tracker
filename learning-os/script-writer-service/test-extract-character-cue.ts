import { masterScriptParserService } from "./src/services/masterScriptParser.service";

// Create a script with the problematic dialogue
const testContent = `COMMENTATOR 2 (V.O.)

Bilkul sahi kaha aapne tom, ek
`;

const lines = testContent.split(/\r?\n/);
const lineIndex = 0;
const currentLine = lines[lineIndex];
const trimmed = currentLine.trim();

// Find next non-blank line (mimicking parser logic)
let nextLineIndex = lineIndex + 1;
let nextLine = '';
while (nextLineIndex < lines.length) {
    const candidate = lines[nextLineIndex].trim();
    if (candidate) {
        nextLine = candidate;
        break;
    }
    nextLineIndex++;
}

console.log("=== Input Parameters ===");
console.log(`Current Line: "${currentLine}"`);
console.log(`Trimmed: "${trimmed}"`);
console.log(`Next Line: "${nextLine}"`);
console.log(`Next Line Index: ${nextLineIndex}`);
console.log();

// Test extractCharacterCue
const extractCharacterCue = (masterScriptParserService as any).extractCharacterCue;
const result = extractCharacterCue.call(masterScriptParserService, trimmed, nextLine);

console.log("=== extractCharacterCue Result ===");
console.log(result);
console.log();

if (result) {
    console.log("=== Extracted Speaker ===");
    console.log(result.speaker);
}
