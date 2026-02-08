/**
 * Hollywood Screenplay Formatting Prompts
 * 
 * Industry-standard screenplay format following WGA (Writers Guild of America)
 * guidelines used in professional film production.
 */

// ============================================
// SYSTEM PROMPT - Core Formatting Rules
// ============================================

export const SCREENPLAY_SYSTEM_PROMPT = `You are a professional Hollywood screenwriter. Your scripts follow industry-standard formatting:

## SCREENPLAY FORMAT RULES

### Scene Headers (Slug Lines)
- Always start with INT. (interior) or EXT. (exterior)
- Include location and time of day
- Format: INT./EXT. LOCATION - TIME
- Examples:
  - INT. COFFEE SHOP - DAY
  - EXT. CITY STREET - NIGHT
  - INT./EXT. CAR (MOVING) - CONTINUOUS

### Action/Description
- Written in present tense
- Brief, visual descriptions
- Single-spaced, no indentation
- Introduce characters in CAPS on first appearance
- Keep paragraphs to 3-4 lines maximum

### Character Names
- Centered, ALL CAPS
- Placed 3.7 inches from left margin
- Include (V.O.) for voiceover, (O.S.) for off-screen

### Dialogue
- Centered below character name
- 2.5 inches from left margin
- Line width: approximately 3.5 inches
- Parentheticals in lowercase, in parentheses

### Transitions
- RIGHT-aligned
- Common: CUT TO:, DISSOLVE TO:, FADE OUT.
- Use sparingly (modern scripts minimize these)

### Formatting Rules
- Font: Courier 12-point
- Margins: 1.5" left, 1" right, top, bottom
- One page ≈ one minute of screen time

IMPORTANT: Generate ONLY the screenplay content. No explanations, no markdown, no commentary.`;

// ============================================
// FORMAT-SPECIFIC TEMPLATES
// ============================================

export const FORMAT_TEMPLATES = {
    film: {
        name: 'Feature Film',
        duration: '90-180 minutes',
        structure: `Three-act structure:
- Act 1 (Setup): First 25-30 pages
- Act 2 (Confrontation): Pages 30-90  
- Act 3 (Resolution): Final 30 pages
Include: Opening Hook, Inciting Incident, Midpoint, All Is Lost, Climax`,
        pageCount: '90-180 pages'
    },

    short: {
        name: 'Short Film',
        duration: '5-30 minutes',
        structure: `Compact narrative:
- Quick setup (1-2 pages)
- Single central conflict
- Swift resolution
Focus on one powerful moment or idea`,
        pageCount: '5-30 pages'
    },

    youtube: {
        name: 'YouTube Video',
        duration: '3-20 minutes',
        structure: `Hook-driven format:
- Strong opening hook (first 30 seconds)
- Clear value proposition
- Engaging middle with payoffs
- Call-to-action ending
Consider: chapter breaks, visual callouts`,
        pageCount: '3-20 pages'
    },

    reel: {
        name: 'Reel/Short-Form',
        duration: '15-90 seconds',
        structure: `Ultra-compact:
- Immediate hook (first 2 seconds)
- One core idea/message
- Quick visual storytelling
- Punchline or twist ending
Every second counts!`,
        pageCount: '0.5-1.5 pages'
    },

    commercial: {
        name: 'Commercial/Ad',
        duration: '15-60 seconds',
        structure: `AIDA Format:
- Attention: Grab viewer instantly
- Interest: Present the problem/solution
- Desire: Emotional appeal
- Action: Clear CTA
Focus on brand message and emotion`,
        pageCount: '0.5-1 page'
    },

    'tv-episode': {
        name: 'TV Episode',
        duration: '22-60 minutes',
        structure: `Multi-act TV structure:
- Cold Open (Teaser)
- Act 1-4 or 1-5 (with act breaks)
- Tag/Button (optional)
Consider: A-plot, B-plot, serialized elements`,
        pageCount: '22-60 pages'
    }
};

// ============================================
// STYLE-SPECIFIC PROMPTS
// ============================================

import { DIRECTOR_STYLES } from './styles';

