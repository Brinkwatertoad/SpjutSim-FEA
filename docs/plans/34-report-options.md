# Plan 34: Optional report customization with complete defaults

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document records implementation scope and does not authorize publication.

**Status:** Implemented — automated verification recorded; owner walkthrough pending. See [review](../reviews/34-report-options.md).

**Goal:** Let users tailor useful reports without requiring configuration before export.

**Architecture:** One report content model supplies DOCX and ZIP. A small validated options object controls presentation/additional user content while mandatory engineering context remains coupled to reported results.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 11.9, 15.1–15.3, 18 and 20.1.

## Dependencies and boundaries

- Follows Plans 28–33. Preserve existing report format control. Group format, Export and options beside Solve/Results, as requested in the owner follow-up.
- Default one-action export remains complete. No report designer, external Office dependency or required template selection.
- Persistent probes/case comparisons are integrated by their later plans, not simulated here.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Modify `web/js/ui/report-export.js`, `report-docx.js` and `web/js/render/report-capture.js`.
- Add report-options UI near Export through `web/js/ui/ui-controller.js` and `web/index.html`; extract `report-options.js` only if it owns independent validation/persistence.
- Extend `tests/browser/report-tests.js`, `report-workflow-tests.js`, `docx-tests.js` and Python package inspection where currently used.

## Work

### 1. Define defaults and invariant report content

- [x] Add options tests proving absent/corrupt preferences produce the existing complete report and Restore defaults reproduces it.
- [x] Allow a title, user notes, selection of available scene views, and optional current-view capture. Escape all user text; unsupported/unavailable views show a clear reason.
- [x] Keep source/setup identification, units, assumptions, warnings, currency, convergence and visualization explanations with any reported result. Options cannot silently omit those qualifiers.

### 2. Capture and export selected content reliably

- [x] For current-view capture, record actual camera, field, units, deformation scale, limits and clipping; keep existing reset/fitted presets as defaults.
- [x] Preserve scene/UI restoration on success, cancellation, stale revision and capture failure. Stream/sequence captures where possible instead of retaining redundant pixel buffers.
- [x] Keep DOCX and ZIP semantic content aligned, preserve editable tables/image proportions, and remember only compact options. User notes do not invalidate analysis.

### 3. Verify first-use and customized exports

- [x] Open a fresh app and export without configuring options; compare its required content and preset images to the established baseline.
- [x] Export a customized report, restore defaults, reopen options with unavailable FoS and inject a failed capture.
- [x] Update documentation and report workflow coverage for project volume/mass, suppressed assignments and optional views.

## Verification and acceptance

Run DOCX/ZIP structure, CRC/XML/escaping and real solved-capture tests, plus current report, unit, project and result regressions. Independently open generated packages, inspect view captions and measure peak memory for the full image set. Complete applicable suites and owner visual inspection of editable output; record unavailable viewers honestly.

Implementation and automated checks are complete. Any unchecked composite task retains
its measurement/manual-review portion; see the review for exact evidence and limits.

## Owner walkthrough

Export a useful report immediately, then add a note and current view through the options icon. Restore defaults and verify warnings, units and assumptions remain in both formats. Confirm export restores the viewport exactly.

Record actual implementation evidence and the owner's response in `docs/reviews/34-report-options.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
