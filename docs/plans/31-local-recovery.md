# Plan 31: Lightweight local project recovery

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document records implementation scope and does not authorize publication.

**Status:** Implemented — automated verification recorded; owner walkthrough pending. See [review](../reviews/31-local-recovery.md).

**Goal:** Recover the last committed setup after an interrupted session without repeatedly writing mesh/result buffers.

**Architecture:** Recovery consumes the portable setup snapshot and owns asynchronous browser storage separately from manual files. CAD blobs are keyed by source identity; small setup records are committed transactionally with bounded retention.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.6, 15.9, 18, 20.1, 23 and 26.

## Dependencies and boundaries

- Requires Plan 30 snapshot/validation contracts.
- Manual portable save/open continues to work if recovery storage is denied, unavailable or full.
- Recover committed engineering state, not incomplete drafts, undo history, mesh/results or worker readiness.
- Automatically reopen the previous part/setup; report errors or live-tab conflicts. Manual copies/discard remain under File.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/analysis/project-recovery.js`: scheduling, IndexedDB storage adapter, source deduplication, record ownership and retention.
- Modify `web/js/app.js` and `web/js/analysis/project-document.js`: committed snapshot notifications and restoration through the normal validated open path.
- Modify `web/js/ui/ui-controller.js`, `web/index.html`: error-only recovery status, automatic startup restore, clear stored recovery.
- Create `tests/browser/project-recovery-tests.html/js` and extend `project-workflow-tests.js`.

## Work

### 1. Persist bounded recoverable snapshots

- [x] Add tests using an injected storage/clock adapter for burst edits, no-op edits, source changes, interrupted writes, stale write completions and storage errors.
- [x] Coalesce synchronous committed edits without a fixed delay, write CAD once per source identity, and atomically advance the setup record only after all required source data is durable.
- [ ] Define explicit retention limits for recovery records/source bytes using representative CAD measurements. Keep a last valid snapshot during replacement and garbage-collect unreferenced source blobs after successful commits.
- [x] Scope ownership by session/project and use transaction generation checks so two tabs cannot silently overwrite each other's recovery. Surface conflicts and stop unsafe writes.

### 2. Restore and discard predictably

- [x] Automatically restore the previous setup; expose older copies with model name and timestamp; restore through Plan 30 validation and identity checks. Include discard and clear-storage actions.
- [x] Keep manual saved status and recovered/unsaved status distinct. A storage failure reports that recovery is unavailable while preserving in-memory work.
- [ ] Test startup with corrupt metadata, missing source, incompatible schema, quota failure and a competing live session. Do not rely on unload-time asynchronous writes.

### 3. Verify responsiveness and privacy

- [ ] Confirm numerical buffers are never traversed by ordinary recovery writes; measure a burst of setup edits during viewport use.
- [x] Verify exact behavior in supported file/HTTP browser modes and document origin/storage limits. Do not introduce a server or network fallback.
- [x] Include source cleanup on discard/replacement and project close in failure/retry tests.

## Verification and acceptance

Run recovery pure/storage/workflow tests plus project, history, draft and file-startup regressions, followed by complete applicable suites. Inject failures between source and manifest commits and prove a previous snapshot remains usable. Record write counts/bytes and retained-source bounds; an unchanged source must not be serialized per edit.

Implementation and automated checks are complete. Any unchecked composite task retains
its measurement/manual-review portion; see the review for exact evidence and limits.

## Owner walkthrough

Make several committed changes and reload: the setup should reopen automatically. Use New and reload again: the workspace should remain empty. Confirm a half-entered draft is not presented as committed. Discard recovery, simulate unavailable storage, and verify manual Save still works with a clear status.

Record actual implementation evidence and the owner's response in `docs/reviews/31-local-recovery.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