export const STYLE_PROMPTS = {
    ...DIRECTOR_STYLES,
    classic: {
        name: 'Classic Screenplay',
        prompt: `Write in traditional Hollywood style:
- Clear three-act structure
- Balance of dialogue and action
- Character-driven with visual storytelling
- Professional, clean formatting
- Universal appeal, accessible narrative`,
        characteristics: ['balanced pacing', 'clear story beats', 'relatable characters']
    },

    'dialogue-driven': {
        name: 'Dialogue-Driven',
        prompt: `Focus on character conversations:
- Rich, naturalistic dialogue
- Subtext and layered meanings
- Minimal action descriptions
- Character voice differentiation
- Conversation carries the plot`,
        characteristics: ['extended dialogue scenes', 'verbal wit', 'character depth']
    },

    'visual-minimal': {
        name: 'Visual/Minimal Dialogue',
        prompt: `Show, don't tell approach:
- Emphasis on visual storytelling
- Minimal dialogue (essential only)
- Detailed action descriptions
- Environmental storytelling
- Silence as a tool`,
        characteristics: ['visual poetry', 'atmospheric', 'implied meaning']
    },

    'non-linear': {
        name: 'Non-Linear Narrative',
        prompt: `Time-shifting storytelling:
- Flashbacks and flash-forwards
- Parallel timelines
- Puzzle-like structure
- Strategic reveal of information
- Thematic connections across time`,
        characteristics: ['time jumps', 'revelation structure', 'complex timeline']
    },

    documentary: {
        name: 'Documentary Style',
        prompt: `Realism and authenticity:
- Interview segments
- Voiceover narration
- Found footage elements
- Breaking fourth wall
- Intimate, observational tone`,
        characteristics: ['talking heads', 'archival feel', 'authentic voice']
    },

    'action-heavy': {
        name: 'Action-Heavy',
        prompt: `Kinetic, exciting pacing:
- Detailed action sequences
- Dynamic scene descriptions
- Short, punchy dialogue
- Physical character expression
- Set-piece construction`,
        characteristics: ['choreographed action', 'tension building', 'visual spectacle']
    },

    experimental: {
        name: 'Experimental',
        prompt: `Breaking conventions:
- Non-traditional formatting
- Abstract sequences
- Unconventional structure
- Artistic expression
- Challenge expectations`,
        characteristics: ['avant-garde', 'rule-breaking', 'artistic vision']
    },

    custom: {
        name: 'Custom Style',
        prompt: 'Follow the user\'s specific style instructions while maintaining professional screenplay format.',
        characteristics: ['user-defined']
    },

    indie: {
        name: 'Indie / Naturalistic',
        prompt: `Write in a raw, naturalistic style:
- Authentic, overlapping dialogue
- Focus on small, intimate moments
- Character-driven conflicts over plot
- Use silence and subtext effectively
- Avoid Hollywood clichés`,
        characteristics: ['authentic dialogue', 'intimate specific', 'character focus']
    },

    modern: {
        name: 'Modern Cinematic',
        prompt: `Write in a sleek, contemporary style:
- Fast-paced, efficient storytelling
- Visual, active scene descriptions
- Sharp, witty dialogue
- Focus on visual flow and momentum
- Avoid dense blocks of text`,
        characteristics: ['fast pacing', 'visual flow', 'witty dialogue']
    }
};

// ============================================
// VOICE GUIDANCE BUILDER
// ============================================

interface VoiceSampleWithMeta {
    content: string;
    speaker?: string;
    similarityScore?: number;
}

/**
 * Build nuanced voice guidance from reference samples.
 * Groups by speaker and provides weighted inspiration rather than blunt mimicry.
 */
function buildVoiceGuidance(
    samples: VoiceSampleWithMeta[],
    weight: 'strong' | 'subtle' = 'subtle'
): string {
    if (!samples || samples.length === 0) return '';

    // Group samples by speaker
    const bySpeaker = new Map<string, VoiceSampleWithMeta[]>();

    for (const sample of samples) {
        const speaker = sample.speaker || 'GENERAL';
        if (!bySpeaker.has(speaker)) {
            bySpeaker.set(speaker, []);
        }
        bySpeaker.get(speaker)!.push(sample);
    }

    let guidance = `
## VOICE REFERENCE ${weight === 'strong' ? '(MATCH CLOSELY)' : '(USE AS INSPIRATION)'}

The following examples demonstrate the desired dialogue style and voice patterns.
Study the vocabulary, rhythm, and cadence - then adapt (don't copy) for your characters.

`;

    for (const [speaker, lines] of bySpeaker) {
        if (speaker !== 'GENERAL') {
            guidance += `### ${speaker}'s Voice Pattern:\n`;
        } else {
            guidance += `### Reference Dialogue:\n`;
        }

        // Only show top 2 per character to avoid overwhelming
        const topLines = lines
            .sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0))
            .slice(0, 2);

        for (const line of topLines) {
            // Truncate long samples
            const excerpt = line.content.length > 200
                ? line.content.slice(0, 200) + '...'
                : line.content;
            guidance += `> "${excerpt}"\n`;
        }
        guidance += '\n';
    }

    if (weight === 'subtle') {
        guidance += `**IMPORTANT:** These are EXAMPLES for inspiration, not templates to copy.
Adapt the tone and vocabulary while strictly following screenplay format rules.
Character dialogue should feel natural, not forced to match examples exactly.

`;
    } else {
        guidance += `**NOTE:** Match the vocabulary and sentence patterns closely, but ensure proper screenplay formatting.

`;
    }

    return guidance;
}

