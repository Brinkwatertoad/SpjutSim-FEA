# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP solid. The browser application has no runtime network or server dependency; geometry and analysis execute on the user's machine.

## Run locally

Open `web/index.html` directly in a current Chromium desktop browser. The startup check renders the repository-local Three.js scene, initializes serial Gmsh/OpenCASCADE in two fresh disposable workers, creates a unit box in each, and starts the solver worker shell. No network requests or local server are required.

For optional cross-origin-isolated HTTP mode:

```sh
python3 tools/serve.py
```

Then open `http://127.0.0.1:8000/web/`.

## Test

```sh
python3 -m unittest discover -s tests
cmake -S native/fem -B build/native-fem
cmake --build build/native-fem
ctest --test-dir build/native-fem
```

Open `tests/browser/worker-runtime-tests.html` directly in Chromium to run the
worker protocol-validation and lifecycle regression checks; it should report
`Passed` without a server.

Open `tests/browser/step-import-tests.html` from the optional HTTP server to
run the Gmsh-backed STEP cube import check. In the tested direct-local browser
configuration it can also be opened with local-file access enabled; it should
report `Passed` after the worker starts.

Open `tests/browser/tet4-mesh-tests.html` from the optional HTTP server to run
the cube Tet4 extraction checks across the coarse, normal, fine, and custom
presets. It should report `Passed`; this verifies boundary FaceId stability,
positive volumes, surface area, and increasing preset resolution.

Open `tests/browser/preview-selection-tests.html` from the optional HTTP server
to run the imported STEP-cube face-picking checks across canvas sizes. It should
report `Passed`; the pointer conversion check also covers a simulated 2× device
pixel ratio.

Open `tests/browser/viewport-navigation-tests.html` directly in Chromium to run
the camera navigation, preference validation, and pointer-cancellation checks.
It should report `Passed`.

Open `tests/browser/analysis-authoring-tests.html` directly in Chromium to run
the material/load contract, controller invalidation, boundary projection,
surface-integration, and six-face glyph-orientation checks. It should report
`Passed` without a server.

After changing either file in `workers/`, regenerate the checked-in local-file worker wrappers:

```sh
python3 tools/build-local-runtime.py
```

Rebuilding the pinned Gmsh/OpenCASCADE artifact is an infrequent dependency-update operation. It downloads and compiles the toolchain and third-party sources under ignored `build/` paths:

```sh
tools/build-gmsh-local-runtime.sh
```

No npm, Node runtime, frontend framework, transpiler, or application bundler is required.

## Current boundary

The current foundation provides app state/controller seams, the internalized SpjutSim UI sources, a repository-local Three.js viewport, a pinned serial Gmsh/OpenCASCADE local runtime, and local STEP import for exactly one closed solid. Import normalizes STEP units to meters, retains canonical source bytes for later disposable-worker remeshes, exposes opaque CAD face identities, and renders a grouped surface preview with orbit/zoom face selection. Coarse, normal, fine, and custom settings produce validated Tet4 volume meshes with CAD-face boundary mapping. Users can author an SI-backed isotropic material, fixed or prescribed supports, pressure, integrated total face force, and gravity. The first-party native FEM core now provides validated Tet4 assembly, deterministic scalar CSR, symmetric constraints, Jacobi-PCG diagnostics, reactions/stress recovery, a versioned C ABI, and exact-topology memory preflight. Browser/WASM solve wiring and result views follow in the next plan.

See `spec.md` for the product specification and `UI_FOUNDATION.md` for the UI-kit provenance pin.
