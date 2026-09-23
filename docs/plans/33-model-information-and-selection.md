# Plan 33: Model volume/mass and viewport face selection

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document records implementation scope and does not authorize publication.

**Status:** Implemented — automated verification recorded; owner walkthrough pending. See [review](../reviews/33-model-information-and-selection.md).

**Goal:** Expose useful model information before solving and make small or obscured CAD faces easier to select.

**Architecture:** Validated geometry data supplies volume; mass is a small derived value from active density. Picking operates on existing CAD face mappings with explicit transient visibility and candidate state.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.1, 6.4–6.7, 11.7, 15.6 and 20.1.

## Dependencies and boundaries

- Follows Plan 32 and preserves assignment draft semantics.
- No long face catalog, automatic nearest-face assignment, CAD editing or result cut-plane interpolation.
- Geometry/mesh/result visibility changes are presentation-only. Displayed values use current preferred units.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Modify `web/js/geometry/geometry-model.js` and `workers/mesher-worker.js` only if existing volume metadata needs strengthened validation.
- Modify `web/js/ui/setup-inspector-summary.js`, `analysis-authoring-ui.js`, `result-summary.js` and shared unit definitions in `web/js/analysis/analysis-contracts.js`.
- Modify `web/js/render/viewport-controller.js`; isolate picking/visibility into a cohesive render module if necessary.
- Extend `web/js/ui/report-export.js` and project metadata validation.
- Extend CAD import/selection/assignment/units/report tests; add `tests/browser/model-information-tests.html/js`.

## Work

### 1. Show physical volume and mass

- [x] Add analytical box/cylinder tests for volume, density-derived mass, unit conversion, missing volume/density and invalid/nonfinite metadata.
- [x] Show dimensions/volume in Model and mass when available, without requiring mesh/solve. Mark unavailable quantities clearly; never substitute bounding-box volume or a zero.
- [x] Update mass on material changes with no extra geometry traversal. Include values and their source/assumptions in result/report summaries; preserve units and orientation invariance.

### 2. Improve face access in the viewport

- [x] Add a contextual pick-through action cycling distinct CAD face hits under the pointer with explicit candidate highlighting/confirmation. Keep ordinary click/draft toggling unchanged.
- [x] Add temporary hide/isolate and a clear Show all action. Define how picking skips hidden faces and ensure hidden faces still participate in meshing/solving.
- [x] Locate assignments through existing support/load rows, restoring visibility where needed to avoid highlighting an invisible target.
- [ ] Test tiny/curved/occluded faces, additive/draft selection, pan/orbit cancellation, Escape priority, model replacement and keyboard access. Reuse cached face mappings and avoid per-pointer full-array allocations.

## Verification and acceptance

Use actual box, through-hole and curved CAD fixtures in file/HTTP modes. Run selection/draft/history/units/project/report regressions and complete applicable suites. Validate volume/mass independently from the display using SI analytical values. Measure repeated picking and visibility changes on a representative larger preview.

Implementation and automated checks are complete. Any unchecked composite task retains
its measurement/manual-review portion; see the review for exact evidence and limits.

## Owner walkthrough

Read volume/mass before meshing, change density/units, select an obscured hole face, isolate it, return to Show all, and locate an existing load through its row. Confirm presentation changes leave the engineering setup and solved validity untouched.

Record actual implementation evidence and the owner's response in `docs/reviews/33-model-information-and-selection.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
