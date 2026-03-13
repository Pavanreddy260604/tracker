# Debug Tool Index

These tools remain in place during cleanup pass 1. They are executable diagnostics, not passive artifacts.

## Frontend

| Path | Purpose | Run Command | Dependencies | Status |
| --- | --- | --- | --- | --- |
| `frontend/debug_blank_chat.js` | Reproduces or inspects blank-chat behavior and emits debug output | `node debug_blank_chat.js` | Frontend dependencies, local app state/API availability as needed | Retained |

## Script Writer Service

| Path | Purpose | Run Command | Dependencies | Status |
| --- | --- | --- | --- | --- |
| `script-writer-service/check_chunk_distribution.ts` | Inspect chunk distribution after ingestion/parsing | `npx tsx check_chunk_distribution.ts` | Service deps, database/script data | Retained |
| `script-writer-service/diagnose_db.ts` | Inspect database records and relationships | `npx tsx diagnose_db.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/diagnose_fields.ts` | Inspect field-level ingest or model issues | `npx tsx diagnose_fields.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/diagnose_inception_validation.ts` | Diagnose validation behavior for the Inception screenplay | `npx tsx diagnose_inception_validation.ts` | Service deps, screenplay fixtures/data | Retained |
| `script-writer-service/diagnose_parent.ts` | Inspect parent/child linkage issues | `npx tsx diagnose_parent.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/diagnose_pk_chunks.ts` | Diagnose PK chunk generation/classification | `npx tsx diagnose_pk_chunks.ts` | Service deps, screenplay fixtures/data | Retained |
| `script-writer-service/find_scenes.ts` | Search or inspect scene boundaries in stored scripts | `npx tsx find_scenes.ts` | Service deps, database/script data | Retained |
| `script-writer-service/list_scripts.ts` | List available scripts or versions for debugging | `npx tsx list_scripts.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/test-extract-character-cue.ts` | Focused parser/extractor regression for character cues | `npx tsx test-extract-character-cue.ts` | Service deps | Retained |
| `script-writer-service/test-full-flow.ts` | Exercise a broader ingest/parse flow | `npx tsx test-full-flow.ts` | Service deps, MongoDB, optional external services | Retained |
| `script-writer-service/test-log-loop.ts` | Debug logging/control-flow loops | `npx tsx test-log-loop.ts` | Service deps | Retained |
| `script-writer-service/test-scene-header-edge-cases.ts` | Validate scene-header parser edge cases | `npx tsx test-scene-header-edge-cases.ts` | Service deps | Retained |
| `script-writer-service/test_fountain_parser.ts` | Validate Fountain parser behavior | `npx tsx test_fountain_parser.ts` | Service deps | Retained |
| `script-writer-service/test_hierarchical_rag.ts` | Inspect hierarchical retrieval behavior | `npx tsx test_hierarchical_rag.ts` | Service deps, vector/db services | Retained |
| `script-writer-service/test_parser.ts` | Generic parser smoke/regression script | `npx tsx test_parser.ts` | Service deps | Retained |
| `script-writer-service/test_parser_polish.ts` | Parser regression checks for refined heuristics | `npx tsx test_parser_polish.ts` | Service deps | Retained |
| `script-writer-service/test_pk.js` | Node-based PK-specific debug script | `node test_pk.js` | Service deps, screenplay fixtures/data | Retained |
| `script-writer-service/test_scene_naming.ts` | Inspect scene naming output | `npx tsx test_scene_naming.ts` | Service deps | Retained |
| `script-writer-service/test_semantic_dedupe.ts` | Inspect semantic dedupe logic | `npx tsx test_semantic_dedupe.ts` | Service deps, vector/db services | Retained |
| `script-writer-service/verify_deletion.ts` | Verify deletion path behavior | `npx tsx verify_deletion.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/verify_exact_screenplay_reconstruction.ts` | Regression verification for exact screenplay reconstruction | `npx tsx verify_exact_screenplay_reconstruction.ts` | Service deps, screenplay fixtures/data | Retained |
| `script-writer-service/verify_ingestion.ts` | Verify ingestion pipeline behavior | `npx tsx verify_ingestion.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/verify_rag_hardening.ts` | Verify RAG hardening changes | `npx tsx verify_rag_hardening.ts` | Service deps, vector/db services | Retained |
| `script-writer-service/verify_retrieval.ts` | Verify retrieval/search results | `npx tsx verify_retrieval.ts` | Service deps, vector/db services | Retained |
| `script-writer-service/verify_title_page_fix.ts` | Verify title-page/body split handling | `npx tsx verify_title_page_fix.ts` | Service deps, screenplay fixtures/data | Retained |
| `script-writer-service/view_chunks.ts` | Inspect stored chunks in TypeScript entrypoint form | `npx tsx view_chunks.ts` | Service deps, MongoDB | Retained |
| `script-writer-service/view_chunks.js` | Inspect stored chunks in plain Node entrypoint form | `node view_chunks.js` | Service deps, MongoDB | Retained |

## Notes

- These tools are intentionally kept in place for discovery and short debugging cycles.
- Passive outputs generated by these tools should be archived under `artifacts/debug/...`.
