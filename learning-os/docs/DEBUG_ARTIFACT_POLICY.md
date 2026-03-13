# Debug Artifact Policy

This repository keeps debug evidence, but it should not clutter active service roots.

## Classification Rules

| Class | Keep In Place | Archive | Ignore Future Outputs |
| --- | --- | --- | --- |
| Runtime code | Yes | No | No |
| Debug tools | Yes | No | No |
| Passive debug evidence | No | Yes | Yes |
| Generated reports | No | Yes | Yes |
| Experiments | Yes | No | No |

## Archive Convention

Store retained evidence under:

```text
artifacts/debug/<area>/<date-or-topic>/
```

Examples:

- `artifacts/debug/root/2026-03-09-passive-artifacts/`
- `artifacts/debug/frontend/2026-03-09-passive-artifacts/`
- `artifacts/debug/backend/2026-03-09-passive-artifacts/`
- `artifacts/debug/script-writer-service/2026-03-09-passive-artifacts/`

Each archive move must be documented in `artifacts/debug/ARCHIVE_INDEX.md` with:

- original location
- archive location
- reason for retention
- whether the artifact is an executable tool or passive output
- whether it is safe to regenerate

## Future Output Policy

- New logs, scratch JSON/TXT files, report folders, and one-off debug outputs should be written under `artifacts/debug/...`, not service roots.
- If a debug script still writes to a service root, keep the script for now and archive the generated output after use.
- Do not delete tracked debug evidence during cleanup pass 1. Archive it instead.
- Do not move executable debug scripts during cleanup pass 1.

## Experiment Policy

- `sample/` remains quarantined and untouched as a nested Git repository.
- `frontend-v2/` remains quarantined and untouched until explicitly promoted.
- Quarantined directories are not part of default runtime, build, or support expectations for this repo.