// ============================================
// PROMPT BUILDER
// ============================================

export function buildScriptPrompt(
    userPrompt: string,
    format: keyof typeof FORMAT_TEMPLATES,
    style: keyof typeof STYLE_PROMPTS,
    options?: {
        duration?: number;
        genre?: string;
        tone?: string;
        language?: string;
        transliteration?: boolean;
        sceneLength?: 'short' | 'medium' | 'long' | 'extended';
    },
    voiceSamples?: any[], // New argument
    cast?: any[] // New argument: List of characters to include
): string {
    const formatInfo = FORMAT_TEMPLATES[format] || FORMAT_TEMPLATES.film;
    const styleInfo = STYLE_PROMPTS[style] || STYLE_PROMPTS.classic;

    let prompt = `${SCREENPLAY_SYSTEM_PROMPT}

## YOUR ASSIGNMENT

**Format:** ${formatInfo.name} (${formatInfo.duration})
**Target Length:** ${formatInfo.pageCount}
**Structure Guide:**
${formatInfo.structure}

**Style:** ${styleInfo.name}
${styleInfo.prompt}

`;

    // Inject Cast List (Context Awareness)
    if (cast && cast.length > 0) {
        prompt += `## CAST OF CHARACTERS (STRICT ENFORCEMENT)\n\n`;
        prompt += `You must ONLY use the following characters. Do NOT invent new named characters.\n\n`;

        cast.forEach(c => {
            const role = c.role ? `(${c.role.toUpperCase()})` : '';
            const traits = c.traits && c.traits.length > 0 ? `Traits: ${c.traits.join(', ')}` : '';
            const motivation = c.motivation ? `Motivation: "${c.motivation}"` : '';
            const voice = c.voice?.description ? `Voice: ${c.voice.description}` : '';

            prompt += `### ${c.name.toUpperCase()} ${role}\n`;
            if (traits) prompt += `- ${traits}\n`;
            if (motivation) prompt += `- ${motivation}\n`;
            if (voice) prompt += `- ${voice}\n`;
            prompt += `\n`;
        });

        prompt += `**CHARACTER BEHAVIOR RULES:**\n`;
        prompt += `1. ADHERE TO VOICE: Write dialogue that matches each character's specific voice description.\n`;
        prompt += `2. MOTIVATION DRIVEN: Ensure character actions align with their stated motivations.\n`;
        prompt += `3. NO HALLUCINATIONS: If a character is not in this list, do not give them a name or significant lines.\n\n`;
    }

    // Inject Voice Samples (RAG) with weighted guidance
    if (voiceSamples && voiceSamples.length > 0) {
        prompt += buildVoiceGuidance(voiceSamples);
    }

    if (options?.genre) {
        prompt += `**Genre:** ${options.genre}\n`;
    }
    if (options?.tone) {
        prompt += `**Tone:** ${options.tone}\n`;
    }
    if (options?.duration) {
        prompt += `**Target Duration:** ${options.duration} minutes\n`;
    }

    // Scene Length Control
    if (options?.sceneLength) {
        const lengthGuide: Record<string, { pages: string; words: string; instruction: string }> = {
            short: {
                pages: '1/4 to 1/2 page',
                words: '50-100 words',
                instruction: 'Write a BRIEF scene. Quick beat, single exchange or action. Get in late, get out early.'
            },
            medium: {
                pages: '1 to 2 pages',
                words: '200-400 words',
                instruction: 'Write a STANDARD scene with dialogue exchanges and action. Develop the moment fully.'
            },
            long: {
                pages: '3 to 5 pages',
                words: '600-1000 words',
                instruction: 'Write an EXTENDED scene with multiple beats, conflict escalation, and character depth.'
            },
            extended: {
                pages: '5 to 10 pages',
                words: '1000-2000 words',
                instruction: 'Write a MAJOR set piece or climactic scene. Full dramatic arc with setup, confrontation, resolution.'
            }
        };
        const guide = lengthGuide[options.sceneLength];
        prompt += `\n**SCENE LENGTH REQUIREMENT (CRITICAL):**
Target: ${guide.pages} (approximately ${guide.words})
${guide.instruction}
DO NOT exceed or fall short of this target significantly.\n`;
    }

    // Language Handling
    if (options?.language && options.language !== 'English') {
        prompt += `\n**LANGUAGE INSTRUCTION (NATIVE SPEAKER PROTOCOL):**\n`;
        prompt += `You are NOT a translator. You are a **NATIVE ${options.language.toUpperCase()} SCREENWRITER**.\n`;

        // Universal Rules for Non-English
        prompt += `1. **Think in ${options.language}**: Do not write in English and translate. Write directly in ${options.language} thoughts and sentence structures.\n`;
        prompt += `2. **No "Bookish" Language**: Avoid formal, textbook, or news-anchor language. Use **Spoken/Colloquial** diction appropriate for the character's social status.\n`;

        // Specific Language Rules (Optimizations)
        if (options.language.toLowerCase().includes('telugu')) {
            prompt += `3. **Telugu Particles**: You MUST use natural emotional particles like *ra, bey, andi, kadha, abba, chass* where appropriate for the relationship.\n`;
            prompt += `4. **Dialect**: Use standard film-industry Telugu (neutral or Telangana/Andhra blend) unless a specific dialect is requested.\n`;
        } else if (options.language.toLowerCase().includes('hindi')) {
            prompt += `3. **Hindi Particles**: Use natural particles like *yaar, na, arey, bhai* to sound authentic.\n`;
            prompt += `4. **Hinglish**: If the character is urban/modern, it is acceptable to mix English words naturally (Code-Switching).\n`;
        } else if (options.language.toLowerCase().includes('tamil')) {
            prompt += `3. **Tamil Particles**: Use particles like *da, machan, la* for friends, and respectful forms for elders.\n`;
        } else {
            // Fallback for all other languages to ensure they also get particle instruction
            prompt += `3. **Natural Particles**: You MUST use natural emotional particles, interjections, and fillers SPECIFIC TO ${options.language.toUpperCase()} to sound authentic.\n`;
        }

        if (options.transliteration) {
            prompt += `5. **Script**: Write all DIALOGUE in ${options.language} using the **ENGLISH ALPHABET** (Transliteration/Phonetic). Example: "Yekkada unnav ra?" instead of native script.\n`;
            prompt += `6. **Formatting**: KEEP all Scene Headers, Character Names, and Transitions in **STRICT ENGLISH**. Action lines should be in ENGLISH.\n`;
        } else {
            prompt += `5. **Script**: Write all ACTION LINES and DIALOGUE in the **NATIVE SCRIPT** of ${options.language}.\n`;
            prompt += `6. **Formatting Rules (Hybrid)**:\n`;
            prompt += `   - **SCENE HEADERS**: Keep strictly in ENGLISH (e.g., "INT. HOUSE - DAY"). Do NOT translate INT/EXT or Time.\n`;
            prompt += `   - **CHARACTER NAMES**: Keep strictly in ENGLISH CAPS (e.g., "RAVI").\n`;
            prompt += `   - **TRANSITIONS**: Keep strictly in ENGLISH (e.g., "CUT TO:").\n`;
            prompt += `   - **ACTION & DIALOGUE**: Write these entirely in ${options.language}.\n`;
        }
    }

    prompt += `
## THE STORY TO WRITE

${userPrompt}

---

Now write the complete screenplay. Begin with FADE IN: and use proper Hollywood formatting throughout.`;

    return prompt;
}

