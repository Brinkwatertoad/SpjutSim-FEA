# Task 2: Prove the Gmsh local-runtime path

## Outcome

Initialize a pinned, single-threaded Gmsh/OpenCASCADE WASM build inside the
mesher worker in direct-local mode. This is a packaging and feasibility spike,
not the public mesher API or polished import workflow.

## Implementation

- Select and pin one Gmsh/OpenCASCADE build. Prefer a reproducible upstream
  source build; a prebuilt browser package is acceptable only for this spike.
  Record versions, source, licenses, Emscripten version/flags, checksums, and
  local wrapper changes in `THIRD_PARTY.md`.
- Extend the runtime generator from Task 1 so the mesher worker can initialize
  Gmsh without `fetch()`, modules, a CDN, `SharedArrayBuffer`, or a server. Keep
  generated payloads under `web/generated/local-runtime/` and readable adapter
  code under `workers/` or `web/js/mesh/`.
- Add a narrow `initialize`/`diagnostics` request that returns Gmsh version,
  runtime mode, and capability information using protocol version 1.
- In a worker-only smoke path, create a simple OpenCASCADE box, synchronize it,
  and report its volume and surface counts. Clear Gmsh state between requests
  and prove worker termination releases the runtime.
- Translate loader/runtime failures into a stable structured error such as
  `MESHER_INITIALIZATION_FAILED`; retain raw details only as developer text.
- Do not expose Gmsh objects on the main thread or choose production mesh
  algorithms and quality thresholds in this spike.

## Verification

- Add generator/adapter tests for success, malformed requests, version mismatch,
  and normalized structured errors.
- Run the full existing Python and native suites.
- From `file://`, initialize the mesher, execute the box smoke request twice in
  fresh workers, and verify the UI remains responsive.
- Repeat in portable and cross-origin-isolated HTTP modes. The single-threaded
  result must be identical; threaded acceleration remains out of scope.

## Done when

The checked-in distribution can start Gmsh and perform an OpenCASCADE operation
entirely inside a disposable worker without any runtime network access. Update
`web/wasm/gmsh/README.md` with exact regeneration and troubleshooting steps.

