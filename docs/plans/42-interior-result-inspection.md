# Plan 42: Interior result section views

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1

**Goal:** Explain internal stress/displacement patterns and located peaks through an optional section view.

**Architecture:** Presentation-only clipping and worker-produced cut-surface data are separate from the numerical mesh/result owner. Cut fields have explicit interpolation/recovery semantics and never replace whole-model extrema.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 11, 15.5–15.6, 18–20; extend section-view result contracts before implementation.

## Dependencies and boundaries

- Post-v1, after Plans 40–41; no change to the current Stress/Deformation mode organization.
- First delivery: one movable axis-aligned or explicitly oriented cut plane and reset, with bounded interactive preview.
- A clipped outer surface is not a numerical interior contour; cap/interior sampling must be independently validated.
- No geometry modification, remeshing, section-force integration or general CAD cutting.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/render/section-view.js` for plane controls/clipping and owned display resources.
- Create `web/js/analysis/section-sampling.js` for typed result-sampling contracts, with worker execution for mesh-sized work.
- Extend result worker/data retention only for the topology/fields needed; update memory model if additional bulk arrays remain.
- Extend display options, measurement markers and report capture/options.
- Create `tests/browser/section-view-tests.html/js` plus Tet4/Tet10 interpolation and clipping fixtures.

## Work

### 1. Define the interior sampling contract

- [ ] Specify original-coordinate cut geometry, displayed deformation and field interpolation. Distinguish recovery samples from any extrapolated/smoothed interior field.
- [ ] Add analytical affine-displacement/constant-stress tests and quadratic Tet10 checks before implementation. Define face/edge-coincident plane handling and duplicate-triangle elimination.
- [ ] Establish explicit result topology retention and byte budgets; do not copy full solver arrays into the renderer for every plane motion.

### 2. Implement bounded interactive inspection

- [ ] Build/cancel cut geometry off-thread, coalesce plane updates and reject obsolete completions.
- [ ] Keep plane motion presentation-only, preserve engineering revision, and maintain accessible numeric/keyboard controls and a clear Reset section action.
- [ ] Locate an interior peak in context and allow valid persistent probes while labeling sampling basis. Whole-model peaks remain unchanged.

### 3. Export and dispose

- [ ] Report section orientation/position, field, limits and interpolation basis; preserve default report behavior.
- [ ] Test repeated movement, field changes, result replacement, cancellation and scene restoration after capture failure.
- [ ] Measure interactive latency/allocations, avoid accumulating obsolete cut meshes and honor the existing worker lifecycle.

## Verification and acceptance

Analytical and Tet10 interpolation tests are mandatory before visual acceptance. Cover plane degeneracy, deformed/undeformed display, unit/projection changes, high DPI and report consistency. Run affected numerical/worker/measurement/report and complete applicable suites with large-result memory evidence.

## Owner walkthrough

Locate an interior peak, move a section plane to inspect it, compare undeformed/deformed display and export the selected section. Reset it and confirm engineering results and their reported extrema are unchanged.

Record actual implementation evidence and the owner's response in `docs/reviews/42-interior-result-inspection.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
