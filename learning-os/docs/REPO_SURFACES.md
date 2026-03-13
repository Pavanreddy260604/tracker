# Repository Surfaces

This repository currently has three active runtime surfaces and two quarantined experiment areas.

## Active Runtime Surfaces

| Path | Role | Notes |
| --- | --- | --- |
| `backend/` | Core API | Main application API and platform services |
| `frontend/` | Main web client | Primary React/Vite application |
| `script-writer-service/` | Script-writer service | Script ingestion, parsing, validation, and screenplay tooling |

Related runtime support:

| Path | Role | Notes |
| --- | --- | --- |
| `chroma/` | Local vector runtime data | Runtime support for script-writer flows |
| `chroma_data/` | Local vector runtime data | Additional local runtime support data |

## Quarantined / Experimental Areas

| Path | Status | Notes |
| --- | --- | --- |
| `sample/` | Quarantined experiment | Nested Git repository. Not part of root runtime or build expectations. Do not modify or merge its `.git` contents during repo cleanup. |
| `frontend-v2/` | Quarantined experiment | Inactive frontend work. Leave in place until it is either promoted or removed in a separate decision. |

## Current Cleanup Rule

- Runtime code stays in place.
- Quarantined experiments stay in place.
- Passive debug artifacts move into `artifacts/debug/...`.
- Executable debug tooling stays discoverable and tracked.
