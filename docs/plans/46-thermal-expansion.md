# Plan 46: Prescribed-temperature thermal expansion

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1; prescribed-temperature expansion only

**Goal:** Evaluate deformation and stress caused by a known temperature change in a mechanical part.

**Architecture:** The first delivery adds isotropic thermal eigenstrain to the existing linear-static solid formulation. Reference/current temperature and expansion coefficient are engineering inputs; this is not a heat-transfer solver.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** Post-v1 extension of `spec.md` Sections 2, 5, 8, 11–12, 14, 16 and 19–20.

## Dependencies and boundaries

- Requires pre-v1 frames/persistence/loads and Plan 39 cases. Can execute independently of shells, orthotropy and modal work.
- First delivery: homogeneous isotropic solids, constant expansion coefficient, uniform prescribed temperature change, optionally combined with existing static mechanical loads.
- Heat conduction, spatial/transient temperature fields, temperature-dependent properties, anisotropic expansion and thermal contact are separate future extensions.
- Strength data must remain valid for the analyzed temperature; no automatic temperature correction or invented allowable.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Extend material/study contracts and units for expansion coefficient, reference/current temperature and temperature difference.
- Extend native Tet4/Tet10 load/strain/stress recovery with independently tested thermal eigenstrain and its C ABI/WASM contract.
- Add contextual thermal input UI, glyph/summary assumptions, project/history/case invalidation and report fields.
- Create thermal analytical/reference fixtures and `tests/browser/thermal-expansion-tests.html/js`.

## Work

### 1. Define temperature and eigenstrain semantics

- [ ] Specify `εthermal = α ΔT I` and elastic stress from `εtotal - εthermal`. Distinguish total, mechanical and thermal strain in numerical/result contracts.
- [ ] Define Celsius/Kelvin/Fahrenheit absolute-temperature versus difference conversions; never apply an absolute offset to ΔT or α.
- [ ] Validate coefficient/range/source metadata and make constant-property/uniform-temperature assumptions visible.
- [ ] Update spec/project/worker schemas with temperature input ownership and cache invalidation before implementation.

### 2. Integrate thermal response

- [ ] Add failing native tests for free expansion with only rigid-motion removal, fully restrained expansion, zero ΔT, cooling sign, and combined mechanical/thermal load.
- [ ] Assemble equivalent thermal loading and recover stress with the same constitutive/quadrature convention for Tet4/Tet10.
- [ ] Preserve reaction/equilibrium checks, including nonzero stress/reactions under restrained uniform heating despite zero applied mechanical resultant.
- [ ] Test rotated geometry and prescribed displacement combinations; forbid unsupported varying-temperature input explicitly.

### 3. Author and report thermal cases

- [ ] Add an optional thermal load/settings action without changing ordinary mechanical defaults. Show reference temperature, ΔT and coefficient together.
- [ ] Integrate cases, history, persistence/recovery, cache fingerprints and report defaults; explain that temperatures are supplied rather than solved.
- [ ] Keep material strength applicability explicit and prevent an unsupported temperature-dependent safety claim.

### 4. Validate and calibrate

- [ ] Verify free expansion `ΔL = α ΔT L` and restrained axial stress with physically appropriate lateral restraints, then compare a mixed-load fixture with an independent solver.
- [ ] Record convergence and numerical tolerances before acceptance; separate errors in temperature conversion from FE discretization.
- [ ] Measure added per-element work and preserve unchanged mechanical-only performance with cached uniform thermal data.

## Verification and acceptance

Require free/fully restrained expansion, zero-temperature-change equivalence, heating/cooling signs, unit round trips and native/WASM parity. Run project/material/history/case/report workflows and complete applicable suites. Validate uniform prescribed thermal response only; do not describe this capability as a heat-transfer simulation.

## Owner walkthrough

Compare a freely expanding and restrained heated part, inspect displacement/stress and reactions, switch temperature units and reopen the cases. Export a report that clearly states the prescribed temperature and constant-property assumptions.

Record actual implementation evidence and the owner's response in `docs/reviews/46-thermal-expansion.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