// ============================================
// STORY ENGINE PROMPTS
// ============================================

export function buildBeatSheetPrompt(logline: string, style: string = 'Save The Cat'): string {
    let structurePrompt = '';
    let jsonStructure = '';

    switch (style) {
        case 'Hero\'s Journey':
            structurePrompt = 'Joseph Campbell\'s Monomyth (Hero\'s Journey)';
            jsonStructure = `{
      "acts": [
        {
          "name": "Departure (Act I)",
          "beats": [
             { "name": "Ordinary World", "description": "The hero in their normal life." },
             { "name": "Call to Adventure", "description": "The hero is presented with a problem, challenge, or adventure." },
             { "name": "Refusal of the Call", "description": "The hero hesitates or refuses due to fear." },
             { "name": "Meeting the Mentor", "description": "Hero gains supplies, knowledge, or confidence from a mentor." },
             { "name": "Crossing the Threshold", "description": "Hero commits to the adventure and enters the Special World." }
          ]
        },
        {
          "name": "Initiation (Act II)",
          "beats": [
             { "name": "Tests, Allies, Enemies", "description": "Hero explores the Special World, facing tests and making friends/enemies." },
             { "name": "Approach to the Inmost Cave", "description": "Hero draws closer to the heart of the story's central conflict." },
             { "name": "The Ordeal", "description": "The central life-or-death crisis. Hero faces their greatest fear." },
             { "name": "Reward (Seizing the Sword)", "description": "Hero claims the prize for surviving the ordeal." }
          ]
        },
        {
          "name": "Return (Act III)",
          "beats": [
             { "name": "The Road Back", "description": "Hero must return to the Ordinary World, often chased by vengeful forces." },
             { "name": "The Resurrection", "description": "Final test where hero is severely tested once more. Rebirth." },
             { "name": "Return with the Elixir", "description": "Hero returns home with some element of the treasure/lesson." }
          ]
        }
      ]
    }`;
            break;

        case 'Three Act':
            structurePrompt = 'Classic Three-Act Structure';
            jsonStructure = `{
      "acts": [
        {
          "name": "Act 1: The Setup",
          "beats": [
             { "name": "The Status Quo", "description": "Introduction to the world and characters." },
             { "name": "Inciting Incident", "description": "Event that sets the story in motion." },
             { "name": "The Lock-In (Plot Point 1)", "description": "Point of no return where protagonist sets out on the journey." }
          ]
        },
        {
          "name": "Act 2: The Confrontation",
          "beats": [
             { "name": "Rising Action", "description": "Obstacles and complications increase." },
             { "name": "First Pinch Point", "description": "Reminder of the antagonist's power." },
             { "name": "Midpoint", "description": "Major shift in the story; stakes are raised significantly." },
             { "name": "Second Pinch Point", "description": "Another reminder of the antagonist's threat." },
             { "name": "All is Lost (Plot Point 2)", "description": "Lowest moment for the protagonist." }
          ]
        },
        {
          "name": "Act 3: The Resolution",
          "beats": [
             { "name": "The Climax", "description": "Final confrontation and peak emotional intensity." },
             { "name": "Falling Action", "description": "Aftermath of the climax." },
             { "name": "Resolution", "description": "New status quo established." }
          ]
        }
      ]
    }`;
            break;

        case 'TV Beat Sheet':
            structurePrompt = 'TV Drama Structure (5-Act)';
            jsonStructure = `{
      "acts": [
        {
          "name": "Teaser / Cold Open",
          "beats": [
             { "name": "The Hook", "description": "Grab the audience immediately." },
             { "name": "Setup of Episode Conflict", "description": "Establish the main problem of this episode." }
          ]
        },
        {
          "name": "Act 1",
          "beats": [
             { "name": "Problem Escalation", "description": "The initial problem gets worse." },
             { "name": "Act Out", "description": "Cliffhanger or strong dramatic moment ending the act." }
          ]
        },
        {
          "name": "Act 2",
          "beats": [
             { "name": "Complication", "description": "New information or obstacles arise." },
             { "name": "B-Story Beat", "description": "Development of the secondary plot." },
             { "name": "Act Out", "description": "Higher stakes cliffhanger." }
          ]
        },
        {
          "name": "Act 3",
          "beats": [
             { "name": "Twist / Turn", "description": "Plot moves in unexpected direction." },
             { "name": "Low Point", "description": "Characters facing defeat." },
             { "name": "Act Out", "description": "Highest emotional or physical jeopardy." }
          ]
        },
        {
          "name": "Act 4",
          "beats": [
             { "name": "Resolution of Main Conflict", "description": "The primary problem is addressed (success or failure)." }
          ]
        },
        {
          "name": "Tag",
          "beats": [
             { "name": "New Normal / Setup", "description": "Wrap up B-stories and setup next episode." }
          ]
        }
      ]
    }`;
            break;

        case 'Fictional Pulse':
            structurePrompt = 'Fictional Pulse (4-Part Rhythm)';
            jsonStructure = `{
      "acts": [
        {
          "name": "Pulse 1: The Awake",
          "beats": [
             { "name": "Status Quo", "description": "The world as it is." },
             { "name": "The Spark", "description": "Something disrupts the balance." },
             { "name": "The Threshold", "description": "The hero decides to engage." }
          ]
        },
        {
          "name": "Pulse 2: The Tension",
          "beats": [
             { "name": "New Rules", "description": "Hero learns how this new world works." },
             { "name": "The First Twist", "description": "An unexpected complication arising from the spark." },
             { "name": "Midpoint Shift", "description": "The stakes are raised significantly." }
          ]
        },
        {
          "name": "Pulse 3: The Crash",
          "beats": [
             { "name": "The Spiral", "description": "Things go wrong; the hero's plan fails." },
             { "name": "Rock Bottom", "description": "The hero loses hope or resources." },
             { "name": "The Rally", "description": "A last-ditch idea or realization." }
          ]
        },
        {
          "name": "Pulse 4: The Beat",
          "beats": [
             { "name": "Final Confrontation", "description": "The hero faces the antagonist/problem." },
             { "name": "The Aftermath", "description": "The dust settles; a new normal is found." }
          ]
        }
      ]
    }`;
            break;

        default: // Save The Cat
            structurePrompt = 'Save The Cat (Blake Snyder)';
            jsonStructure = `{
      "acts": [
        {
          "name": "Act 1",
          "beats": [
             { "name": "Opening Image", "description": "Visual introduction to the hero's status quo." },
             { "name": "Theme Stated", "description": "The lesson the hero must learn, spoken aloud." },
             { "name": "Set-Up", "description": "Hero's life, flaws, and stakes." },
             { "name": "Catalyst", "description": "Inciting incident that disrupts the status quo." },
             { "name": "Debate", "description": "Hero resists the call to adventure." },
             { "name": "Break into Two", "description": "Hero enters the new world." }
          ]
        },
        {
          "name": "Act 2",
          "beats": [
             { "name": "B Story", "description": "New character/relationship that carries the theme." },
             { "name": "Fun and Games", "description": "The promise of the premise. Highlights/Trailer moments." },
             { "name": "Midpoint", "description": "False victory or defeat. Stakes raised." },
             { "name": "Bad Guys Close In", "description": "Internal and external forces put pressure on." },
             { "name": "All is Lost", "description": "Moment of defeat; whiff of death." },
             { "name": "Dark Night of the Soul", "description": "Hero processes the loss and finds the truth." },
             { "name": "Break into Three", "description": "Hero decides to fight back with new knowledge." }
          ]
        },
        {
          "name": "Act 3",
          "beats": [
             { "name": "Finale", "description": "The final battle. Hero proves they have changed." },
             { "name": "Final Image", "description": "Mirror of Opening Image, showing change." }
          ]
        }
      ]
    }`;
    }

    return `You are a master story architect.
    
    TASK: Convert the following Logline into a full structured Beat Sheet using the ${structurePrompt} framework.
    
    LOGLINE: "${logline}"
    
    OUTPUT FORMAT: Strictly Valid JSON. No whitespace or markdown outside the JSON.
    
    Structure:
    ${jsonStructure}
    
    INSTRUCTIONS:
    - Keep descriptions concise but specific to the story.
    - Ensure meaningful narrative arc matching the ${structurePrompt} methodology.
    - RETURN ONLY THE JSON OBJECT.
    - DO NOT include any conversational text, markdown blocks, or explanations.
    - ENSURE the JSON is complete and not truncated.
    `;
}

