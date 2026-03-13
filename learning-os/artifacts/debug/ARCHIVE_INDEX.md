# Debug Archive Index

Cleanup pass: `2026-03-09`

This inventory records passive artifacts moved out of active service roots during the safe cleanup pass. Nothing listed here was deleted.

## Root Passive Artifacts

| Original Location | Archive Location | Reason Kept | Class | Safe To Regenerate |
| --- | --- | --- | --- | --- |
| `backend-dev.err.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/backend-dev.err.log` | Historical root dev stderr for backend startup/debug sessions | Passive debug evidence | Yes |
| `backend-dev.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/backend-dev.log` | Historical root dev stdout for backend startup/debug sessions | Passive debug evidence | Yes |
| `dev-root.err.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/dev-root.err.log` | Historical monorepo root stderr capture | Passive debug evidence | Yes |
| `dev-root.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/dev-root.log` | Historical monorepo root stdout capture | Passive debug evidence | Yes |
| `frontend-dev.err.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/frontend-dev.err.log` | Historical root dev stderr for frontend startup/debug sessions | Passive debug evidence | Yes |
| `frontend-dev.log` | `artifacts/debug/root/2026-03-09-passive-artifacts/frontend-dev.log` | Historical root dev stdout for frontend startup/debug sessions | Passive debug evidence | Yes |
| `index.css.tmp` | `artifacts/debug/root/2026-03-09-passive-artifacts/index.css.tmp` | Scratch generated stylesheet output retained for investigation history | Passive debug evidence | Yes |
| `response.json` | `artifacts/debug/root/2026-03-09-passive-artifacts/response.json` | Scratch response capture retained for investigation history | Passive debug evidence | Usually |
| `sample_src_files.txt` | `artifacts/debug/root/2026-03-09-passive-artifacts/sample_src_files.txt` | Scratch inventory output retained for investigation history | Passive debug evidence | Yes |

## Backend Passive Artifacts

| Original Location | Archive Location | Reason Kept | Class | Safe To Regenerate |
| --- | --- | --- | --- | --- |
| `backend/full_tsc_output.txt` | `artifacts/debug/backend/2026-03-09-passive-artifacts/full_tsc_output.txt` | TypeScript compiler output retained for historical diagnosis | Passive debug evidence | Yes |
| `backend/tsc_errors.log` | `artifacts/debug/backend/2026-03-09-passive-artifacts/tsc_errors.log` | TypeScript error log retained for historical diagnosis | Passive debug evidence | Yes |
| `backend/tsc_new_errors.txt` | `artifacts/debug/backend/2026-03-09-passive-artifacts/tsc_new_errors.txt` | Scratch comparison of new TypeScript errors | Passive debug evidence | Yes |
| `backend/tsc_out.txt` | `artifacts/debug/backend/2026-03-09-passive-artifacts/tsc_out.txt` | Scratch compiler output retained for historical diagnosis | Passive debug evidence | Yes |
| `backend/tsc_plain.txt` | `artifacts/debug/backend/2026-03-09-passive-artifacts/tsc_plain.txt` | Plain-text compiler capture retained for diagnosis | Passive debug evidence | Yes |

## Frontend Passive Artifacts And Reports

| Original Location | Archive Location | Reason Kept | Class | Safe To Regenerate |
| --- | --- | --- | --- | --- |
| `frontend/build-errors.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/build-errors.txt` | Build failure capture retained for diagnosis history | Passive debug evidence | Yes |
| `frontend/build_log.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/build_log.txt` | Build log retained for diagnosis history | Passive debug evidence | Yes |
| `frontend/debug_out.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/debug_out.txt` | Output from retained frontend debug helper | Passive debug evidence | Yes |
| `frontend/git_log_frontend.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/git_log_frontend.txt` | Scratch Git history capture retained for diagnosis history | Passive debug evidence | Yes |
| `frontend/tsc_errors.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/tsc_errors.txt` | TypeScript error capture retained for diagnosis history | Passive debug evidence | Yes |
| `frontend/tsc_errors_final.txt` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/tsc_errors_final.txt` | Final TypeScript error comparison retained for diagnosis history | Passive debug evidence | Yes |
| `frontend/playwright-report/` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/playwright-report/` | Generated Playwright HTML report retained for test investigation | Generated report | Yes |
| `frontend/test-results/` | `artifacts/debug/frontend/2026-03-09-passive-artifacts/test-results/` | Generated Playwright result bundle retained for test investigation | Generated report | Yes |

## Script Writer Service Passive Artifacts

| Original Location | Archive Location | Reason Kept | Class | Safe To Regenerate |
| --- | --- | --- | --- | --- |
| `script-writer-service/audit_log.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/audit_log.txt` | Audit run log retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/audit_result.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/audit_result.txt` | Audit output retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/compile_errors.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/compile_errors.txt` | Compile error capture retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/diagnostic_output.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/diagnostic_output.txt` | Diagnostic output retained for diagnosis history | Passive debug evidence | Usually |
| `script-writer-service/final_audit.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/final_audit.txt` | Final audit summary retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/pk_chunks_output.txt` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/pk_chunks_output.txt` | PK chunk inspection output retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/verification_debug.log` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/verification_debug.log` | Verification debug log retained for diagnosis history | Passive debug evidence | Yes |
| `script-writer-service/verification_error.log` | `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/verification_error.log` | Verification error log retained for diagnosis history | Passive debug evidence | Yes |
