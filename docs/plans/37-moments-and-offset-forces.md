# Plan 37: Distributed moments and offset forces

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — pre-v1

**Goal:** Apply a prescribed resultant moment or a force acting at an offset without requiring users to invent equivalent face-force pairs.

**Architecture:** A shared surface-load operator constructs a documented traction distribution matching a force and moment about a reference point. Native quadrature verifies resultants and recovers global moment balance; no rigid surface coupling is introduced.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.7, 8.8, 11.8, 14, 16, 19–20 and 26.

## Dependencies and boundaries

- Requires Plans 35–36 for local references, boundary integration and resultants.
- Support moment-only and offset-force definitions on selected finite-area faces. Explicitly identify the distribution as a simplified load transfer.
- No automatic rigid spider, bolt connector, remote displacement, contact or follower load.
- Reference-point changes must preserve the physical wrench; they cannot silently change the load.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Extend `analysis-contracts.js`, `solver-input.js`, `project-document.js`, assignment/history/authoring and local-frame modules.
- Create `native/fem/include/spjutsim/surface_resultants.hpp` and `native/fem/src/surface_resultants.cpp` for force/moment integration and the independently testable distribution operator.
- Integrate with current native loads/assembly, C ABI/WASM bridge, `workers/solver-worker.js` and result schema validation.
- Update `result-summary.js`, report content and glyphs to show reference point, force and moment distinctly.
- Create `tests/browser/moment-load-tests.html/js` and native torsion/offset-load fixtures.

## Work

### 1. Specify the surface distribution

- [ ] Define the first distribution by minimizing area-weighted squared traction subject to the six resultant constraints, using the solver's boundary quadrature. State this idealization in UI/help/report.
- [ ] Derive the small geometric moment operator about an area centroid, use scale-aware rank/conditioning checks, and transform requested resultants to that point. Degenerate/inadequately resolved targets fail clearly.
- [ ] Encode moment-only and offset-force definitions with explicit origin/direction units. Use `M = (applicationPoint - referencePoint) × F` for the offset contribution and convert local frames through Plan 35.

### 2. Validate native loading and equilibrium

- [ ] Add failing tests for zero net force under a pure couple, the requested torque, arbitrary rigid rotation/translation, reference-point changes, disconnected selected patches and degenerate selections.
- [ ] Integrate the distribution with Tri3/Tri6 quadrature; verify force/moment consistency before accepting a load.
- [ ] Extend equilibrium diagnostics with moments about a named reference point, using a documented characteristic-length/load scale and absolute treatment for zero denominators. Preserve existing force failure criteria.
- [ ] Add cantilever tip-force-offset and shaft-torsion analytical benchmarks; compare torsional displacement and nonsingular shear using explicit mesh-convergence criteria.

### 3. Integrate and verify the complete workflow

- [ ] Show reference point/lever arm and moment direction in preview without misleading force glyphs. Persist references through save/recovery/history and repair them during geometry replacement.
- [ ] Include entered and realized force/moment, origin and distribution assumptions in Results/report diagnostics.
- [ ] Version/build native/worker changes, measure boundary-only assembly cost and retained memory, and exercise cancellation/invalid input paths.

## Verification and acceptance

Native resultant tests precede full solves. Compare offset-force and statically equivalent surface distributions away from load introduction; do not require identical local stresses. Apply current Section 16 analytical limits and document the new moment residual scaling. Run Tet4/Tet10/WASM, unit, frame, history, project, report and complete applicable suites.

## Owner walkthrough

Apply a torque to a shaft and an offset force to a bracket. Inspect directions/origin, change units, reopen the project and compare reactions. Explain the load-transfer idealization from the interface alone. Try a degenerate target and verify actionable rejection.

Record actual implementation evidence and the owner's response in `docs/reviews/37-moments-and-offset-forces.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
