# Task 22: Stress extrema and result clarity implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M22 before Task 23.

**Goal:** Explain numerical peaks accurately and ensure the displayed surface range refers to rendered boundary nodes.

**Architecture:** The worker produces validated numerical/surface metadata; the trust model computes FoS; UI formatting and renderer markers consume these contracts. Preserve existing recovery and smoothing algorithms in this package.

**Tech Stack:** JavaScript typed arrays, existing C++/WASM solver, Three.js, static browser tests.

**Spec:** `spec.md` Sections 11.2–11.7, 12, 13, 15.8, 15.11, 19, and 26.

## Dependencies and constraints

- Requires accepted M21; common execution rules are in the plan index.
- SI Float64 solver samples remain authoritative. Tet10 retains four recovery samples per element.
- Surface smoothing is currently an element-sample mean followed by an unweighted adjacent-element mean at each node. Do not silently change that numerical method.
- Color ranges, clipping, camera changes, and legend formatting cannot change raw peaks, yield strength, or engineering FoS.

## Implementation

### 1. Correct and validate the boundary-only contour range

**Modify:** `workers/solver-worker.js`, `web/js/analysis/result-model.js`, `web/js/analysis/factor-of-safety.js`, `web/js/workers/worker-protocol.js` if the envelope changes.
**Tests:** `tests/browser/wasm-solve-result-tests.js`, `tests/browser/factor-of-safety-tests.js`, `tests/browser/cube-wasm-vertical-slice-tests.js`.

- [ ] Add a failing fixture whose all-node values are `[10, 20, 30, 999]` and boundary connectivity is `[0, 1, 2]`: displayed surface maximum must be 30, while the interior value remains in engineering data. Cover shared indices, boundary minima, nonfinite values, and empty/invalid boundary input.
- [ ] Compute displayed ranges from boundary-referenced nodes for all rendered fields, including uncapped displayed FoS. Keep whole-volume raw recovery extrema separate. Accumulate surface range/location metadata in existing boundary passes; avoid per-field Sets and full-sized buffer copies.
- [ ] Define versioned range/peak metadata in `result-model.js` with explicit location ownership: solver sample versus surface node. Update validators, producers, consumers, and test fixtures together; reject contradictory extrema. Preserve the existing raw sample/element/location linkage.
- [ ] Regenerate `web/generated/local-runtime/` using `python3 tools/build-local-runtime.py`. Do not hand-edit generated wrappers or rebuild native kernels unless their source changes.

### 2. Make the engineering headline and plot explanation understandable

**Modify:** `web/js/ui/ui-controller.js`, `web/index.html`, `web/js/render/viewport-controller.js`.
**Create:** `web/js/ui/result-formatting.js` and focused `tests/browser/result-formatting-tests.{html,js}`.

- [ ] Label the headline “Peak von Mises — unaveraged solver samples”; label contour details “Smoothed surface von Mises”. Explain both averaging stages in help, and state that a sampled maximum is not an exact continuum maximum.
- [ ] Show sample-based yield FoS and convergence/singularity status together. Keep smoothed FoS in plot details, missing-strength behavior intact, and no “safe” conclusion from one solve.
- [ ] Add Locate peak using the exact recovery location, with an explicitly identified interior marker when appropriate. Do not relabel the nearest surface face as the actual sample location. Preserve current camera orientation while making the location inspectable.
- [ ] Format engineering magnitudes with explicit units and sensible significant digits; test zero, negative components, tiny/large values, and unbounded FoS. Axis/legend/probe numbers must use consistent units. Never round stored data or silently zero a small reaction.
- [ ] Update spec numerical-contract wording, README result limitations, and the affected acceptance evidence. Keep historical validation records intact and identify which postprocessing claims need reruns.

## Verification

- [ ] Run focused result/FoS/formatting browser tests and the analytical Tet10 vertical slice; distinguish expected raw/smoothed differences from the boundary-range defect.
- [ ] Run the applicable Python, native CTest, worker, result, convergence, and direct-local suites. Require unchanged solver-sample/extrema/equilibrium values for unchanged inputs.

## Manual review M22 — understanding results, about 15 minutes

- [ ] Supply a uniform-stress case and a constrained case with differing raw/smoothed peaks; document actual values and locations.
- [ ] Owner identifies which number drives the yield check, explains why the color key differs, locates the peak, and checks no-strength and interior-peak presentations.
- [ ] Record acceptance of wording, number formatting, and peak visibility before Task 23.

## Done when

Displayed ranges exclude unused interior nodes, recovery values are preserved, tests pass, and M22 confirms the distinction is understandable.
