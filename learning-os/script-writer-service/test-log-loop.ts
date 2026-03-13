import { MasterScriptParserService } from "./src/services/masterScriptParser.service";

// Create a subclass to override parse method and add detailed logging
class LoggingParser extends MasterScriptParserService {
    parse(rawContent: string, scriptVersion: string) {
        const lines = rawContent.split(/\r?\n/);

        console.log("=== Lines ===");
        lines.forEach((line, i) => {
            console.log(`Line ${i + 1}: "${line}"`);
        });
        console.log();

        // Override to log detailed information
        console.log("=== Detailed Parse Loop ===");
        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();

            console.log(`[Line ${i + 1}] Processing: "${rawLine}"`);
            console.log(`  Trimmed: "${trimmed}"`);

            if (!trimmed) {
                console.log("  BLANK LINE");
                continue;
            }

            // Check isUppercase
            const isUppercase = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
            console.log(`  isUppercase: ${isUppercase}`);

            // Check word count
            const wordCount = trimmed.split(/\s+/).length;
            console.log(`  wordCount: ${wordCount}`);

            // Check hasNoTerminalPunctuation
            const hasNoTerminalPunctuation = !/[.!?]$/.test(trimmed);
            console.log(`  hasNoTerminalPunctuation: ${hasNoTerminalPunctuation}`);

            // Find next non-blank line
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length) {
                const candidate = lines[nextLineIndex].trim();
                if (candidate) {
                    nextLine = candidate;
                    break;
                }
                nextLineIndex++;
            }

            console.log(`  nextLine: "${nextLine}"`);

            // Call extractCharacterCue directly
            // @ts-ignore - Access private method
            const cueMatch = this.extractCharacterCue(trimmed, nextLine);
            if (cueMatch) {
                console.log(`  CHARACTER CUE MATCHED: ${cueMatch.speaker}`);
            } else {
                console.log("  NOT a character cue");
            }

            console.log();
        }

        return super.parse(rawContent, scriptVersion);
    }
}

// Create test parser and run test
const testParser = new LoggingParser();
const testContent = `COMMENTATOR 2 (V.O.)

Bilkul sahi kaha aapne tom, ek
`;

console.log("=== LoggingParser Test ===");
const result = testParser.parse(testContent, "test-version");

console.log();
console.log("=== Parsed Elements ===");
result.elements.forEach(element => {
    console.log(`Type: ${element.elementType}, Content: "${element.content}"`);
    if (element.speaker) {
        console.log(`Speaker: ${element.speaker}`);
    }
    console.log();
});
