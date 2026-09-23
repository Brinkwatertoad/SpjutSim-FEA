# Plan 44: Orthotropic elasticity and directional material axes

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1; elasticity first, directional failure models separate

**Goal:** Represent directional stiffness with explicit material axes and validated properties, including carefully qualified printed-part inputs.

**Architecture:** The native constitutive contract gains a validated orthotropic compliance/stiffness tensor and material orientation. Begin with homogeneous orthotropic solid elasticity; directional failure criteria remain separate from elastic response.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** Post-v1 extension of `spec.md` Sections 2, 5.2/5.7, 8, 11–12, 16 and 19–20.

## Dependencies and boundaries

- Requires pre-v1 local frames/persistence and Plan 39 case comparison. May execute independently of shell implementation; shell orthotropy is excluded from this first delivery.
- Use one homogeneous material orientation per solid. No spatial orientation field, infill/raster homogenization, plasticity, calibrated filament library or automatic print-strength claim.
- Existing bulk polymer presets remain isotropic reference inputs. Orthotropic input requires explicit sourced/user values.
- Do not apply the existing scalar von Mises yield FoS as an orthotropic failure criterion.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Add material validation and transform helpers near `web/js/analysis/analysis-contracts.js` and `web/js/geometry/local-frame.js`.
- Add independently testable orthotropic constitutive routines in `native/fem/include/spjutsim` and `native/fem/src`.
- Extend material UI/catalog snapshots, solver input/C ABI/WASM, result metadata/FoS eligibility, project schemas and reports.
- Create `tests/browser/orthotropic-material-tests.html/js` and orthotropic patch/reference fixtures.

## Work

### 1. Specify material properties and validity

- [ ] Define E1/E2/E3, G12/G23/G31 and three independent Poisson ratios with an explicit index convention and reciprocal relations. Reject nonfinite, inconsistent or non-positive-definite compliance.
- [ ] Define an orthonormal material basis and engineering-shear Voigt convention; document energy-preserving tensor transforms.
- [ ] Add failing native/JS tests for the isotropic limit, axis permutations, rigid rotation, compliance reciprocity and invalid parameter sets.
- [ ] Decide orientation behavior through geometry rotation/replacement using the existing frame ownership model, and update the spec/project schema before integration.

### 2. Implement elasticity and orientation authoring

- [ ] Implement the constitutive matrix/rotation once in the numerical owner; ensure Tet4/Tet10 use identical physical conventions.
- [ ] Offer Orthotropic through material options with axis preview and visible orientation summary. Preserve simple isotropic defaults.
- [ ] Save complete property/provenance/orientation snapshots; enforce draft/history/case invalidation and replacement repair.
- [ ] Display elastic stress/displacement and assumptions. Suppress unsupported scalar FoS with an explanation; do not substitute a guessed directional strength rule.

### 3. Validate directional behavior

- [ ] Run rotated uniaxial and pure-shear patch cases in all material directions and match independent orthotropic reference solves on a bending example.
- [ ] Show exact isotropic-limit equivalence within numerical tolerance and expected stiffness differences under axis swaps.
- [ ] Include direction/provenance in reports and compare material-axis variants through cases.
- [ ] Benchmark constitutive transforms, caching once per material/frame where possible, without per-element redundant matrix construction for uniform materials.

## Verification and acceptance

Set explicit tensor/energy and reference-convergence tolerances before integration, preserving existing isotropic acceptance. Run native/WASM rotated patches, invalid-material boundaries, project/report/case/units workflows and complete applicable suites. Document that elasticity validation does not validate printed-part allowables or a failure criterion.

## Owner walkthrough

Enter a directional material, orient its axes on a part, solve and compare a rotated-axis case. Read the orientation/limitations from the compact summary and report; confirm isotropic projects retain their existing FoS behavior.

Record actual implementation evidence and the owner's response in `docs/reviews/44-orthotropic-materials.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
