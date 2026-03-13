
import { masterScriptParserService } from './src/services/masterScriptParser.service';

const testScript = `
TITLE: THE GHOST
AUTHOR: NOLAN

.EXT. SPACE - NIGHT1

In space, no one can hear you scream.

3.

EXT. SAMBHAR LAKE - NIGHT2

Jaggu walks alone.

7.

      52 i/e. temple - dAY52

PK walks inside.

                                               58.

                               PK (CONT'D)
                      Aree bhai sahab dekhiye Eh humra

                                                              59.
`;

async function testPolish() {
    console.log('[Test] Running Phase 4 Polish Audit...');
    const result = masterScriptParserService.parse(testScript, 'v_polish_test');

    // Check Scene Number Stripping
    const scene1 = result.scenes.find(s => s.heading.includes('SPACE'));
    console.log(`[Scene 1] Heading: "${scene1?.heading}" | SceneNum: "${scene1?.sceneNumber}"`);
    if (scene1?.heading === 'EXT. SPACE - NIGHT' && scene1?.sceneNumber === '1') {
        console.log('✅ Slugline Cleaning Passed (NIGHT1 -> NIGHT / Scene 1)');
    } else {
        console.log('❌ Slugline Cleaning Failed');
    }

    const scene2 = result.scenes.find(s => s.heading.includes('SAMBHAR'));
    console.log(`[Scene 2] Heading: "${scene2?.heading}" | SceneNum: "${scene2?.sceneNumber}"`);
    if (scene2?.heading === 'EXT. SAMBHAR LAKE - NIGHT' && scene2?.sceneNumber === '2') {
        console.log('✅ Slugline Cleaning Passed (NIGHT2 -> NIGHT / Scene 2)');
    } else {
        console.log('❌ Slugline Cleaning Failed');
    }

    const scene52 = result.scenes.find(s => s.heading.includes('temple'));
    console.log(`[Scene 52] Heading: "${scene52?.heading}" | SceneNum: "${scene52?.sceneNumber}"`);
    // Note: The parser keeps the casing of the original line unless it's a forced element.
    // We'll check if the trailing 52 is gone and sceneNumber is set.
    if (scene52?.heading.trim().toUpperCase() === 'I/E. TEMPLE - DAY' && scene52?.sceneNumber === '52') {
        console.log('✅ Slugline Cleaning Passed (dAY52 -> DAY / Scene 52)');
    } else {
        console.log('❌ Slugline Cleaning Failed');
    }

    // Check Page Number Suppression
    // Use trim() for comparison since they might have leading spaces
    const pageNums = result.elements.filter(e => e.nonPrinting && (
        e.content.trim() === '3.' ||
        e.content.trim() === '7.' ||
        e.content.trim() === '58.' ||
        e.content.trim() === '59.'
    ));
    console.log(`[Test] Found ${pageNums.length} suppressed page numbers.`);
    if (pageNums.length === 4) {
        console.log('✅ Page Number Suppression Passed');
    } else {
        console.log('❌ Page Number Suppression Failed');
        result.elements.forEach(e => {
            if (e.content.includes('58') || e.content.includes('59')) {
                console.log(`Debug chunk: content="${e.content}", nonPrinting=${e.nonPrinting}, type=${e.elementType}`);
            }
        });
    }
}

testPolish();
