# Task 26: Setup workflow and solve checks implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M26 before Task 27.

**Goal:** Keep setup readable and place explicitly triggered model checks beside Solve with an accessible report.

**Architecture:** Existing controller preflight/revision state remains authoritative. The workspace opens a Checks output panel; compact setup summaries consume readiness state without independently launching worker work.

**Tech Stack:** Classic JavaScript, CSS, copied UI Kit, current solver client/worker, browser tests.

**Spec:** `spec.md` Sections 3, 10, 14, 15.1–15.2, 15.10–15.11, and 26.

## Dependencies and constraints

- Requires accepted M25; uses Task 21 `showOutputPanel(panelId)` and Task 25 draft lifecycle.
- No automatic preflight on import, mesh completion, form changes, or opening the report. Explicit convergence studies retain their necessary per-level checks.
- Preserve exact-topology preflight, worker disposal, hard WASM cap, >=8 GiB confirmation, cancellation, and revision validation.
- Keep Model → Material → Supports → Loads → Mesh; do not introduce a mandatory wizard.

## Implementation

### 1. Consolidate setup summaries

**Modify:** `web/js/ui/setup-inspector-summary.js`, `web/js/ui/analysis-authoring-ui.js`, `web/index.html`, `web/css/app.css`.
**Tests:** `tests/browser/analysis-authoring-tests.js`, Task 21 workspace harness.

- [x] Test missing/ready/stale/running summaries, readable values at collapsed widths, and keyboard focus when editors move or close.
- [x] Show useful group status, assignment counts, rigid-motion summary, material properties, and mesh currency. Allow values to wrap sensibly instead of truncating all distinguishing information.
- [x] Keep in-place editors and highlight assigned surfaces when a row is selected. Preserve last authoring-type preferences and Task 25 Apply/Cancel semantics.
- [x] Permit descriptive support/load names while retaining automatic defaults and stable IDs. Names must be nonempty after trimming and displayed as text, never HTML. Renaming is metadata-only and must not invalidate a solve. Duplicate/suppress actions remain outside this package pending a separate product decision.

### 2. Move checks next to the solve action

**Modify:** `web/index.html`, `web/js/ui/ui-controller.js`, `web/js/app.js`, `web/js/analysis/app-controller.js` where readiness needs consolidation.
**Tests:** `tests/browser/wasm-solve-result-tests.js`, `tests/browser/convergence-runner-tests.js`; create `tests/browser/solve-checks-ui-tests.{html,js}`.

- [x] Test that import/mesh/presentation events do not call preflight, explicit Check model calls it once, and Solve stays disabled for absent/stale/failed/cap-blocked checks.
- [x] Put Check model and Solve together in the topbar with Ready to solve / Check required / Checking / Solving status. Explain a disabled action through persistent status text as well as help. A dirty assignment draft must be Applied or Cancelled before checking/solving.
- [x] Remove the long left-pane preflight block. Add a Checks output panel opened by Check model and by explicit View checks. Prioritize actionable errors/warnings, constraint readiness, and estimated memory; put node/DOF/nnz/device/runtime detail in expandable sections.
- [x] Keep validation findings linked to the relevant setup editor. Opening an old report must visibly identify its stale revision; never offer it as permission to solve the current model.
- [x] Preserve explicit Solve after review, high-memory confirmation, progress/cancel, and recovery after a rejected solve. Do not replace the existing solver gates with UI-only button state.
- [x] Update spec/README. Run focused tests and complete applicable Python, worker, authoring, preflight, result, convergence, cube, and direct-local suites.

## Manual review M26 — setup to solve, about 20 minutes

- [ ] Owner begins with an incomplete model, follows a check error back to setup, resolves it, explicitly checks again, reads memory/stability, then solves.
- [ ] Edit a load after checking; confirm Check required. Change only the camera/legend; confirm readiness remains. Exercise cancellation and retry.
- [ ] Find an old check report after solving; try a narrow layout and keyboard navigation. Review synthetic high-memory/cap-blocked states without allocating large memory.
- [ ] Record acceptance before Task 27.

## Done when

Setup is readable, checks are explicit and adjacent to Solve, report state cannot misrepresent readiness, and M26 is accepted.

Implementation verified; M26 awaits the requested grouped M24–M27 manual review.
