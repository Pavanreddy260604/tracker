# Script Writer Pro - Premium UI Design Prompt

## Project Vision
Create a **world-class, premium AI-powered screenwriting application** that rivals Final Draft, Arc Studio Pro, and Celtx combined with the AI capabilities of Sudowrite and Jasper. The UI should feel like a $300/year professional software tool—dark, cinematic, and buttery smooth.

---

## Backend API Reference

The frontend has access to the following REST API endpoints running on `http://localhost:5001`:

### 1. Projects (Story Bibles)
```
GET    /api/bible?userId={userId}     → Get all projects for user
POST   /api/bible                      → Create new project
GET    /api/bible/:id                  → Get single project
PUT    /api/bible/:id                  → Update project
DELETE /api/bible/:id                  → Delete project (cascades to scenes)
```

**Project Object:**
```typescript
interface Bible {
  _id: string;
  userId: string;
  title: string;
  logline: string;
  genre: string;          // "Drama", "Sci-Fi", "Comedy", "Thriller", "Horror", "Action"
  tone: string;           // "dark", "hopeful", "suspenseful", "comedic"
  visualStyle: string;    // "Noir", "Wes Anderson", "Handheld", "Epic"
  rules: string[];        // ["No voiceovers", "Only takes place at night"]
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Scenes
```
GET    /api/scene?bibleId={bibleId}   → Get all scenes for project
POST   /api/scene                      → Create new scene
GET    /api/scene/:id                  → Get single scene
PUT    /api/scene/:id                  → Update scene
DELETE /api/scene/:id                  → Delete scene

POST   /api/scene/:id/generate         → AI Generate scene content (STREAMING)
```

**Scene Object:**
```typescript
interface Scene {
  _id: string;
  bibleId: string;
  sequenceNumber: number;     // 1, 2, 3...
  slugline: string;           // "INT. BAR - NIGHT"
  
  // Story Architecture
  summary: string;            // What happens in this scene
  goal: string;               // Protagonist's dramatic goal
  
  // Generated Content
  content: string;            // The actual screenplay text
  
  // Status Workflow
  status: 'planned' | 'drafted' | 'reviewed' | 'final';
  feedback?: string;          // Notes from review
  
