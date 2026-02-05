
import { buildScriptPrompt, STYLE_PROMPTS } from './prompts/hollywood';

const runTest = () => {
    console.log("Testing Script Writer Style Integration...\n");

    // 1. Check if styles are present in STYLE_PROMPTS
    const stylesToCheck = ['nolan', 'tarantino', 'spielberg', 'anderson'];
    const missingStyles = stylesToCheck.filter(style => !(style in STYLE_PROMPTS));

    if (missingStyles.length > 0) {
        console.error("FAILED: Missing styles:", missingStyles);
        process.exit(1);
    } else {
        console.log("PASSED: All director styles found in STYLE_PROMPTS.");
    }

    // 2. Generate a prompt and check for keywords
    // We cast the string to any to bypass strict typing for the test if the types aren't updated yet in the IDE perception,
    // though in reality they should be fine.
    const prompt = buildScriptPrompt(
        "A detective realizes he is in a dream.",
        "film",
        "nolan" as any
    );

    if (prompt.includes("Christopher Nolan") && prompt.includes("COMPLEX NARRATIVE STRUCTURE")) {
        console.log("PASSED: Nolan style successfully integrated into prompt.");
    } else {
        console.error("FAILED: Nolan prompt did not contain expected keywords.");
        console.log("Generated Prompt Snippet:\n", prompt.substring(0, 500));
        process.exit(1);
    }

    console.log("\nAll tests passed successfully!");
};

runTest();
