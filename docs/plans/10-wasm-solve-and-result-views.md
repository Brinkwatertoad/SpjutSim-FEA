# Task 10: Integrate WASM solve and first result views

## Outcome

Complete the first browser vertical slice: preflight and solve the authored
Tet4 analysis in a disposable worker, then default the main viewport to
color-coded von Mises stress while allowing Model, Mesh, Stress, and Deformation
views.

## Implementation

- Compile the Task 9 C API to the pinned single-threaded, direct-local-compatible
  WASM package. Add a versioned coarse solver-worker protocol and client that
  transfer mesh/input buffers, validate them once, report coarse progress, and
  normalize native/WASM failures.
- Add controller-owned solve/preflight states and lifecycle. Show mesh/DOF/nnz,
  quality, estimated peak memory, device hint, constraints/loads, warnings, and
  the WASM cap before enabling Solve. Require explicit confirmation at/above
  8 GiB, terminate the mesher before solver allocation, and cancel by
  terminating the worker and discarding partial/stale responses.
- Define a renderer-oriented `ResultModel` containing original surface mapping,
  displacements, raw element fields/extrema, smoothed surface fields, reactions,
  equilibrium, solver statistics, warnings, and transferable visualization
  buffers. Keep raw and displayed-smoothed stress peaks visibly distinct.
- Extend the viewport presentation control: Model shows the CAD preview; Mesh
  shows the Task 7 styles; Stress provides von Mises by default plus principal
  stress choices; Deformation provides displacement magnitude/components and
  undeformed, true-scale, auto, and user-set scale choices. Keep mesh overlay
  independently available in compatible views.
- On solve success, activate Stress/von Mises and show a unit-labeled contour
  legend, unclipped extrema, active range/clipping status, and deformation
  scale. Switching views changes presentation only. Preserve the camera and
  provide approximate picking/probes for coordinates, displacement, active
  stress, and diagnostic `FaceId`.
- Populate Results and Diagnostics with extrema/locations, reactions, applied
  loads, force-balance residual, iterations/residual, mesh statistics, and
  warnings. Any upstream engineering edit marks results stale and requires a
  new explicit solve.

## Verification

- Test worker protocol versions, transfer ownership, stale results, progress,
  cancellation, WASM/native error mapping, memory gates, and result validation.
- Run the STEP cube axial benchmark through import, face selection, material,
  support/load, mesh, preflight, solve, and all four views. Compare displacement
  and stress with the analytical target and verify reaction equilibrium.
- Verify Stress is the default after solve, Mesh remains available, every field
  has units/legend, deformation scale is always shown, camera/selection survive
  mode switches, and GPU/result buffers are disposed on invalidation.
- Run native and browser suites plus the complete vertical slice from `file://`
  and HTTP without main-thread stalls or runtime network access.

## Done when

The cube benchmark solves off the main thread with trustworthy diagnostics and
opens in von Mises contours, while users can reliably inspect deformation,
mesh, and undeformed model views without changing the solved data.
