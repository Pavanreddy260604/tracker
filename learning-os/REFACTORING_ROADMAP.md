# Master "Granular" Refactoring Plan (15 Phases)
This plan breaks down the remediation of the "Brutal Honest Code Review" into atomic, single-file or single-responsibility phases to ensure absolute control and verifiable quality at every step.

## Phase 1: Security - Encryption Core
**Target:** `backend/src/utils/encryption.ts`
- Remove the `|| 'default-key'` fallback.
- Add runtime check: `if (key.length !== 32) throw Error(...)`.
- **Verify:** Backend crashes if `.env` is invalid.

## Phase 2: Security - Environment & Secrets
**Target:** `backend/src/index.ts`, `backend/src/models/User.ts`
- Implement `validateEnv()` in `index.ts` to check `ENCRYPTION_KEY`, `MONGODB_URI`, `JWT_SECRET`.
- Audit `User.ts` schema and `toJSON` method to ensure `geminiApiKey` is strictly private.

## Phase 3: Backend - Database Reliability
**Target:** `backend/src/config/db.ts`
- Remove the hardcoded `mongodb://localhost` fallback strings.
- Force usage of `process.env.MONGODB_URI`.

## Phase 4: Frontend - Context Migration (Step 1)
**Target:** `frontend/src/contexts/AIContext.tsx`
- Copy the robust `sendMessage` implementation from the "Dead" context.
- Copy the `Message` interface and `messages` state.
- Ensure it exports all necessary types.

## Phase 5: Frontend - Context Cleanup (Step 2)
**Target:** `frontend/src/context/` (Folder)
- Delete `frontend/src/context/AIContext.tsx`.
- Delete the folder `frontend/src/context/`.
- **Verify:** Build fails? (It shouldn't if we migrate imports later, but we'll do widget refactor next).

## Phase 6: Frontend - Widget Refactor
**Target:** `frontend/src/components/GlobalAIWidget.tsx`
- Update imports to point to `contexts/AIContext` (plural).
- Remove internal `api.sendChatMessage` calls.
- Use `const { sendMessage, messages } = useAI()`.

## Phase 7: Frontend - Page Refactor
**Target:** `frontend/src/pages/ChatPage.tsx`
- Update imports to point to `contexts/AIContext`.
- Connect to the unified state (so side-bar chat and full-page chat are one).

## Phase 8: Backend - AI Error Handling
**Target:** `backend/src/services/ollama.service.ts`
- Remove empty `catch (e) {}` blocks.
- Throw custom `AIError` types that the frontend handles gracefully.

## Phase 9: Backend - AI Fallback Logic
**Target:** `backend/src/services/ollama.service.ts`
- Refactor the fallback chain to be explicit.
- Remove arbitrary `setTimeout` delays unless necessary for rate limiting.

## Phase 10: Backend - Service Extraction (DSA)
**Target:** `backend/src/routes/dsaProblems.ts` -> `backend/src/services/dsa.service.ts`
- Create `dsa.service.ts`.
- Move Mongoose queries (`find`, `sort`, `filter`) there.
- Route simply calls `DSAService.getProblems(req.query)`.

## Phase 11: API Decoupling - Infrastructure
**Target:** `frontend/src/services/api/`
- Create folder structure.
- create `auth.ts` and move auth methods there.

## Phase 12: API Decoupling - Features
**Target:** `frontend/src/services/api/`
- Move DSA methods to `dsa.ts`.
- Move Chat methods to `chat.ts`.
- Create `index.ts` to re-export everything (maintains compatibility).

## Phase 13: CSS - Standardization Config
**Target:** `frontend/tailwind.config.js`
- Define `colors.console-bg`, `colors.primary`.

## Phase 14: CSS - Refactor & Cleanup
**Target:** `frontend/src/index.css`
- Search and destroy `!important`.
- Replace hardcoded hex codes with Tailwind classes.

## Phase 15: Final Verification & Docs
**Target:** `README.md`, `backend/.env`, `frontend/.env`
- Full manual test.
- Document the new architecture.

## Completion Status (2026-02-17)
- [x] Phases 1-13 completed in earlier passes.
- [x] Phase 14 completed with chunk-based stylesheet cleanup (`frontend/src/styles/chunk1.css`, `frontend/src/styles/chunk2.css`).
- [x] Phase 15 completed with docs/environment refresh and full build verification.

### Notes
- Remaining `!important` rules are intentional and scoped:
  - Inline-style light override in `chunk1.css`
  - Reduced-motion accessibility overrides in `chunk17.css`
  - Zen panel width overrides in `chunk21.css`
