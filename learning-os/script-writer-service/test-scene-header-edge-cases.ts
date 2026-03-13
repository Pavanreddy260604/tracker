import { masterScriptParserService } from "./src/services/masterScriptParser.service";

const testContent = `
1. EXT. SPACE - NIGHT

COMMENTATOR 2 (V.O.)
Bilkul sahi kaha aapne tom, ek

INT. SAMBHAR LAKE - DAY 2

Mahavir Singh and Harkindar lock hands and test each other.
Harkindar still has an arrogant smile on his face.

#SCENE 3# EXT. MARKET - MORNING

People look excited.

>EXT. COURTYARD - AFTERNOON<

A crowd gathers around.

ACT I

INT. TEMPLE - DAWN

Mahavir prepares for the ceremony.
`;

const result = masterScriptParserService.parse(testContent, "test-scene-headers-edge-cases");

console.log("=== Parsed Elements ===");
console.log("======================");
result.elements.forEach((element, index) => {
    console.log(`#${index + 1}`);
    console.log(`  Type: ${element.elementType}`);
    if (element.speaker) {
        console.log(`  Speaker: ${element.speaker}`);
    }
    if (element.sceneNumber) {
        console.log(`  Scene Number: ${element.sceneNumber}`);
    }
    console.log(`  Content: "${element.content}"`);
    console.log();
});

console.log("=== Scenes ===");
console.log("==============");
result.scenes.forEach(scene => {
    console.log(`Scene ${scene.sceneSeq}: "${scene.heading}"`);
    console.log(`  Start: ${scene.sourceStartLine}`);
    console.log(`  End: ${scene.sourceEndLine}`);
    console.log(`  Elements: ${scene.elementCount}`);
    if (scene.sceneNumber) {
        console.log(`  Number: ${scene.sceneNumber}`);
    }
    console.log();
});