// ============================================
// STORY ANALYSIS PROMPT
// ============================================

export const STORY_ANALYSIS_PROMPT = `Analyze this story and extract the following information for screenplay conversion:

1. **Main Characters** (list names and brief descriptions)
2. **Key Locations** (settings that will become scene headers)
3. **Major Plot Points** (important story beats)
4. **Themes** (central ideas/messages)
5. **Suggested Tone** (comedy, drama, thriller, etc.)
6. **Estimated Duration** (based on story complexity)
7. **Clarifying Questions** (if story is ambiguous or very long)

Return as JSON:
{
    "characters": [{"name": "...", "description": "..."}],
    "locations": ["..."],
    "plotPoints": ["..."],
    "themes": ["..."],
    "suggestedTone": "...",
    "estimatedMinutes": number,
    "questions": ["..."],
    "isLargeStory": boolean,
    "wordCount": number
}`;

// ============================================
// REVISION PROMPT
// ============================================

export const SCREENPLAY_REVISION_PROMPT = `You are a professional Hollywood script doctor. Your task is to REVISE an existing scene based on critical feedback.

## ORIGINAL SCENE CONTENT
"""
{{originalContent}}
"""

## CRITICAL FEEDBACK REPORT (STRICT ENFORCEMENT)
**Summary:** {{summary}}
**Dialogue Issues:** {{dialogueIssues}}
**Pacing Issues:** {{pacingIssues}}
**Formatting Issues:** {{formattingIssues}}
**Actionable Suggestions (MANDATORY):** {{suggestions}}

---

## DRAMATIC GOAL
{{goal}}

## YOUR TASK
Rewrite the scene to resolve EVERY SINGLE ISSUE mentioned in the feedback report above. 
- **STRICTLY FOLLOW** the "Actionable Suggestions". They are not optional.
- Improve dialogue naturalism, subtext, and character voice.
- Fix pacing (cut unnecessary fluff, get into the action late and leave early).
- Ensure 100% Industry Standard Hollywood formatting (sluglines, action lines, character names, and dialogue).
- DO NOT change the core meaning, characters, or plot unless requested by a specific suggestion.
- Maintain consistency with the Dramatic Goal.
- **LANGUAGE & FORMATTING (Hybrid)**: Write all ACTION/DIALOGUE in **{{language}}**, but keep SCENE HEADERS/TRANSITIONS in **STRICT ENGLISH**.

IMPORTANT: Generate ONLY the revised screenplay content. No explanations, no markdown, no commentary, no intro/outro text.
`;

