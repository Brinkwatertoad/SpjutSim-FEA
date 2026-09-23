# Plan 30: Portable project save/open

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document records implementation scope and does not authorize publication.

**Status:** Implemented — automated verification recorded; owner walkthrough pending. See [review](../reviews/30-portable-projects.md).

**Goal:** Reopen complete CAD/setup reliably, with optional compatible mesh/results, while keeping the installed project safe during failed opens.

**Architecture:** A versioned project codec serializes small engineering definitions and binary entries independently of the live document. The controller installs a fully validated candidate atomically; browser UI only chooses files/options and reports persistence status.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 4–6, 15.2, 18–20, 23 and 26.

## Dependencies and boundaries

- Builds on completed Plans 28–29. Highest-priority new delivery.
- Default file contains CAD and complete committed setup. Include mesh/results is opt-in.
- No cloud storage, arbitrary CAD remapping, runtime dependency, or automatically resumed worker.
- Distinguish project save/open from CAD replacement and report export. Keep toolbar arrangement.
- This plan owns durable snapshot/validation contracts reused by recovery and later analysis extensions.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/analysis/project-document.js`: versioned snapshot validation, persistence revision/dirty metadata, dependency fingerprints and candidate installation contracts.
- Create `web/js/io/project-file.js`: bounded project archive read/write and binary entry metadata. Extract shared stored-ZIP code from `web/js/ui/report-export.js` into `web/js/io/zip.js` only where both consumers genuinely reuse it.
- Modify `web/js/analysis/app-controller.js`, `analysis-document.js` and `web/js/app.js`: snapshot/install lifecycle, worker cancellation and stale-open identity guards.
- Modify `web/js/ui/ui-controller.js`, `web/index.html`: File Open/Save, existing Save action, optional-cache choice, dirty/error status.
- Extend `web/js/geometry/geometry-model.js` and mesher metadata only as needed for validated face identity.
- Create `tests/browser/project-file-tests.html/js` and `project-workflow-tests.html/js`; use existing CAD, report, worker and history fixtures.

## Work

### 1. Define and test the portable document boundary

- [x] Specify version-1 manifest fields: format/version, producer identities, source entry/name/format, source and per-face identity evidence, orientation, material/provenance snapshot, assignments/IDs/name counters, gravity, mesh/solve settings, project name and optional derived-data descriptors.
- [x] Define project dirty tracking separately from numerical revision so renames/notes save correctly. Exclude transient drafts, prepared checks, undo, workers, and global user libraries; preserve useful compact view choices without importing global preferences.
- [x] Add failing codec tests for complete round trips, unknown required versions, duplicate/missing entries, invalid paths/counts/offsets, nonfinite inputs and malformed references. Document explicit archive/manifest/allocation bounds against the existing memory model before implementing the bounded reader.
- [x] Implement binary entries without JSON/base64 expansion of mesh/results. Use Blob parts/slices and small metadata; compute source identity once and reuse it.

### 2. Restore source and setup transactionally

- [x] Stage source import and validate per-face identity evidence before applying any assignment. Test equal face counts with different face mappings, revised-engine identity, and orientation round trips. Ambiguity requires explicit review or actionable rejection; never nearest-face assignment.
- [x] Commit one candidate through the controller only after complete validation. Preserve the current analysis on cancellation, malformed archives, rejected mapping, import failure, and superseded asynchronous reads.
- [x] Reset transient worker/check/history state on successful open and retain ID/name uniqueness. Add unsaved-project handling that distinguishes Save, discard, and cancel without treating recovery as a portable save.

### 3. Add opt-in mesh/result retention

- [x] Validate cached mesh/result types, lengths, connectivity, source/orientation/setup fingerprints and producer/schema compatibility before allocation/install.
- [x] Restore valid derived fields for inspection; require a new preflight for a new solve. Offer setup-only open with an explanation when optional cache compatibility fails.
- [x] Test stale material/load/mesh fingerprints, truncated typed arrays, incompatible result schema, and geometry changed independently of the cache.

### 4. Integrate save/open and document the format

- [x] Enable existing Save and add File Open/Save with a descriptive `.spjutsim-fea` filename, default setup-only content and an optional Include mesh/results choice.
- [x] Save from a consistent committed revision and clear dirty state only for that snapshot; never mark later edits saved. Apply/Cancel a draft before opening another project.
- [x] Document file contents, version policy, cache behavior and direct-local support in README and `docs/project-format.md`. Regenerate worker wrappers only if worker source changes.

## Verification and acceptance

- Codec tests must fail before the corresponding behavior exists, then pass with valid and deliberately corrupted packages. Independently inspect saved archives and binary byte counts with Python.
- Real STEP project: import → author → save → fresh app → open → verify the same physical setup → mesh/solve against existing analytical values. Repeat source/setup round trips for IGES/BREP.
- Verify optional solved reopen, invalid cache fallback, cancel/overlapping opens, unchanged save, metadata edits, and no silent reassignment or numerical mutation.
- Exercise file/HTTP, unavailable optional browser APIs, keyboard file actions and failed-save retry. Measure peak allocations for source/setup versus optional-result files; do not retain duplicate full archives and numerical arrays.
- Run the complete applicable README suites and existing report/history/import/worker regressions after the shared ZIP or controller changes.

Implementation and automated checks are complete. Any unchecked composite task retains
its measurement/manual-review portion; see the review for exact evidence and limits.

## Owner walkthrough

Save a bracket setup, reopen it in a fresh app, and confirm faces, units and loads. Save a solved copy with results and inspect it without solving again. Open a damaged file and confirm the previous project survives. Check the default save is clearly distinct from report export.

Record actual implementation evidence and the owner's response in `docs/reviews/30-portable-projects.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
