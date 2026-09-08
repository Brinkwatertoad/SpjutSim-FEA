# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP, IGES, or OpenCASCADE BREP solid. The browser application has no runtime network or server dependency; geometry and analysis execute on the user's machine.

## Development status

v1 is unreleased. The approved interface, result-clarity, and bounded STL work
is tracked in [plans 21–30](docs/plans/README.md). Plans 21–23 are implemented
and accepted in the [combined owner review](docs/reviews/21-23-review.md) on
2026-09-08; plans
24–30 remain ahead of the final plan 20 candidate audit. No v1 acceptance is
implied by passing automated checks.

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

Open `tests/browser/tet10-mesh-tests.html` from the optional HTTP server to run
the quadratic cube extraction check. It verifies Gmsh Tet10/Tri6 node ordering,
quadratic boundary preservation, four-triangle display subdivision, stable CAD
face ranges, and sampled Jacobian/edge-ratio quality metadata.

Open `tests/browser/preview-selection-tests.html` from the optional HTTP server
to run the imported STEP-cube face-picking checks across canvas sizes. It should
report `Passed`; the pointer conversion check also covers a simulated 2× device
pixel ratio.

Open `tests/browser/workspace-layout-tests.html` directly in Chromium with local
file access enabled (or from the optional HTTP server) to exercise the real
application's resize sequence, pane controls, keyboard focus, and preference
fallbacks. Repeat at 2× DPI. `tests/browser/result-range-tests.html`,
`tests/browser/result-formatting-tests.html`, and
`tests/browser/result-presentation-tests.html` cover boundary-only contour
ranges, scientific number formatting, and a quiet von Mises legend/color scale
from zero to the whole-model sample peak.
They should report `Passed`.

Open `tests/browser/viewport-navigation-tests.html` directly in Chromium to run
the orthographic/perspective camera, six signed views, interactive gizmo,
projection preference migration, exact peak marker, and pointer-cancellation checks.
It should report `Passed`.

Open `tests/browser/solve-workflow-tests.html` with local file access enabled (or
from the HTTP server) to check automatic preflight before Solve, blocked checks,
cancellation, stale worker completion, and the existing memory confirmation.
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

Open `tests/browser/factor-of-safety-tests.html`,
`tests/browser/convergence-tests.html`, and
`tests/browser/convergence-runner-tests.html` directly for the pure trust and
sequencing contracts. `tests/browser/cube-convergence-tests.html` runs a real
two-level Tet10 analytical convergence study through disposable Gmsh and FEM
workers; enable local-file access for that harness.

Open `tests/browser/validation-benchmark-tests.html` from the optional HTTP
server to rerun the five-case Tet10 validation matrix. Copy its JSON evidence to
`benchmarks/validation/spjutsim-browser-evidence.json`, rebuild normalized
records with `python3 tools/build-validation-records.py`, and enforce all
Section 16.2 limits with `python3 tools/validate-validation-records.py`.

Open `tests/browser/resource-benchmark-tests.html?repetitions=3` in current
desktop Chromium under both direct `file://` and `tools/serve.py`, and in
current desktop Firefox under direct `file://`, to reproduce the resource
matrix. Supply `commit`, `memoryBytes`, `architecture`, `browser`, and
`browserVersion` query parameters. The harness checkpoints completed cases in
browser storage, exposes the final array as `window.__spjutsimResourceRecords`,
and is documented in `benchmarks/resource/README.md`.

Run `python3 tools/validate-cad-corpus.py`, then open
`tests/browser/cad-corpus-tests.html` from the optional HTTP server (or with the
documented local-file browser access) to audit the 50-entry STEP/IGES/BREP
release corpus. The runner continues through deliberate failures and exports a
compact JSON report.

After changing either file in `workers/`, regenerate the checked-in local-file worker wrappers:

```sh
python3 tools/build-local-runtime.py
```

Rebuild the checked-in single-file FEM WebAssembly runtime and its file-safe
wrapper after changing the native FEM core or browser bridge:

```sh
tools/build-wasm.sh
```

On macOS and WSL/Linux, use a host-native Emscripten SDK (the checked-in
runtime uses version 3.1.74). The build script selects the compiler in this
order:

1. `EMXX`, when explicitly set to a compiler executable or command on `PATH`.
2. `SPJUTSIM_EMSDK_ROOT`, when set to a directory containing `emsdk_env.sh`.
3. The SDK at `${SPJUTSIM_GMSH_BUILD_ROOT:-build/gmsh-local-runtime}/emsdk`,
   then `build/emsdk`, relative to the checkout for the default paths.
4. `em++` already available on `PATH`, including an activated external SDK.

For an SDK outside the checkout, run
`SPJUTSIM_EMSDK_ROOT="/path/to/emsdk" tools/build-wasm.sh`. Paths containing
spaces are supported. Explicit `EMXX` skips SDK activation; a missing explicit
SDK directory reports an error. When moving between macOS and WSL, install and
activate the SDK on the destination OS; downloaded compiler binaries are
platform-specific. Native tests require Python 3, CMake, and a C++17 compiler
on each host.

