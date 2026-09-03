# Task 15: Deliver convergence, validation, and the v1.0 release gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic global mesh-convergence studies and assemble the numerical, resource, compatibility, and licensing evidence required to call SpjutSim FEA v1.0-ready.

**Architecture:** A controller-owned convergence state machine sequences disposable mesher and solver workers one level at a time and stores compact immutable level summaries, not every full result. Pure convergence classification consumes those summaries; the UI renders the table/plots and only a selected level installs full viewport results.

**Tech Stack:** Plain JavaScript/JSDoc, existing Gmsh and FEM workers, SVG or Canvas 2D plots without new dependencies, C++/CTest benchmarks, static browser harnesses, committed benchmark fixtures.

**Spec:** `spec.md` Sections 3.8, 13, 16, 17 Milestone 4, 20–23, 26, and the locked v1 decisions in Section 28.

## Global constraints

- Use deterministic global refinement with `h_next = 0.7 * h_current` and at most four solved levels by default.
- Run only one mesher or solver phase at a time; terminate workers between phases to control peak memory.
- Apply normal preflight, WASM-cap, 8 GiB confirmation, cancellation, and structured-error policies at every level.
- Do not call a divergent peak a mathematical singularity; report only the specified likelihood heuristic.
- Do not mark v1.0 complete until every applicable Section 26 checkbox has evidence.

---

## Starting point

`analysis-document.js` reserves `convergenceStudy` and the shell shows a
Convergence tab, but there is no study contract, orchestrator, classification,
plot, or resource guard. The fixture set contains only a few generated CAD
solids, the current browser tests are primarily Chromium/manual, the memory
model lacks final supported-browser calibration, and the Gmsh distribution
decision must be explicitly closed before release.

## Implementation

- [x] **Define pure study contracts and classification.** Create
  `web/js/analysis/convergence.js` with versioned study settings, level rows,
  stop reasons, and statuses: `converged`, `converged-stress-unresolved`,
  `unconverged`, `indeterminate-resource-limit`, and `failed`. Compute relative
  changes with explicit zero-denominator handling; require the final step to
  meet 2% displacement and strain-energy limits, and track 5% raw-peak-stress
  stability separately.
- [x] **Implement controller-owned sequencing.** Add
  `beginConvergenceStudy`, `cancelConvergenceStudy`,
  `restartConvergenceStudy`, and `selectConvergenceLevel` commands to
  `web/js/analysis/app-controller.js`, with orchestration in
  `web/js/analysis/convergence-runner.js`. Generate each refined mesh, preflight
  it, solve it, retain the compact metrics required by Section 13.3, and dispose
  prior full mesh/result buffers unless that level is selected for inspection.
  Any setup edit invalidates the complete study.
- [x] **Enforce resource and cancellation gates per level.** Stop before a mesh
  above the WASM cap, classify the study indeterminate when a required next
  level cannot run, and pause for explicit confirmation at 8 GiB rather than
  confirming an entire study in advance. Worker termination must discard the
  partial level and leave completed rows inspectable.
- [x] **Implement the stress-singularity heuristic.** When global metrics
  converge but raw peak stress does not, compare peak locations/features across
  the final levels using model-scale-normalized distance and CAD `FaceId` where
  available. Emit the exact caution from Section 13.5 only for a materially
  rising/unstable peak that remains spatially concentrated; otherwise report
  stress unresolved without claiming likely singular behavior.
- [x] **Build the Convergence UI.** Wire the existing tab to start/cancel
  controls, visible refinement settings, a level table, and dependency-free
  plots for DOF/mesh size versus maximum displacement, strain energy, and raw
  peak von Mises stress. Show the deterministic target size, memory estimate,
  iterations/time, stop reason, global/stress status, and selection of an
  available level for viewport inspection.
- [ ] **Complete analytical and reference validation.** Add committed benchmark
  definitions/results for axial traction, cantilever bending, a uniform
  pressure/symmetry case, gravity/reaction balance, and a nonsingular stress-
  concentration case. Record source solver/version, units, probe definitions,
  mesh sequence, and tolerances; meet Section 16.2 for converged Tet10 results
  and never tolerance-test a singular raw peak.
- [ ] **Expand regression and resource evidence.** Grow `tests/fixtures` and
  `benchmarks/cad-corpus` toward the required representative/problematic corpus,
  recording expected import status, mesh-count ranges, quality status, and
  selected numerical outputs. Run supported-browser direct-local and optional-
  HTTP cases at representative sizes; record predicted/observed WASM memory,
  completion, cancellation response, wall time, and UI responsiveness. Refit
  Task 13's safety factor only when these records support the change.
- [x] **Close distribution and release documentation.** Resolve and document the
  Gmsh/OpenCASCADE/Emscripten/Three.js license and source-offer posture in
  `THIRD_PARTY.md`; update README run/test/release instructions and `spec.md`
  only for decisions the evidence settles. Audit Section 26 line by line,
  checking an item only beside reproducible evidence or a recorded manual test.

## Verification

- Unit-test convergence math, zero metrics, exact thresholds, early
  convergence, four-level exhaustion, every failure/resource stop, spatial
  concentration, cancellation, stale revision rejection, and selected-level
  buffer disposal.
- Add browser convergence orchestration tests with deterministic fake workers,
  then run the real Tet10 analytical/reference studies. Verify table/plot
  accessibility, keyboard operation, result-level switching, and accurate
  warning/status text.
- Run the complete Python and native suites, rebuild both generated runtimes,
  run every browser harness in its documented mode, execute the CAD corpus and
  supported-browser resource matrix, and perform the full import → setup →
  Tet10 mesh → preflight → solve → FoS → convergence workflow from `file://`.
  Review the complete diff for generated/vendor drift, peak-memory overlap,
  silent fallbacks, and unchecked acceptance claims.

## Done when

The convergence workflow distinguishes global convergence from unresolved or
likely singular peak stress, all resource stops are safe and explicit, the
benchmark/corpus/browser records meet the specification's tolerances, licensing
is resolved, and every checked v1.0 acceptance item points to reproducible
evidence.
