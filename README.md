# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP solid. This repository currently contains the initial, dependency-free framework described by `spec.md`; meshing, rendering, and FEM implementation follow in later milestones.

## Run locally

Open `web/index.html` directly in a current Chromium desktop browser. The shell renders a repository-local Three.js reference scene, starts the real mesher and solver worker shells through Blob URLs, and instantiates an embedded minimal WebAssembly module without a server.

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

After changing either file in `workers/`, regenerate the checked-in local-file worker wrappers:

```sh
python3 tools/build-local-runtime.py
```

No npm, Node runtime, frontend framework, transpiler, or application bundler is required.

## Current boundary

The current foundation provides app state/controller seams, the internalized SpjutSim UI sources, a repository-local Three.js reference viewport, worker protocols and lifecycle shells, reproducible local-file worker wrappers, an optional static server, and native solver build/test scaffolding. It does not yet claim STEP import, Gmsh integration, or a functioning FEM solve.

See `spec.md` for the product specification and `UI_FOUNDATION.md` for the UI-kit provenance pin.
