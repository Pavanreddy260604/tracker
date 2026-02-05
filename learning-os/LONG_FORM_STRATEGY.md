# SCRIPT WRITER 2.0: Long-Form Generation Strategy

You are absolutely right. A feature film is 100-120 pages. Current LLMs (even 120k context) cannot generate a cohesive, high-quality script in a *single shot*. They lose the plot, the characters become generic, and the formatting degrades after page 10.

To build a **Production-Grade Script Writer**, we must move from "One-Shot Generation" to **"Recursive Hierarchical Generation"**. This mimics how human screenwriters work.

## The Strategy: "The Snowflake Method"

We break the file generation into 4 distinct phases. The user must approve each phase before the AI proceeds to the next.

### Phase 1: The Architecture (Story Bible)
**Goal:** Establish the persistent truths of the story.
**Input:** User Idea.
**Output (JSON):**
- **Logline**: 1 sentence summary.
- **Character Roster**: Names, ages, core desires, detailed "voice" instructions.
- **World Rules**: Tone, setting, visual style.
- **Context Cost**: ~1,000 tokens. (Always included in future prompts).

### Phase 2: The Beat Sheet (The Skeleton)
**Goal:** Structure the narrative arc.
**Input:** Architecture.
**Output:** A list of **40-60 Scene Headers** with a 1-sentence summary for each.
- *Scene 1: INT. APARTMENT - DAY. Jack wakes up and realizes he is late.*
- *Scene 2: EXT. SUBWAY - DAY. Jack loses his wallet.*
- ...
**Context Cost**: ~3,000 tokens.

### Phase 3: "Rolling Window" Scene Generation
**Goal:** Write the actual content, one scene at a time.
**The Trick:** When writing Scene 15, we do **NOT** feed Scenes 1-14. That kills the context window.
**Instead, we feed:**
1.  **The Story Bible** (from Phase 1).
2.  **The Beat Sheet Summary** for Scene 15 (what *needs* to happen).
3.  **The Tail Context**: The last 20 lines of dialogue from Scene 14 (for continuity).
4.  **The "Story So Far"**: A compressed AI-generated summary of Scenes 1-14.

**Result:** Infinite length potential. The AI always has "fresh" context.

---

## Technical Implementation Plan

### 1. Database Schema Refactor
Move from a simple `content: string` to a Scene-based model.
```typescript
interface Script {
  _id: ObjectId;
  bible: {
    characters: Character[];
    tone: string;
  };
  scenes: {
    id: string;
    slugline: string; // INT. PUB - NIGHT
    goal: string;     // "Hero refuses the call"
    content: string;  // The actual screenplay text
    status: 'pending' | 'draft' | 'locked';
  }[];
}
```

### 2. Frontend "Showrunner UI"
Replace the single text editor with a **Master-Detail View**:
- **Left Sidebar**: The "Beat Sheet" (list of scenes).
- **Center**: The Editor for the *active scene*.
- **Right Sidebar**: Context Awareness (Character notes, Story Bible).

### 3. "Stitching" Export
When the user clicks "Download PDF", the backend stitches all `scenes.content` together into one seamless `.fountain` or `.pdf` file.

### Summary
This strategy solves the context window problem completely. We trade "one-click magic" for a "collaborative workflow" which produces vastly superior, feature-length results.
