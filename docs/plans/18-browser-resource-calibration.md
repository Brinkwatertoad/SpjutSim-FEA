# Task 18: Browser Resource and Solver Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provisional memory multiplier and unmeasured PCG assumptions with a reproducible supported-browser matrix and evidence-backed production constants.

**Architecture:** Instrument the existing worker contract with monotonic WASM high-water and phase timing measurements, then drive deterministic benchmark cases through a dependency-free browser harness. A Python analyzer validates records, computes conservative prediction ratios, and emits the selected constants; production code changes only after the committed matrix supports them.

**Tech Stack:** C++17/CMake, Emscripten/WASM, plain JavaScript workers, Chromium/Firefox desktop, JSON, Python standard library, OS process-monitor tooling.

**Spec:** `spec.md` Sections 4.5–4.6, 4.9, 9.4–9.7, 10, 13.7, 16.4, 20, 24, Milestone 3, and Section 26.

## Global constraints

- Mesher and solver workers never overlap during measurements, and measured runs retain normal preflight/cancellation/error behavior.
- Instrumentation records aggregate bytes/timing only; it must not upload geometry or analysis payloads or add a runtime dependency.
- Do not lower the safety multiplier, raise the 3.5 GiB cap, change PCG tolerance/iteration limits, or add IC(0)/threads without passing measurements.
- Primary release evidence uses current non-headless Chromium desktop; current Firefox is a secondary compatibility target. Safari remains unsupported until separately tested.
- Retain single-threaded direct-local correctness regardless of optional HTTP acceleration findings.

---

## Starting point

The exact-topology estimator exposes modeled and predicted bytes using a
provisional 1.5 multiplier and a 3.5 GiB cap. One headless Chromium cube record
contains post-solve linear-memory size, not phase high-water or process peak.
Jacobi/PCG works for current tests, but the specified axial, bending, mixed-
scale, and poor-quality calibration cases have not been measured as a matrix.

## Implementation

- [x] **Version the resource record.** Replace the template with schema version
  2 fields for application/runtime hashes, launch mode, OS/hardware, element
  type/counts/nnz, modeled allocation categories, predicted bytes, WASM high-
  water by phase, JS heap where exposed, external process peak, mesher/solver
  separation, iterations/residual/timing, cancellation latency, and outcome.
  Add `tools/validate-resource-records.py` plus Python unit tests.
- [x] **Measure worker high-water accurately.** Extend the native/WASM bridge
  and `workers/solver-worker.js` to sample linear-memory byte length after
  input load, graph/preflight, assembly, solve, and post-processing and return
  `wasmMemoryHighWaterBytes` with solver statistics. Update validators, generated
  wrappers, and browser tests; bump the worker/result contract only if the
  existing version cannot reject stale shapes safely.
- [x] **Add a repeatable benchmark harness.** Create
  `tests/browser/resource-benchmark-tests.{html,js}` with exportable records for
  Tet10 meshes near 25k, 75k, and 150k nodes plus a comparable Tet4 case. Run
  axial, cantilever, mixed-scale, and deliberately poor-but-valid quality cases;
  include a cancellation trial during mesh and solve and an edit-after-cancel
  recovery check.
- [ ] **Capture the browser matrix.** Record three repetitions per case in
  current non-headless Chrome/Chromium on the release platform and current
  Firefox where the direct-local worker path is supported. Run Chromium in
  `file://` and cross-origin-isolated HTTP modes. Capture OS process peak with
  the documented platform command and report median timing plus worst-case
  memory/prediction ratio rather than selecting the best run.
- [ ] **Fit and lock the memory policy.** Update the modeled categories when a
  consistently coexisting allocation is missing, choose a multiplier no lower
  than the maximum observed `peak / modeled` ratio plus a documented margin,
  and keep or lower the 3.5 GiB cap unless successful near-cap runs across the
  supported matrix justify an increase. Preserve the Section 10.5 classes and
  test the >= 8 GiB confirmation state synthetically even when the hard cap
  prevents such an allocation.
- [ ] **Choose the PCG path from evidence.** Retain Jacobi if every accepted
  case converges within current residual/iteration/time targets. If it does
  not, benchmark a first-party IC(0) implementation in native tests and include
  all factor storage/workspace in preflight before selecting it. Record the
  final tolerance, iteration heuristic, and preconditioner with failed-case
  diagnostics; do not silently retry under different settings.
- [ ] **Close or explicitly defer optional acceleration.** Benchmark a threaded
  HTTP build only if single-threaded timings show a release-relevant need and
  the same numerical tests remain deterministic. Otherwise record threaded
  WASM as a measured post-v1 deferral and ensure the UI does not promise an
  unavailable path.
- [ ] **Publish constants and evidence.** Update `benchmarks/README.md`,
  `workers/solver-worker.js`, native defaults/tests, README browser support,
  `spec.md` Section 24 decisions, and the release audit together. Regenerate
  the WASM and local worker wrappers and inspect generated diffs.

## Verification

- Run Python tests, native CTest, resource-record validation, WASM result tests,
  worker lifecycle tests, and both full cube/convergence workflows.
- Confirm predicted bytes are computed before the largest allocation and never
  underpredict the recorded WASM/process high-water after the selected margin.
- Verify visible cancel response and worker termination, no mesher/solver heap
  overlap, and successful editing after cancelled and failed runs.
- Repeat one representative case after a clean rebuild and require the same
  classification/constants with results inside documented timing/memory noise.

## Done when

Representative supported-browser records justify the checked-in memory model,
multiplier, heap cap, PCG settings, and optional-threading decision; the 8 GiB
state is tested without attempting an impossible allocation; and Tasks 13 and
15's resource-calibration items can be closed with links to evidence.
