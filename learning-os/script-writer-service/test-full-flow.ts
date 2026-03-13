import { masterScriptParserService } from "./src/services/masterScriptParser.service";

const testContent = `COMMENTATOR 2 (V.O.)

Bilkul sahi kaha aapne tom, ek
`;

// Hack to log all conditions being checked
const originalParse = masterScriptParserService.parse;
// @ts-ignore - Allow modifying prototype
(masterScriptParserService as any).parse = function (rawContent: string, scriptVersion: string) {
    const lines = rawContent.split(/\r?\n/);

    console.log("=== Lines to parse ===");
    lines.forEach((line, i) => {
        console.log(`Line ${i + 1}: "${line}"`);
    });
    console.log();

    const firstLine = lines[0];
    const trimmed = firstLine.trim();

    console.log("=== Checking conditions ===");
    console.log(`trimmed: "${trimmed}"`);

    // Check all conditions that come before character cue extraction
    console.log(`sceneHeading: ${!!(this as any).extractSceneHeading(trimmed)}`);
    console.log(`designation: ${!!(this as any).extractDesignation(trimmed)}`);
    console.log(`settingLine: ${!!(this as any).extractSettingLine(trimmed)}`);

    return originalParse.call(this, rawContent, scriptVersion);
};

console.log("=== Test start ===");
const result = masterScriptParserService.parse(testContent, "test-version");
console.log();

console.log("=== Final Result ===");
result.elements.forEach(element => {
    console.log(`Type: ${element.elementType}, Content: "${element.content}"`);
    if (element.speaker) {
        console.log(`Speaker: ${element.speaker}`);
    }
    console.log();
});