Rebuilding the pinned Gmsh/OpenCASCADE artifact is an infrequent dependency-update operation. It downloads and compiles the toolchain and third-party sources under ignored `build/` paths:

```sh
tools/build-gmsh-local-runtime.sh
```

No npm, Node runtime, frontend framework, transpiler, or application bundler is required.

## Deploy a Cloudflare preview

The checked-in `wrangler.jsonc` publishes an audited source-accompanied package to the
`spjutsim-fea` Worker's `workers.dev` hostname and the `fea.spjutsim.com`
Custom Domain. Prepare a fresh candidate before deployment:

```sh
python3 tools/audit-distribution.py
python3 tools/package-distribution.py --fetch-sources
python3 tools/audit-distribution.py --release-root build/distribution/web --require-approved
wrangler deploy
```

The owner approved GPL-2.0-or-later for first-party FEA and copied UI source.
The final policy and artifact list were approved on 2026-09-07. Wrangler runs
the distribution audit and serves `build/distribution/web`, including local license
notices and exact corresponding-source archives. Do not deploy bare `web/`.
See [the release procedure](docs/release/SOURCE.md) for rebuilding, offline
packaging, reviewing, and retaining source for each release.

Wrangler is not an application runtime or development dependency; direct
`file://` previewing and all normal source work remain dependency-free.

## License

First-party SpjutSim FEA source and the UI foundation copies in this repository
are [GPL-2.0-or-later](LICENSE), copyright (c) 2026 Brinkwatertoad, without
warranty. Third-party materials retain their own licenses; see [NOTICE](NOTICE),
[THIRD_PARTY.md](THIRD_PARTY.md), and the application's local Licenses page.
The separate SpjutSim-UI-Kit repository is not relicensed by this decision.
The [distribution policy](docs/release/distribution-policy.md) records approval,
source obligations, and final artifact approval.

## Current boundary

The current vertical slice provides app/controller-owned analysis state, local
STEP/IGES/BREP import and Tet4/Tet10 meshing in disposable Gmsh workers, SI-backed analysis
authoring, exact-topology memory preflight, and the first-party FEM core compiled
as a pinned single-threaded embedded WASM worker runtime. Solves return validated
transferable result models with raw and smoothed stress fields, reactions,
equilibrium and solver diagnostics. The workspace has persistent Setup/Results width preferences, visible pane
toggles, and keyboard/pointer splitters. A separate action bar below the menubar
places Tools on the left and Solve beside Results on the right, with disabled
Undo/Redo/Save/Export placeholders. Disclosure triangles inside both panels match
Truss. Solve runs an available preflight first and proceeds only after a valid
check; explicit preflight remains available. Empty Results starts collapsed. Below
1000 CSS pixels one pane is active at a time; below 680 pixels panes become
explicitly opened drawers over a full-width canvas. View defaults to
an orthographic three-face view. The 3D display Perspective switch preserves the
view angle and apparent scale. The cube icon resets the view with a brief
interruptible animation. Gizmo circles and negative labels appear on hover or
keyboard focus (always on no-hover devices); labels respect arrow depth.

The viewport supports Model, Mesh, Stress,
and Deformation presentation (including legends, scale modes, mesh overlay, and
approximate probes), defaults to von Mises stress after solve, and disposes stale
result resources after upstream engineering edits. The result headline and
yield FoS use unaveraged recovery samples; contour extrema use only nodes
referenced by the rendered boundary. The von Mises legend and colors use zero
to the whole-model sample peak; surface maximum/smoothing detail lives in a
tooltip and the Results panel. Stress smoothing remains the within-element
sample mean followed by the unweighted adjacent-element mean. Locate peak marks
the actual interior recovery sample in undeformed coordinates, through the
surface if necessary. Sample maxima are not exact continuum maxima. Small
numbers remain visible in scientific notation. Deformation view includes a
Truss-compatible Play/Stop animation, an exaggeration slider, and a live scale
readout; animation is presentation-only and returns to the selected full scale
when stopped.

The compact Model editor can rotate the part around a global X, Y, or Z axis by
an adjustable angle (90 degrees by default), reset the imported orientation, or
align one selected CAD face normal to a signed global axis. Geometry orientation
invalidates the mesh and results; loads, gravity, support components, material,
and CAD `FaceId` references remain in the global analysis frame. STL is not
implemented yet; plans 28–29 schedule explicit units, durable
surface-patch identity, solid validation, and the accepted analysis path before
v1. OBJ remains deferred.

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

Tet10 is the production default. Quadratic meshes preserve six-node boundary
faces for load integration and use a separate linear-triangle subdivision for
viewport display and picking. Tet4 remains available as a debug/reference
option. The native/WASM result contract retains four Tet10 recovery samples per
element alongside separately named element-averaged smoothing fields.

When a tensile or compressive yield strength is supplied, completed results add
a von-Mises-yield factor of safety. Raw recovery-sample and approximate smoothed
surface minima remain separately labeled; the FoS contour is capped at 10 for
color mapping without changing the engineering values. Result summaries state
the linear-elastic, small-strain, static, single-isotropic-solid assumptions and
report single solves as `Not studied` for convergence.

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
