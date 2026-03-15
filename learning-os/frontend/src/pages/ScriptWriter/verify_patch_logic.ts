
function testPatch(editorContext: string, patchContent: string) {
    const searchMarker = '<<<SEARCH>>>';
    const replaceMarker = '<<<REPLACE>>>';
    const searchIndex = patchContent.indexOf(searchMarker);
    const replaceIndex = patchContent.indexOf(replaceMarker);

    if (searchIndex !== -1 && replaceIndex !== -1 && editorContext) {
        const oldTextRaw = patchContent.substring(searchIndex + searchMarker.length, replaceIndex);
        const newTextRaw = patchContent.substring(replaceIndex + replaceMarker.length);

        // Clean and normalize
        const clean = (t: string) => t.replace(/\r/g, '').replace(/^\n/, '').replace(/\n$/, '');
        const oldText = clean(oldTextRaw);
        const newText = clean(newTextRaw);

        const normalizedEditor = editorContext.replace(/\r/g, '');
        
        console.log('--- TEST ---');
        console.log('Old Text (Clean):', JSON.stringify(oldText));
        
        if (normalizedEditor.includes(oldText)) {
            const searchPattern = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
            const regex = new RegExp(searchPattern, 'g');
            const updated = editorContext.replace(regex, newText);
            console.log('Match type: Normalized (Line endings)');
            console.log('Success:', updated !== editorContext);
            return updated;
        } else {
            const ultraOld = oldText.trim();
            const searchPatternUltra = ultraOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const regexUltra = new RegExp(searchPatternUltra, 'g');
            const updatedUltra = editorContext.replace(regexUltra, newText);
            console.log('Match type: Ultra-normalized (Internal whitespace)');
            console.log('Success:', updatedUltra !== editorContext);
            return updatedUltra;
        }
    }
    return null;
}

const context = `INT. COFFEE SHOP - DAY\n\nRAVI\nHey, how are you?\n\nPRIYA\nI'm fine, thanks.`;

// Test 1: AI adds a trailing newline in SEARCH block
const patch1 = `<<<SEARCH>>>\nRAVI\nHey, how are you?\n<<<REPLACE>>>\nRAVI\nWhat's up?`;
const res1 = testPatch(context, patch1);
console.log('Result 1:', JSON.stringify(res1));

// Test 2: Whitespace mismatch (AI uses spaces instead of tabs or multiple spaces)
const context2 = `INT. COFFEE  SHOP - DAY`;
const patch2 = `<<<SEARCH>>>\nINT. COFFEE SHOP - DAY\n<<<REPLACE>>>\nEXT. PARK - DAY`;
const res2 = testPatch(context2, patch2);
console.log('Result 2:', JSON.stringify(res2));

// Test 3: CRLF vs LF
const context3 = `RAVI\r\nHello world`;
const patch3 = `<<<SEARCH>>>\nRAVI\nHello world\n<<<REPLACE>>>\nRAVI\nHi`;
const res3 = testPatch(context3, patch3);
console.log('Result 3:', JSON.stringify(res3));
