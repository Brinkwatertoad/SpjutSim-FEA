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

The current foundation provides app state/controller seams, the internalized SpjutSim UI sources, a repository-local Three.js viewport, a pinned serial Gmsh/OpenCASCADE local runtime, and local STEP import for exactly one closed solid. Import normalizes STEP units to meters, retains canonical source bytes for later disposable-worker remeshes, exposes opaque CAD face identities, and renders a grouped surface preview. The volume-mesh contract and functioning FEM solve follow in later plans.

See `spec.md` for the product specification and `UI_FOUNDATION.md` for the UI-kit provenance pin.
