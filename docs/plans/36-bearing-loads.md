# Plan 36: Bearing loads on cylindrical faces

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — pre-v1

**Goal:** Represent a transverse load transferred through a hole or cylindrical bearing surface using a documented compressive distribution.

**Architecture:** The mesher exports validated analytic cylinder descriptors; an application load definition stores resultant/direction and selected faces. Native boundary quadrature assembles the declared pressure distribution and verifies its force/moment resultants.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.7, 6, 8.5/8.8, 14, 16, 19–20 and 26.

## Dependencies and boundaries

- Requires Plan 35 local frames/descriptors and all existing project/draft/history paths.
- First supported geometry is one full circular cylindrical band, possibly split into compatible coaxial CAD faces, with uniform axial extent. Reject partial/noncircular or noncoaxial targets with a specific explanation.
- Use a compressive cosine distribution over the loaded half-cylinder, uniform axially, normalized to the requested transverse resultant. No axial bearing force, tangential friction, clearance/contact solve, fastener preload or certified bolt model.
- This bounded first distribution is visible in editor/report; broader distributions require separate validation.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Extend `web/js/geometry/geometry-model.js`, `workers/mesher-worker.js` and mesher client/protocol checks for cylinder axis/radius/extent/coverage descriptors.
- Extend `analysis-contracts.js`, `solver-input.js`, `assignment-draft.js`, `project-document.js`, summaries and authoring UI.
- Extend surface-load integration in `native/fem/src/fem_context.cpp`; create `native/fem/include/spjutsim/bearing_load.hpp` and `native/fem/src/bearing_load.cpp` for independently testable bearing quadrature.
- Extend C ABI, `native/wasm/fem_c_api.cpp`, `workers/solver-worker.js`, glyph/report/replacement paths.
- Create `tests/browser/bearing-load-tests.html/js` and a reproducible hole/bearing benchmark under `benchmarks/validation`.

## Work

### 1. Define and validate cylinder selection

- [ ] Test descriptor extraction on single/split cylindrical CAD faces, reversed normals, coaxial bands and explicitly unsupported partial/conical targets.
- [ ] Author resultant magnitude/direction in a global or supported local frame; validate transverse direction and nonzero area, and highlight the loaded half.
- [ ] Show the selected axis, bearing idealization and entered resultant. Persist/cancel/undo/suppress without losing face/axis references.

### 2. Integrate the compressive distribution

- [ ] Derive the traction sign from solid boundary orientation, not an assumed outward radial direction. Determine the loaded half from the requested resultant.
- [ ] Write native quadrature tests before implementation for analytical continuous resultant, net moment about the band center, zero unsupported axial force and direction reversals.
- [ ] Integrate with solver Tri3/Tri6 faces and normalize using that same quadrature. Verify realized force/moment against the declared load, reporting unsupported or poorly resolved cases instead of silently changing direction/distribution.
- [ ] Add coarse-mesh and split-face seam regressions; document the discretization convergence test and explicit tolerances.

### 3. Validate an engineering example

- [ ] Solve a supported lug/hole fixture against an independent reference using the identical bearing distribution and boundary conditions.
- [ ] Track nonsingular stress/displacement and integrated reactions across refinement, keeping expected load-edge concentrations visible.
- [ ] Rebuild/version runtime artifacts and extend project/report/glyph/preview validation. Bound descriptor and quadrature storage to the affected boundary.

## Verification and acceptance

Use analytical resultant/moment integration plus matched independent-solver evidence; apply Section 16's existing appropriate nonsingular displacement/stress limits, with force equilibrium at the configured tolerance and an explicitly scaled moment residual. Cover rotation, split CAD faces, units, unsupported selections and real file-mode solve. Run complete applicable suites and resource regression after worker/native changes.

## Owner walkthrough

Select a cylindrical hole, set a transverse bearing force, inspect its half-cylinder preview and report wording, and solve. Try a partial cylinder, axial force and mixed-axis selection to verify clear restrictions without guessed loading.

Record actual implementation evidence and the owner's response in `docs/reviews/36-bearing-loads.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
