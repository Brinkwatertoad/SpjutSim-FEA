# Plan 45: Undamped linear modal analysis

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1; eigensolver/mass decision precedes production integration

**Goal:** Find natural frequencies and mode shapes for a constrained elastic part with validated mass and eigensolver behavior.

**Architecture:** A modal study solves the sparse generalized symmetric eigenproblem with an explicit mass operator, modal settings and result schema. Worker lifecycle/memory preflight remain shared, while static loads/FoS are not interpreted as modal results.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** Post-v1 extension of `spec.md` Sections 2, 5, 8–11, 14, 16 and 19–20.

## Dependencies and boundaries

- Requires solid persistence/frame/case foundations; first deliverable is homogeneous isotropic Tet10 solids with density and fixed/zero prescribed support conditions.
- May execute independently of shells/orthotropy; extending modal analysis to those domains requires their own combined evidence.
- First deliverable is undamped constrained modes. Free-free extraction, prestress, buckling, harmonic/transient response and damping are excluded.
- No new eigensolver dependency without owner approval. Shell/orthotropic/modal cross-products do not inherit validation automatically.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Add mass assembly and modal solver modules under `native/fem/include/spjutsim` and `native/fem/src` with sparse interfaces independent of Gmsh.
- Extend analysis study settings, solver worker/C ABI/WASM, memory estimates and a modal-specific result contract.
- Add contextual analysis-type selection, mode/frequency list and existing deformation animation integration.
- Extend project/report contracts and create modal analytical/reference benchmark and browser workflow files.

## Work

### 1. Select eigensolver and mass formulation with evidence

- [ ] Define `K φ = ω² M φ`, frequency units, required positive density, mass convention, mode normalization and zero-displacement constraints. Compare consistent/lumped mass against analytical frequency convergence before selecting the first supported contract.
- [ ] Prototype a bounded sparse symmetric generalized eigensolver and benchmark convergence/orthogonality, repeated modes and memory. Record residual criteria, requested mode limits, iteration/time budgets and failure behavior.
- [ ] Validate known small matrix pencils and a beam/cantilever frequency sequence against analytical/reference values. Record the selected algorithm/formulation in the spec and obtain acceptance before full UI integration.
- [ ] Reject unsupported nonzero prescribed displacements/static prestress; diagnose underconstraint instead of silently dropping near-zero modes.

### 2. Integrate modal worker execution

- [ ] Assemble stiffness/mass and apply constraints consistently; keep dense storage limited to the bounded eigensolver subspace.
- [ ] Add preflight for multiple mode vectors/workspace, cancellation, time limits and stale-request/case guards.
- [ ] Return validated frequencies, mode shapes, normalization, per-mode residuals and orthogonality diagnostics. Never report unconverged modes as accepted.

### 3. Present and persist results

- [ ] Show natural frequencies and a selectable animated mode shape. Explain that normalized amplitude is arbitrary and is not a predicted operating displacement.
- [ ] Hide inapplicable static force/FoS results; report ignored/inapplicable inputs explicitly before running.
- [ ] Extend project optional-results, comparison and reports with modal provenance. Compare repeated/near-degenerate modes by subspace/correlation rather than index alone.

### 4. Validate and calibrate

- [ ] Run mesh-converged constrained solid modes against analytical/independent references, including density scaling and repeated eigenvalues.
- [ ] Record mode-count/mesh memory and performance limits; test cancellation during mass assembly and eigensolve.
- [ ] Preserve all static-analysis and direct-local workflows.

## Verification and acceptance

Require generalized-eigen residuals, mass orthogonality and explicit mesh-converged frequency tolerances established in the design decision. Include known small-matrix, density scaling, invalid/underconstrained, repeated-mode and native/WASM parity tests. Run complete applicable suites and an offline modal project/report workflow with resource evidence.

## Owner walkthrough

Choose Modal explicitly, provide density/supports, calculate a few modes and inspect frequencies/animation. Reopen saved modes, compare a material variant and explain the amplitude label. Verify static results remain separate and invalid modal inputs are actionable.

Record actual implementation evidence and the owner's response in `docs/reviews/45-modal-analysis.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
