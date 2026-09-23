# Plan 40: Persistent probes, relative displacement and support reactions

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1

**Goal:** Track useful locations and movements through repeated solves and convergence, and inspect meaningful reaction groups.

**Architecture:** Measurements are small source-anchored definitions with separately versioned result evaluations. Mesh spatial lookup is built once per result in a worker; persistent locations never depend on transient triangle indices.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.6–5.7, 11.6–11.8, 13, 15.3 and 20.1; extend requirements for persistent measurement semantics before implementation.

## Dependencies and boundaries

- Post-v1, after Plan 39; works with one or multiple cases and Plan 34 reports.
- Keep ordinary click-to-probe lightweight. Pin measurement is optional; the measurement list appears only when used.
- Initial measures: displacement components/magnitude at a reference point, relative displacement between two points, labeled approximate local stress, and grouped support force/moment.
- Numerical thresholds annotate user-defined checks; they do not certify safety or conceal unconverged stress.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/analysis/measurements.js`: definitions, identity/revision linkage, evaluation status and user thresholds.
- Extend `result-model.js`, convergence records/runner, project codecs/recovery and case reports.
- Add worker-side typed-array spatial lookup/evaluation adjacent to result processing; avoid renderer-owned engineering calculations.
- Create `web/js/ui/measurement-ui.js` and extend viewport probe markers/labels with bounded overlay layout.
- Create `tests/browser/measurement-tests.html/js` and `measurement-workflow-tests.html/js`; add numerical interpolation fixtures.

## Work

### 1. Define stable measurement ownership

- [ ] Store undeformed SI location, source identity, optional CAD face/reference evidence, field/component, label and optional threshold; never persist only a mesh node or display triangle index.
- [ ] On remesh, evaluate at the same physical location with documented Tet4/Tet10 interpolation and face-consistency tolerances. Mark unresolved locations explicitly rather than moving them silently.
- [ ] Geometry replacement requires remapping/review for affected measurements; material/load changes retain definitions but invalidate evaluations.
- [ ] Test unit changes, deformed display, source orientation, no-op edits, project migration and missing references.

### 2. Evaluate and compare useful quantities

- [ ] Verify point displacement against analytical affine fields, relative displacement against two known locations, and invariance under camera/deformation exaggeration.
- [ ] Label stress evaluation source/recovery/smoothing and approximation separately from displacement interpolation. Preserve raw peak reporting.
- [ ] Group support reactions with explicit treatment of shared nodes/components and redundant constraints: deduplicate global totals and flag nonunique attribution instead of double-counting.
- [ ] Evaluate force and moment about a declared point using Plan 37 resultants. Track selected measures per mesh-convergence level and case, with unresolved/stale indicators.

### 3. Integrate pinning and reports

- [ ] Add Pin, rename/remove, locate and a compact list; keep active measurements discoverable with advanced panels collapsed.
- [ ] Include selected measurement definitions/values/units and validity in report options; maintain useful automatic defaults.
- [ ] Bound marker count/label overlap and spatial-index memory, evaluate batches off-thread, and release lookup data with its owning result.

## Verification and acceptance

Use analytical interpolation/relative-motion cases, shared-support attribution tests, remesh/source replacement and two-case comparison. Validate convergence tracking at fixed physical locations, not changing node indices. Run project/report/viewport/history/worker and complete applicable suites; measure many-probe batch cost and retained index memory.

## Owner walkthrough

Click and pin a bracket tip, measure relative movement to its mounting region, refine and resolve, then compare two cases. Inspect support resultants, add measurements to a report, and replace CAD to verify unresolved anchors are called out.

Record actual implementation evidence and the owner's response in `docs/reviews/40-persistent-measurements.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
