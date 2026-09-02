# Task 13: Solve Tet10 models and calibrate resource use

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tet10 the default production solve path with validated quadratic loads, recovery, sparse assembly, diagnostics, and calibrated browser memory preflight.

**Architecture:** Add element-dispatched kernels behind the existing first-party FEM context while sharing CSR graph construction, constraint handling, PCG, reactions, and diagnostics. Version the C/WASM and worker contracts as one coordinated change, then flip the UI default only after native and browser acceptance evidence passes.

**Tech Stack:** C++17, CMake/CTest, Emscripten/WASM, plain JavaScript workers, typed arrays, static browser tests.

**Spec:** `spec.md` Sections 8–10, 11.1–11.3, 14, 16, 19–21, and Milestone 3.

## Global constraints

- The native solver remains independent of Gmsh and third-party sparse libraries.
- Use scalar CSR direct assembly; do not add a giant local-stiffness triplet list.
- Preserve coarse worker messages, cancellation by worker termination, and the separate mesher/solver worker lifetime.
- Keep all numerical tolerances explicit and justified by patch/benchmark evidence.
- Do not add alpha-contract compatibility when bumping the internal API/protocol.

---

## Starting point

The native core currently stores only `tet4_connectivity`, assembles 12-by-12
constant-strain elements, integrates linear triangles, and returns one stress
sample per element through API version 1. Its exact CSR preflight and WASM
vertical slice are trusted for Tet4, but the 1.5 memory multiplier is still the
uncalibrated value called out by `spec.md`.

## Implementation

- [ ] **Introduce explicit element descriptors.** Generalize
  `native/fem/include/spjutsim/fem_types.hpp`, `native/fem/src/fem_context.cpp`,
  and `native/fem/src/sparse.cpp` around `ElementType::{tet4,tet10}` plus
  nodes-per-element and recovery-point counts. Keep Tet4 behavior bitwise or
  tolerance-equivalent and reject connectivity arity/index overflow before graph
  allocation.
- [ ] **Implement and patch-test the Tet10 kernel.** Add focused Tet10 source
  in `native/fem/src/tet10.cpp`, its public/internal declaration under
  `native/fem/include/spjutsim`, and `native/fem/tests/tet10_element_test.cpp`
  for quadratic shape functions/derivatives, partition of unity, Kronecker
  interpolation, Jacobian mapping, stiffness symmetry, rigid motion, constant
  strain, and a quadratic displacement field. Use the same documented
  four-point tetrahedral integration rule named in Task 12 and fail every
  invalid sampled Jacobian.
- [ ] **Integrate quadratic surface and body loads.** Replace the Tet4-only
  surface-load representation with element-aware Tri3/Tri6 faces. Numerically
  integrate pressure using the current outward geometry and positive-inward
  sign convention, integrate total-face force so its nodal sum matches the
  requested vector, and integrate gravity through the Tet10 volume shape
  functions. Add conservation and reaction-equilibrium tests for every load.
- [ ] **Recover raw and smoothed Tet10 results.** Evaluate strain/stress at the
  documented recovery points, return typed recovery-sample values and owning
  element indices for raw extrema, and produce nodal/surface-smoothed fields for
  rendering without relabeling smoothed maxima as raw. Preserve Tet4's one
  sample per element behind the same result interface.
- [ ] **Version the native/WASM/browser boundary.** Bump
  `SPJUTSIM_FEM_API_VERSION` and the worker protocol, extend
  `native/fem/include/spjutsim/fem_c_api.h`, `native/wasm/fem_c_api.cpp`,
  `workers/solver-worker.js`, `web/js/workers/solver-client.js`, and
  `web/js/analysis/result-model.js`, and reject stale envelopes/struct sizes.
  Transfer mesh and result buffers once; avoid per-element JavaScript objects.
- [ ] **Calibrate memory and solver behavior.** Make the estimator account for
  Tet10 connectivity, graph density, integration/recovery storage, assembly
  lookup lifetime, PCG vectors, and result buffers from the same counts used by
  allocation. Add a benchmark recorder under `benchmarks/` that stores predicted
  peak, observed WASM pages/bytes, solve outcome, timing, browser/version, and
  optional external process peak for representative Tet4/Tet10 meshes. Fit and
  document the safety multiplier and retain the 3.5 GiB cap unless supported-
  browser evidence justifies a changed value without relying on `memory64`.
- [ ] **Choose the measured PCG configuration.** Run representative Tet10
  axial, bending, mixed-scale, and poor-quality cases. Keep Jacobi when it meets
  the documented convergence/time targets; add a first-party IC(0) only if the
  recorded cases demonstrate the need, and include its allocations in preflight.
- [ ] **Flip the production default atomically.** After the native/WASM tests
  pass, make new analyses use Tet10, label Tet4 as an advanced/debug option,
  enable Tet10 preflight/Solve, and show element type in Mesh, preflight,
  Results, and Diagnostics. Rebuild `web/wasm/fem/fem.js` with
  `tools/build-wasm.sh`, then regenerate file-safe wrappers.

## Verification

- Add native Tet10 element, patch, C-API, failure, sparse-memory, axial-bar, and
  cantilever tests. Compare against analytical values and committed reference
  data away from singular boundaries using the Section 16 tolerances.
- Extend `tests/browser/wasm-solve-result-tests.js` and the cube vertical-slice
  harness for Tet10 protocol rejection, preflight counts, pressure/force/gravity
  conservation, cancellation, raw recovery extrema, smoothed fields, memory
  gates, and default-element behavior.
- Run `python3 -m unittest discover -s tests`, configure/build/CTest using the
  README commands, rebuild WASM/local wrappers, run all browser solver harnesses
  from `file://` and HTTP, and inspect the complete generated-artifact diff.

## Done when

New analyses mesh and solve with Tet10 by default, quadratic loads and recovery
pass analytical/reference tolerances, Tet4 remains a working debug/reference
path, and preflight uses recorded browser measurements rather than an
uncalibrated memory factor.
