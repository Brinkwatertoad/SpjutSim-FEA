# Component Supports and Rigid-Body Stability Implementation Plan

> **For Codex:** Execute in order with focused tests. Replace the alpha fixed/prescribed discriminated union outright; do not retain compatibility readers.

**Goal:** Let every support constrain any nonempty subset of global X/Y/Z translation with an independent prescribed value, and continuously show whether the authored setup suppresses all six rigid-body modes.

**Architecture:** Store one support shape, `{type: 'support', componentsM: {x?, y?, z?}}`; Fixed is only a UI shortcut that fills all three components with zero. A pure constraint-stability module forms normalized infinitesimal rigid-mode observations from preview vertices before meshing and unique boundary nodes after meshing, computes deterministic rank/nullspace information, and distinguishes axis-aligned free modes from coupled remaining freedom. The controller owns the current provisional/mesh stability result; UI and preflight only consume it. The native solver retains final singularity enforcement.

**Constraints:** Translational nodal DOFs only; support components remain global when the model rotates; equal duplicate solver constraints consolidate and conflicting values fail; no backward compatibility for `fixed`, `prescribed-displacement`, or top-level `uxM`/`uyM`/`uzM`.

---

### Task 1: Replace the support data contract

**Files:**
- Modify: `web/js/analysis/analysis-contracts.js`
- Modify: `web/js/analysis/solver-input.js`
- Modify: `web/js/ui/setup-inspector-summary.js`
- Modify: browser fixtures/tests containing old support shapes

**Steps:**
1. Add failing validation and projection tests for one-, two-, and three-axis supports, finite nonzero prescribed values, missing components, and no legacy shapes.
2. Validate and snapshot `type: 'support'` plus `componentsM` with keys `x`, `y`, and/or `z`.
3. Project enabled components unchanged onto selected unique boundary nodes.
4. Update compact summaries and all first-party fixtures; run focused tests and commit.

### Task 2: Update authoring and solver expansion

**Files:**
- Modify: `web/index.html`
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `workers/solver-worker.js`
- Regenerate: `web/generated/local-runtime/solver-worker-source.js`
- Test: `tests/browser/analysis-authoring-tests.js`
- Test: `tests/browser/wasm-solve-result-tests.js`

**Steps:**
1. Add failing UI tests for Fixed shortcut defaults, X/Y/Z toggles, one/two-axis saving, nonzero values, and round-trip editing.
2. Keep Fixed and Custom as authoring choices only; serialize the single component support contract.
3. Expand `componentsM` into solver DOFs, preserving duplicate/conflict handling in the native boundary.
4. Regenerate the worker wrapper, run focused UI/WASM tests, and commit.

### Task 3: Implement pure six-mode stability analysis

**Files:**
- Add: `web/js/analysis/constraint-stability.js`
- Modify: relevant browser harness script order
- Test: `tests/browser/analysis-authoring-tests.js`

**Steps:**
1. Add failing cases for rank 0–6, canonical free translation/rotation, coupled null modes, coordinate scaling/translation, and duplicate observations.
2. Build rows for Tx/Ty/Tz/Rx/Ry/Rz at constrained points using centered, scale-normalized coordinates.
3. Compute deterministic reduced row-echelon form, rank, and nullspace with an explicit tolerance.
4. Report constrained, free, or coupled status per canonical mode plus remaining coupled dimension; run focused tests and commit.

### Task 4: Own provisional and mesh-exact diagnostics in the controller

**Files:**
- Modify: `web/js/analysis/analysis-document.js`
- Modify: `web/js/analysis/app-controller.js`
- Modify: `web/js/analysis/solver-input.js`
- Test: `tests/browser/analysis-authoring-tests.js`

**Steps:**
1. Add failing controller tests for provisional preview analysis, mesh-exact recomputation, support edit/removal, geometry orientation, and mesh invalidation.
2. Deterministically extract unique constrained preview vertices or mesh nodes and component observations.
3. Refresh document-owned stability state at every geometry/support/mesh transition.
4. Attach the mesh-exact result to solver input/preflight metadata without bypassing native singularity checks; run focused tests and commit.

### Task 5: Add compact setup diagnostics

**Files:**
- Modify: `web/index.html`
- Modify: `web/css/app.css`
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `web/js/ui/ui-controller.js`
- Test: `tests/browser/analysis-authoring-tests.js`

**Steps:**
1. Add failing layout/accessibility tests for a compact support-stability line that is visible without scrolling in ordinary setups.
2. Show Fully constrained or Underconstrained, label Preview or Mesh, and list Tx/Ty/Tz/Rx/Ry/Rz as constrained/free/coupled without false axis claims.
3. Surface underconstraint as a visible warning before meshing and carry the exact result into solve preflight presentation.
4. Preserve inline editor focus and compact-height acceptance; run focused tests and commit.

### Task 6: Reconcile specification and verify

**Files:**
- Modify: `spec.md`
- Modify: `README.md`
- Modify: `docs/plans/11-priority-release-features.md`

**Steps:**
1. Replace the old fixed/prescribed support contract and underconstraint heuristic with the approved component/rank behavior.
2. Review all old support-shape references with `rg`, generated worker parity, global-frame behavior, and duplicate/conflict diagnostics.
3. Run Python, native CTest, all browser suites, and direct-file startup; commit and proceed to distributed glyphs/triad.
