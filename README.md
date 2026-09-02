# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP, IGES, or OpenCASCADE BREP solid. The browser application has no runtime network or server dependency; geometry and analysis execute on the user's machine.

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
run the Gmsh-backed STEP, IGES, and BREP cube import checks. In the tested
direct-local browser configuration it can also be opened with local-file access
enabled; it should report `Passed` after the worker starts.

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
the material/load contract, compact setup inspector summaries and in-place
editing, keyboard/focus behavior, controller invalidation, boundary projection,
surface integration, rigid model/selected-face orientation, and six-face
glyph-orientation checks. It should report `Passed` without a server.

Open `tests/browser/wasm-solve-result-tests.html` directly in Chromium to run
the embedded FEM worker preflight/solve, transferable result-contract, progress,
equilibrium, staleness, and default-result-view checks. Open
`tests/browser/cube-wasm-vertical-slice-tests.html` with local-file access
enabled (or from the optional HTTP server) for the full STEP cube import,
face-authored support/load, mesh, analytical axial solve, and four-view check.

After changing either file in `workers/`, regenerate the checked-in local-file worker wrappers:

```sh
python3 tools/build-local-runtime.py
```

Rebuild the checked-in single-file FEM WebAssembly runtime and its file-safe
wrapper after changing the native FEM core or browser bridge:

```sh
tools/build-wasm.sh
```

Rebuilding the pinned Gmsh/OpenCASCADE artifact is an infrequent dependency-update operation. It downloads and compiles the toolchain and third-party sources under ignored `build/` paths:

```sh
tools/build-gmsh-local-runtime.sh
```

No npm, Node runtime, frontend framework, transpiler, or application bundler is required.

## Deploy a Cloudflare preview

The checked-in `wrangler.jsonc` publishes `web/` as static assets to the
`spjutsim-fea` Worker's `workers.dev` hostname and the `fea.spjutsim.com`
Custom Domain. With Wrangler available as operator tooling, run:

```sh
wrangler deploy
```

Wrangler is not an application runtime or development dependency; direct
`file://` previewing and all normal source work remain dependency-free.

## Current boundary

The current vertical slice provides app/controller-owned analysis state, local
STEP/IGES/BREP import and Tet4 meshing in disposable Gmsh workers, SI-backed analysis
authoring, exact-topology memory preflight, and the first-party FEM core compiled
as a pinned single-threaded embedded WASM worker runtime. Solves return validated
transferable result models with raw and smoothed stress fields, reactions,
equilibrium and solver diagnostics. The viewport supports Model, Mesh, Stress,
and Deformation presentation (including legends, scale modes, mesh overlay, and
approximate probes), defaults to von Mises stress after solve, and disposes stale
result resources after upstream engineering edits. Deformation view includes a
Truss-compatible Play/Stop animation, an exaggeration slider, and a live scale
readout; animation is presentation-only and returns to the selected full scale
when stopped.

The compact Model editor can rotate the part around a global X, Y, or Z axis by
an adjustable angle (90 degrees by default), reset the imported orientation, or
align one selected CAD face normal to a signed global axis. Geometry orientation
invalidates the mesh and results; loads, gravity, support components, material,
and CAD `FaceId` references remain in the global analysis frame. STL and OBJ are
intentionally deferred until durable surface-patch identity and solid validation
are defined for tessellated input.

The left pane is one compact Setup sequence: Model, Material, Supports, Loads,
Mesh, and Solve Preflight. Model owns CAD import/replacement and collapses to a
small source/face/orientation summary; Material expands independently directly
beneath it. Importing over an active model opens a side-by-side transfer flow.
Each old support/load is highlighted in order while the user maps replacement
faces or explicitly drops the item. Material, gravity, mesh/solve settings, and
orientation transfer automatically, and the replacement is installed only
after the completed summary is accepted.

Every support uses one component-based global-coordinate contract. The Fixed
editor preset sets X, Y, and Z displacement to zero; Choose components permits
any one-, two-, or three-axis combination and finite nonzero prescribed values.
The compact Supports group continuously reports provisional preview or exact
mesh rank across Tx/Ty/Tz/Rx/Ry/Rz, explicitly identifying free or coupled rigid
motion. Native solver diagnostics remain the final singularity check.

Loads and supports are shown at deterministic, area-aware samples across their
actual selected surfaces. Load-arrow tips touch the surface; all vector arrows
use thin cylinder shafts with cone heads. Default load/support roles are red and
green. A compact labeled, theme-colored XYZ triad remains fixed and fully inside
the lower-left viewport corner while rotating with the camera; its pixel-space
layout preserves label proportions across resize and aspect-ratio changes.

Settings → Appearance provides FEA Classic, Light Mode, Dark Mode, and Vivid
schemes using the UI Kit portable color contract. Scheme changes apply live to
the interface and semantic viewport colors, persist locally when storage is
available, and support portable version-3 JSON import/export. Imported schemes
that omit FEA-specific load, support, or XYZ roles receive the documented FEA
Classic fallbacks.

See `spec.md` for the product specification and `UI_FOUNDATION.md` for the UI-kit provenance pin.