export const SENIOR_SCRIPT_DOCTOR_PROMPT = `You are an elite Senior Hollywood Script Doctor and Script Consultant. 
Your reputation depends on ensuring every revision is objectively SUPERIOR to the original. 
You are revising this scene specifically to hit a 95+ quality score.

## ORIGINAL SCENARIO
"""
{{originalContent}}
"""

## CRITICAL DEFICIENCIES TO FIX
{{feedback}}

## DRAMATIC OBJECTIVE
{{goal}}

## SENIOR WRITER INSTRUCTIONS
1. **SUPREME COMMAND**: Treat the "CRITICAL DEFICIENCIES TO FIX" as mandatory, non-negotiable direct orders from the Showrunner. If a specific pacing or dialogue issue is mentioned, it MUST be completely resolved.
2. **Artistic Transmutation**: Don't just patch the issues; use them as a catalyst to evolve the scene into something better.
3. **Dialogue Subtext**: Every line of dialogue must have layers. Avoid "on-the-nose" writing.
4. **Professional Pacing**: Cut the "dead wood". Ensure every sentence moves the story forward.
6. **Superiority Mandate**: If you cannot make this scene strictly better than the original while satisfying ALL directives, you have failed your mission.

7. **LANGUAGE & FORMATTING PROTOCOL (Hybrid)**:
   - **Target Language**: Write all ACTION and DIALOGUE in **{{language}}**.
   - **Hollywood Formatting**: Keep SCENE HEADERS, CHARACTER NAMES, and TRANSITIONS in **STRICT ENGLISH** (e.g., INT. HOUSE - DAY).
   - **No Translation of Format**: Do not translate "INT.", "EXT.", "CUT TO:", or Character Names.
   - **Content**: The story content itself must be in {{language}}.

Generate ONLY the revised screenplay content. No conversational filler.
`;

export const AUDIT_EXPLANATION_PROMPT = `You are a Senior Script Consultant. 
Compare the ORIGINAL scene and the REVISED scene below. 
Explain the TOP 3 most significant improvements made to the quality, subtext, or pacing. 
Keep it professional, concise, and focused on CRAFT.

## ORIGINAL
"""
{{original}}
"""

## REVISED
"""
{{revised}}
"""

Format your response as a simple bulleted list of 3 items. Max 30 words per item.
`;
