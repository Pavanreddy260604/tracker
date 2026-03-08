# Hybrid Validation Implementation (Custom Gate + Great Expectations)

## 1) Architecture Flow

1. `POST /api/script/admin/master-scripts/:id/process` reserves a new `scriptVersion` and starts background processing.
2. Pipeline stages data in version scope:
   - source ledger (`MasterScriptSourceLine`)
   - scene parent nodes + element child chunks (`VoiceSample`, `ingestState=staging`)
   - vector index rows with metadata (`scriptVersion`, `sceneSeq`, `elementSeq`, provenance fields)
3. Custom gate runs strict validation:
   - full source-line coverage
   - strict order monotonicity
   - reconstruction equivalence (normalized)
   - hierarchy integrity (child -> scene parent)
4. If gate fails:
   - script remains on previous active version
   - status set to `failed`
   - validation report stored
5. If gate passes:
   - promote staged version to active
   - delete old active version rows/vectors
   - run GE audit
   - store GE audit output in validation report

## 2) Data Contracts and Index Strategy

### MasterScript
- Added:
  - `activeScriptVersion`
  - `processingScriptVersion`
  - `parserVersion`
  - `gateStatus`
  - `lastValidationSummary`

### VoiceSample (master-feed provenance)
- Added:
  - `scriptVersion`, `parserVersion`, `chunkId`
  - `sceneSeq`, `elementSeq`, `elementType`
  - `sourceStartLine`, `sourceEndLine`, `sourceLineIds[]`
  - `ingestState` (`staging | active | archived`)
- Important index:
  - unique `(masterScriptId, scriptVersion, chunkId)` for deterministic idempotency.

### Source Ledger
- `MasterScriptSourceLine`:
  - `lineNo`, `rawText`, `lineHash`, `lineId`, `scriptVersion`
- Unique indexes:
  - `(masterScriptId, scriptVersion, lineNo)`
  - `(masterScriptId, scriptVersion, lineId)`

### Validation Report
- `MasterScriptValidationReport`:
  - `status`
  - `missingLines[]`, `extraLines[]`
  - `orderMismatches[]`, `reconstructionMismatch`, `hierarchyMismatches[]`
  - `summary`
  - `geAudit` payload

## 3) Validator Algorithm and Failure Semantics

The custom gate validates one `masterScriptId + scriptVersion`:

1. Load source ledger lines sorted by `lineNo`.
2. Load staged leaf chunks sorted by `(sceneSeq, elementSeq, chunkIndex)`.
3. Coverage:
   - each source `lineId` must be mapped exactly once through `sourceLineIds[]`.
   - missing -> `missingLines`.
   - mapped multiple times -> `extraLines`.
4. Order:
   - scene order must never regress.
   - `elementSeq` must strictly increase within each scene.
5. Hierarchy:
   - every child has `parentNodeId`.
   - parent exists in same scriptVersion.
   - parent `sceneSeq` must match child `sceneSeq`.
6. Reconstruction:
   - rebuild normalized text from mapped source lines in chunk traversal order.
   - compare with normalized source text.
7. Gate decision:
   - pass only if all sections above are clean.
   - fail otherwise; no promotion.

## 4) Great Expectations Scope and Limits

GE is a secondary audit layer, not the correctness gate.

Implemented GE integration:
- Python script: `scripts/ge_master_audit.py`
- Node runner: `src/services/geAudit.service.ts`
- Triggered automatically post-promotion and manually via endpoint.

Current GE checks:
- row-count consistency
- required non-null fields
- unique `chunkId`
- `sourceStartLine <= sourceEndLine`
- parent link non-null

If GE or Python deps are unavailable, audit is marked `skipped` and does not block promotion.

Prerequisites for full GE execution:
- Python 3 installed and reachable as `python`
- `pip install great_expectations pandas`

## 5) Runbook

### Process a master script
- `POST /api/script/admin/master-scripts/:id/process`
- Response includes `scriptVersion` and `gateStatus=pending`.

### Inspect chunks
- `GET /api/script/admin/master-scripts/:id/chunks?scriptVersion=<version>`
- If `scriptVersion` omitted, active version is used.

### Inspect validation report
- `GET /api/script/admin/master-scripts/:id/validation-report?scriptVersion=<version>`

### Run GE audit on demand
- `POST /api/script/admin/master-scripts/:id/audit` with optional `{ "scriptVersion": "..." }`

### Scheduled GE audit
- `npm run audit:ge:scheduled`
- Intended for cron/task scheduler.

## 6) Tradeoffs

### Custom gate vs GE-only
- Custom gate gives deterministic screenplay-specific correctness.
- GE-only cannot guarantee full ordered reconstruction semantics.

### Strict exactness vs cost
- Exact reconstruction improves reliability, but increases ingestion/storage/validation work.

### Scene hierarchy richness vs complexity
- Scene parent + element children improves semantic retrieval and audit clarity.
- Requires extra provenance fields and parent-link checks.

### Staged promotion safety vs latency
- Staging + gate prevents bad data from becoming active.
- Adds validation and promotion delay before activation.
