import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractStructuredTextFromFile } from './dist/utils/fileParser.js';
import { masterScriptParserService } from './dist/services/masterScriptParser.service.js';

async function loadScript(file: string) {
    const buffer = readFileSync(file);
    const extracted = await extractStructuredTextFromFile(buffer, 'application/pdf', file);
    const parsed = masterScriptParserService.parse(extracted, `verify_${file}`);

    assert.equal(
        extracted.rawContent,
        extracted.lines.map(line => line.rawText).join('\n'),
        `${file}: rawContent must be a newline-join of extracted lines`
    );

    return { extracted, parsed };
}

async function run() {
    const inception = await loadScript('./scripts/inception-2010.pdf');
    const dangal = await loadScript('./scripts/Dangal-Screenplay.pdf');
    const pk = await loadScript('./scripts/Pk-movie-script-pdf-hindi-1.pdf');

    const inceptionTitlePage = (inception.parsed.titlePage['Title Page'] || []) as string[];
    const inceptionFirstBodyScene = inception.parsed.scenes.find(scene => scene.sceneSeq > 0);
    assert(inceptionTitlePage.includes('INCEPTION'), 'Inception title page should retain the title');
    assert(!inceptionTitlePage.includes('FADE IN:'), 'Inception title page must stop before FADE IN');
    assert.equal(
        inceptionFirstBodyScene?.heading,
        'INT. ELEGANT DINING ROOM, JAPANESE CASTLE - LATER',
        'Inception first parsed scene should begin at the dining room heading'
    );
    assert(
        inception.extracted.lines.some(line => line.sourceKind === 'page_marker'),
        'Inception should preserve page-marker lines'
    );

    const dangalTitlePage = (dangal.parsed.titlePage['Title Page'] || []) as string[];
    const dangalFirstBodyScene = dangal.parsed.scenes.find(scene => scene.sceneSeq > 0);
    assert(dangalTitlePage.includes('DANGAL'), 'Dangal title page should retain the title');
    assert(
        dangalTitlePage.some(line => line.includes('Written by Nitesh Tiwari')),
        'Dangal title page should preserve multi-line credits'
    );
    assert.equal(
        dangal.extracted.lines.find(line => line.sourceKind === 'body')?.rawText.trim(),
        'INT. OFFICE - AFTERNOON',
        'Dangal body should start at the first scene heading'
    );
    assert.equal(
        dangalFirstBodyScene?.heading,
        'INT. OFFICE - AFTERNOON',
        'Dangal first scene should begin at INT. OFFICE - AFTERNOON'
    );

    assert.equal(pk.parsed.scenes[0]?.sceneNumber, '1', 'PK should preserve the first scene number');
    assert.equal(pk.parsed.scenes[1]?.sceneNumber, '2', 'PK should preserve the second scene number');
    assert.equal(pk.parsed.scenes[2]?.sceneNumber, '3', 'PK should preserve the third scene number');
    const pkActionAfterNarration = pk.parsed.elements.find(
        element => element.content.includes('Haunting music sets in as the semi-circle of the huge blue')
    );
    assert(pkActionAfterNarration, 'PK should still contain the post-narration action line');
    assert.equal(
        pkActionAfterNarration?.chunkType,
        'action',
        'PK post-narration prose must return to action instead of staying in V.O. dialogue'
    );
    assert(
        pk.extracted.lines.some(line => line.sourceKind === 'page_marker'),
        'PK should preserve page-marker lines'
    );

    console.log('Exact screenplay reconstruction verification passed.');
}

void run().catch(error => {
    console.error('Exact screenplay reconstruction verification failed.');
    console.error(error);
    process.exit(1);
});
