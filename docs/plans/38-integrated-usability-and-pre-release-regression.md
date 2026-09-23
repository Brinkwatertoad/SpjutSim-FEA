# Plan 38: Final integrated usability and pre-release regression

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — pre-v1

**Goal:** Verify the complete agreed pre-v1 workflow and collect owner usability acceptance before the exact release-candidate audit.

**Architecture:** This plan integrates the feature-local evidence from Plans 21–37 into a reproducible user walkthrough and changed-path regression matrix. Task 20 remains responsible for candidate identity, final hashes, release status and publication authorization.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 15–16, 18–23 and 26; accepted pre-v1 contracts in [the index](README.md).

## Dependencies and boundaries

- Former Plan 30, renumbered on 2026-09-22. Its final-review role is preserved.
- Requires implemented/accepted Plans 30–37 and current verification of completed Plans 28–29; M21–M27 acceptance remains historical evidence within its original scope.
- CAD-only input remains STEP/IGES/BREP. Archived STL and post-v1 Plans 39–46 are not release gates.
- Feature-specific regressions, numerical validation, keyboard/focus, cancellation, performance baselines and initial owner walkthroughs belong to the earlier plans and must not wait for this audit.
- This plan does not authorize a v1 tag, deployment or publication.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `docs/reviews/38-integrated-usability-and-pre-release-regression.md` with the index review template.
- Update `docs/release/v1-acceptance-audit.md`, `v1-readiness.md`, relevant benchmark evidence and README's implemented boundary.
- Extend existing browser/Python/native harnesses only for uncovered interactions or concrete defects; do not duplicate each feature's tests.
- Reuse the asymmetric CAD/examples and failure fixtures supplied by Plans 30–37.

## Work

### 1. Reconcile requirement and evidence coverage

- [ ] Map Section 26 requirements to current feature evidence: projects/recovery; contextual controls/editing; model volume/selection; reports; local supports; bearing/moment loads; existing results/convergence and resource gates.
- [ ] Confirm every pre-v1 feature has numerical/contract evidence and its actual owner review where required. Historical test counts do not establish unchanged validity after native/protocol edits.
- [ ] Inspect the complete integrated diff for peak-memory overlap, resource leaks, boundary ownership, accessibility, silent fallbacks and unintended generated/vendor changes. Fix concrete defects in their owning feature and rerun affected checks.

### 2. Run the combined compatibility and resource matrix

- [ ] Run complete Python/native suites, current validation/CAD/resource audits, distribution checks and all applicable browser harnesses. Check reproducible worker/WASM packaging.
- [ ] Run supported direct-local Chromium and optional HTTP workflows plus declared Firefox checks, recording versions and precise limitations.
- [ ] Exercise save/open/recovery while switching units, editing local loads/supports, regenerating mesh, cancelling/retrying solves and exporting reports. Verify restoration never silently changes assignments or accepts stale caches.
- [ ] Repeat viewport/pane resize at 125%/200% zoom and 2× DPI, all themes, keyboard-only controls, reduced motion, advanced panels collapsed/expanded, and all former View commands.
- [ ] Measure repeated open/recovery/selection/solve/report cycles with a representative larger part. Verify source/result/worker disposal and no accumulated recovery/cache data beyond defined budgets.

### 3. Conduct final owner walkthrough and handoff

- [ ] Prepare a concise runnable packet with expected values for an asymmetric bracket, a curved/holed part, and an analytical case. Include ordinary and advanced-setting projects.
- [ ] Supply bounded synthetic invalid-draft, underconstraint, incompatible-cache, denied-storage, cap-blocked, >=8 GiB warning, failed import and cancel/retry states without unsafe allocations.
- [ ] Have the owner complete import/open → model information/material → supports/loads → mesh/check/solve → inspect/convergence → save/reopen/recover → default/custom report without implementer narration.
- [ ] Confirm options icons are discoverable, active advanced settings remain understandable, and a beginner completes an ordinary case without opening them.
- [ ] Record confusing steps and defects by severity, correct blockers, and obtain final usability acceptance. Update the evidence index and hand off to Task 20; keep release status unreleased until its exact-candidate gates pass.

## Verification and acceptance

All required pre-v1 behavior has current scoped evidence and accepted owner review, the complete applicable suites pass, numerical/resource limits remain intact, and no unresolved release blocker is hidden in limitations. Post-v1 plans remain planned. Reuse historical evidence only when its inputs and claimed behavior are unchanged; retain commit/browser/artifact provenance.

## Owner walkthrough

Allow roughly 45–60 minutes for the end-to-end workflow plus failure/recovery checks. Record actual observations and acceptance rather than interpreting automated passes or silence as usability approval.

Record actual implementation evidence and the owner's response in `docs/reviews/38-integrated-usability-and-pre-release-regression.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
