# Plan 43: Thin-part shell analysis

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1; formulation decision precedes production implementation

**Goal:** Analyze thin mechanical parts with an explicit midsurface and thickness without resolving thickness using many solid elements.

**Architecture:** A separate shell study/domain contract adds shell connectivity and translational/rotational DOFs while retaining shared sparse infrastructure where valid. Surface geometry, thickness/normals, support interpretation and result layers are explicit.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** Post-v1 extension of `spec.md` Sections 2, 5–11, 14, 16, 18–20. The first task updates these requirements after the formulation decision.

## Dependencies and boundaries

- Post-v1; requires the pre-v1 persistence/frames/loads foundations and Plans 39–42 for study/result tooling.
- First deliverable is one connected orientable midsurface with homogeneous isotropic material and uniform specified thickness under small-strain static loading.
- Explicit midsurface input/selection is required. Automatic solid-to-midsurface extraction, shell-solid coupling, contact, composites, variable thickness and arbitrary curved-shell coverage are outside the first delivery.
- Shell study selection must be explicit; an invalid solid import is never silently interpreted as a shell.
- Any new numerical dependency requires separate owner approval; prefer the first-party core.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Extend geometry/domain and mesher contracts in `web/js/geometry` and `workers/mesher-worker.js` for oriented surface elements.
- Add independently owned shell formulation under `native/fem/include/spjutsim` and `native/fem/src`, with element tests under `native/fem/tests`.
- Extend `analysis-contracts.js`, solver input, sparse graph/preflight, C ABI/WASM, result schema and project validation.
- Add shell thickness/normal/support authoring and top/bottom/resultant presentation in app-specific UI/render modules.
- Add shell analytical/reference evidence under `benchmarks/validation` and browser shell workflow harnesses.

## Work

### 1. Select and validate a bounded shell formulation

- [ ] Document candidate element topology, DOF ordering, local basis, membrane/bending/shear terms, quadrature and drilling-rotation treatment. Evaluate first-party implementation complexity, shear/membrane locking and spurious modes.
- [ ] Build native membrane and bending patch tests, rigid-motion/rank tests and thin/thick plate convergence prototypes. Compare a suitable assumed-strain shell formulation against an independent reference; retain evidence for the selected formulation.
- [ ] Record the supported planar/curved geometry envelope, thickness range, meshing topology and numerical tolerances in a design decision and spec update. Obtain owner acceptance of that concrete first-delivery design before production integration.
- [ ] Do not proceed with a formulation that passes only one mesh or conceals stabilization energy/modes.

### 2. Integrate the shell domain and solver

- [ ] Add explicit midsurface/thickness/normal validation and stable surface/edge identity; display and repair flipped normals.
- [ ] Extend assembly/constraints to rotational DOFs without assuming every node still has three unknowns. Define support/load units and interpretations for forces, moments and pressure.
- [ ] Update memory preflight, protocol validation, project schemas and cancellation; preserve existing solid paths and tests.
- [ ] Compute displacement/rotation plus membrane/bending resultants and top/bottom stress with explicit physical locations; apply only appropriate isotropic strength criteria.

### 3. Author and inspect thin-part analyses

- [ ] Provide an optional shell-study workflow with visible thickness, normals and support assumptions, while ordinary solid projects remain unchanged.
- [ ] Integrate result fields, legends, probes, convergence and reports with layer/location labels; do not mix top/bottom or midsurface extrema.
- [ ] Verify project reopen, report defaults and load-case invalidation with the new DOF/domain contract.

### 4. Validate and calibrate

- [ ] Validate plate bending, membrane tension, torsion and a representative thin bracket against analytical or independently reproduced reference values.
- [ ] Compare a thin part with a converged solid solution where assumptions match; record differences attributable to shell idealization.
- [ ] Benchmark accuracy, locking sensitivity, memory and solve cost across thickness/mesh ranges and publish supported limits.

## Verification and acceptance

Passing membrane/bending patches, correct rigid-mode rank and independent displacement/stress convergence are release requirements for this capability. Set explicit physically justified tolerances in the formulation decision before running acceptance. Run native/WASM/browser parity, all existing solid regressions, project/report/case workflows and complete applicable suites. No visual-only acceptance or automatic fallback to a different formulation.

## Owner walkthrough

Create a thin-bracket shell from a declared midsurface, inspect thickness/normals and restraints, solve and read top/bottom stresses. Reopen and compare with a matched solid case. Confirm ordinary solid import still rejects an open shell unless the shell workflow was deliberately selected.

Record actual implementation evidence and the owner's response in `docs/reviews/43-shell-analysis.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