  // Character Links
  charactersInvolved: string[];  // Character IDs
  mentionedItems: string[];      // Chekhov's guns
  previousSceneSummary?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Generate Scene Request:**
```typescript
POST /api/scene/:id/generate
Body: {
  userId: string;
  options: {
    style: "classic" | "tarantino" | "nolan" | "sorkin" | "wes_anderson" | "fincher";
    format: "film" | "tv" | "short";
    characterIds: string[];  // Which voices to enforce
  }
}
Response: ReadableStream (Server-Sent Events with script text)
```

---

### 3. Characters
```
GET    /api/character?bibleId={bibleId}  → Get all characters
POST   /api/character                     → Create character
GET    /api/character/:id                 → Get single character
PUT    /api/character/:id                 → Update character
DELETE /api/character/:id                 → Delete character
```

**Character Object:**
```typescript
interface Character {
  _id: string;
  bibleId: string;
  name: string;
  age: number;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  voice: {
    description: string;    // "Gruff, uses simple words"
    sampleLines: string[];  // ["I ain't doing that.", "Get lost."]
    accent?: string;
  };
  traits: string[];         // ["Limp", "Chain smoker"]
  motivation: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Voice Samples (Training Data)
```
POST   /api/voice/upload    → Upload audio for voice training
GET    /api/voice/:id       → Get voice sample
DELETE /api/voice/:id       → Delete voice sample
```

---

### 5. Story Engine (Treatment Generator)
```
POST   /api/treatment/generate
Body: { logline: string; genre: string; tone: string; }
Response: {
  beats: Array<{
    number: number;
    title: string;      // "Opening Image", "Theme Stated", "Catalyst"
    description: string;
  }>
}
```

---

## Current Frontend Tech Stack
- **React 18** with TypeScript
- **Vite** for bundling
- **Zustand** for state management
- **Tailwind CSS 4** with custom design system
- **Lucide React** for icons
- **React Router** for navigation

---

## Design Requirements

### 1. Overall Aesthetic
- **Dark cinematic theme** (deep blacks #0a0a0b, charcoal surfaces #111113)
- **Purple accent color** (#a855f7) for actions and highlights
- **Minimal, professional, distraction-free**
- Inspired by: **Linear, Raycast, Figma, Arc Browser, Notion**
- Typography: **Inter for UI, Courier Prime for screenplay text**

### 2. Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo] [Tabs: Home | Story | Script | Cast | Settings] [Project ▼] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────────────────────────────┐ ┌──────────────┐ │
│ │          │ │                                  │ │              │ │
│ │  SCENES  │ │       SCREENPLAY EDITOR          │ │  AI PANEL    │ │
│ │  LIST    │ │       (Paper-style)              │ │              │ │
│ │          │ │                                  │ │  - Summary   │ │
│ │ [Drag]   │ │  FADE IN:                        │ │  - Goal      │ │
│ │ [Reorder]│ │                                  │ │  - Cast      │ │
│ │          │ │  INT. BAR - NIGHT                │ │  - Style     │ │
│ │          │ │                                  │ │              │ │
│ │          │ │  JACK enters, orders whiskey.    │ │ [Generate]   │ │
│ │          │ │                                  │ │              │ │
│ └──────────┘ └──────────────────────────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [Status Bar: Project | Scene X of Y | Words | Saved ✓]             │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Key Pages/Screens

#### A. Project Dashboard
- Grid of project cards with title, genre tag, logline preview
- "New Project" CTA with modal form
- Quick actions: Open, Duplicate, Archive, Delete
- Search and filter

#### B. Studio Home (Project Hub)
- Hero section with project title and logline
- Quick stats: Scenes count, Characters count, Word count
- Recent activity timeline
- Quick action cards to navigate to Story/Script/Cast

#### C. Story Engine
- Large textarea for logline input
- Genre and tone selectors
- "Generate Beat Sheet" button
- Display 15-beat Save The Cat structure as cards
- One-click "Convert to Scenes" to bulk-create scenes

#### D. Script Editor (Main IDE)
- **Collapsible left panel**: Scene list with drag-reorder
- **Center**: Screenplay paper with proper formatting
- **Collapsible right panel**: Scene details, cast selector, AI generate
- **Toolbar**: Writing style dropdown, Auto-Write button, Export
- **Status bar**: Word count, save status, scene position

#### E. Cast Manager
- Two-column layout: Character list | Character detail
- Voice training section with audio upload
- Sample dialogue lines editor
- Role tags (protagonist/antagonist/supporting/minor)

#### F. Settings
- Project metadata (title, logline, tone)
- Visual style preferences
- Export options
- Danger zone (delete project)

---

### 4. Micro-interactions & Polish

- **Resizable panels** with drag handles
- **Keyboard shortcuts**: Cmd+S save, Cmd+G generate, Cmd+1/2/3 switch tabs
- **Auto-save indicator** (checkmark → spinner → dot)
- **Generation streaming** with live text appearing
- **Stop button** to abort generation
- **Toast notifications** for save/error states
- **Skeleton loaders** for async content
- **Smooth page transitions** (fade + slide)
- **Focus rings** on interactive elements
- **Hover states** on all clickable items

---

### 5. Premium Features to Design

1. **Version History** - Timeline of script changes
2. **Collaboration** - Real-time multi-user editing (future)
3. **Export Options** - PDF, Fountain, Final Draft (.fdx)
4. **Reading Mode** - Full-screen distraction-free view
5. **Character Insights** - AI analysis of dialogue patterns
6. **Scene Breakdown** - Shooting schedule assistant
7. **Mood Boards** - Upload reference images per scene

---

### 6. Mobile Responsiveness

- Tablet: Collapsible sidebars, stacked layout
- Phone: Read-only mode, scene list as carousel

---

## Design Deliverables Expected

1. **Project Dashboard** (with empty state)
2. **Studio Home** (project selected)
3. **Story Engine** (with generated beats)
4. **Script Editor** (3-panel IDE layout)
5. **Cast Manager** (with characters)
6. **Settings Page**
7. **Modals**: New Project, Delete Confirmation, Export Options

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Background | #0a0a0b | Base canvas |
| Surface | #111113 | Cards, panels |
| Surface 2 | #1a1a1d | Elevated elements |
| Border | #2a2a2e | Dividers, outlines |
| Text | #e4e4e7 | Primary text |
| Text Muted | #71717a | Secondary text |
| Accent | #a855f7 | CTAs, highlights |
| Accent Glow | rgba(168,85,247,0.3) | Shadows, focus |
| Success | #22c55e | Saved, complete |
| Warning | #f59e0b | In progress |
| Danger | #ef4444 | Delete, errors |

---

## Typography

- **Headings**: Inter, 700-800 weight
- **Body**: Inter, 400-500 weight
- **Monospace UI**: JetBrains Mono
- **Screenplay**: Courier Prime (12pt, 1.6 line height)

---

## Icon Style

- Lucide React icons
- 16-20px size in UI
- Stroke width 1.5-2
- Match text color, accent on active

---

## Animation Specs

- **Transitions**: 150-200ms ease-out
- **Page loads**: Fade up (opacity 0→1, translateY 12→0)
- **Panel resize**: Transform with 0ms (instant drag)
- **Generation pulse**: Scale 0.8→1 with opacity 0.5→1, infinite

---

## Notes for Designer

- This is a **standalone window** app (no browser chrome)
- Focus on **writer productivity** - minimal UI, maximum content
- The screenplay paper should feel like **real paper** (subtle texture, shadows)
- AI generation should feel **magical** - pulsing indicators, streaming text
- Every action should have **immediate feedback**

---

**End of Prompt**
