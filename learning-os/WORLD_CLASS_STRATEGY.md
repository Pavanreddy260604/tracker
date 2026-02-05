# WORLD CLASS SCRIPT STRATEGY: "The Writer's Room"

You asked for the **Best Script Generator in the World**, not just a decent one.
To achieve "Oscar-Level" quality, we cannot simply rely on a single recursive loop. We need to simulate a **Professional Writer's Room**.

## The Core Philosophy: "Overhead is Quality"

You mentioned "overhead." In software, overhead is bad. In art, **structure is everything**.
A "zero overhead" script is a stream-of-consciousness hallucination.
A "high structure" script has foreshadowing, character arcs, and payoffs.

## The 4-Agent "Swarm" Architecture

Instead of one AI doing everything, we deploy 4 specialized "Experts" that run on your local Ollama instance.

### 1. The Architect (Logic & Structure)
*   **Role**: Showrunner.
*   **Job**: Never writes dialogue. Only writes the **Beat Sheet (Scene List)**.
*   **Focus**: Pacing, Arcs, Climax, "Save the Cat" moments.
*   **Output**: A JSON list of 60 scenes with strict goals.
    *   *Scene 15 Goal: Hero realizes the villain is his brother.*

### 2. The Character Psychologist (Voice & Soul)
*   **Role**: Character consistency.
*   **Job**: Before a scene is written, it analyzes the characters involved.
*   **Focus**: "What is the subtext?", "What does he want versus what does he say?", "Does this sound like him?"
*   **Output**: A "Voice Prompt" injected into the Writer.
    *   *Note: Jack is angry but hiding it. Use short sentences.*

### 3. The Cinematographer (The Writer)
*   **Role**: The actual drafting.
*   **Job**: Takes the [Scene Goal] + [Character Notes] and generates the screenplay text.
*   **Focus**: Visuals, Dialogue, "Show Don't Tell".
*   **Model**: Needs a high creative temperature (0.8).

### 4. The Editor (The Critic)
*   **Role**: Quality Assurance.
*   **Job**: Reads the generated scene.
*   **Checklist**:
    *   Is the dialogue too expositional?
    *   Is the formatting 100% standard?
    *   Did it achieve the Scene Goal from the Architect?
*   **Action**: If "Fail", it triggers a **Regenerate** with specific feedback.

## 5. The Voice Engine (Solving Slang & Accents)
Generic models (even 120B) sound like "Generic Hollywood" because they are trained on Wikipedia and Books. They fail at specific slangs (e.g., South London grime, Hyderabadi Telugu-English, 1920s Noir).

**The Solution: "RAG Voice Banks" (Mimicry, not Creativity)**
We do not ask the AI to "imagine" the slang. We **force** it to mimic examples.

1.  **User Uploads "Voice Samples":**
    *   User uploads a PDF of *The Wire* (for Baltimore slang) or *Peaky Blinders* (for Birmingham dialect).
    *   User uploads chat logs or raw text of the target dialect.
2.  **Vector Embedding:** system chops these into small dialogue snippets and indexes them.
3.  **Injection:** When writing a scene, the system retrieves 5-10 examples of *that specific slang* and injects them into the prompt.
    *   *Prompt:* "Here are 5 examples of how Jack speaks: [Examples...]. Write Jack's next line using THIS EXACT grammar and vocabulary."

**Result:** The AI mimics the *cadence, syntax, and vocabulary* of the source material perfectly, significantly outperforming "imitation" prompts.

## 6. The Neural Link (Interconnections & Foreshadowing)
You raised a critical point: Modular scenes often lack global glue (foreshadowing, callbacks).
To fix this, we introduce the **"Plot Graph"** (Metadata, not just Text).

**The "Active Thread" System**
We do not just store text. We store "Open Loops".

1.  **Chekhov's Gun Register**:
    *   When Scene 5 introduces a "Silver Locket", the Critic Agent tags it: `{ item: "Silver Locket", status: "active", introduced_in: 5 }`.
2.  **The Callback Injector**:
    *   When the Architect plans Scene 40 (The Climax), it scans the "Active Register".
    *   It sees "Silver Locket" is unresolved.
    *   It modifies the prompt for Scene 40: *"Constraint: You MUST reference the Silver Locket from Scene 5. Use its description: [rusty, broken clasp]."*

**Result:** The AI in Scene 40 *knows* about Scene 5, even if it wasn't in the immediate context window. It "remembers" the foreshadowing because we explicitly tracked it.

---

## Addressing "Overhead" (Speed vs Quality)

This sounds slow. Here is how we make it **Fast**:

### 1. Parallel "Dreaming" (Speculative Execution)
While you are reading/editing Scene 1, the AI is already **Drafting Scene 2** in the background. It stays 1 step ahead of you.

### 2. The "Fast Draft / Slow Polish" Mode
*   **Draft Mode**: Uses a smaller, faster model (Llama3-8B) to generate the skeletal scene instantly.
*   **Polish Mode**: Uses the heavy model (GPT-OSS 120B) only when you click "Finalize Scene".

## Implementation Roadmap

1.  **Phase 1: The Backbone (Database)**
    *   We MUST refactor the DB to store strict `Scenes` and `Characters` separately. This is non-negotiable for world-class coherence.

2.  **Phase 2: The Architect UI**
    *   A specialized interface to drag-and-drop scenes (The Beat Sheet Board).

3.  **Phase 3: The Critic Loop**
    *   Implementing the auto-critique prompt.

## Conclusion

To be the "Best in the World", we stop generating **Text**. We start generating **Drama**.
Drama requires memory, structure, and intent. The "Writer's Room" architecture is the only way to achieve this locally.
