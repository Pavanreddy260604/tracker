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

export const STYLE_PROMPTS = {
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
    }
};

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
    }
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

    if (options?.genre) {
        prompt += `**Genre:** ${options.genre}\n`;
    }
    if (options?.tone) {
        prompt += `**Tone:** ${options.tone}\n`;
    }
    if (options?.duration) {
        prompt += `**Target Duration:** ${options.duration} minutes\n`;
    }

    prompt += `
## THE STORY TO WRITE

${userPrompt}

---

Now write the complete screenplay. Begin with FADE IN: and use proper Hollywood formatting throughout.`;

    return prompt;
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
