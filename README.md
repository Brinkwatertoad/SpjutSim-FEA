# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP, IGES, or OpenCASCADE BREP solid. The browser application has no runtime network or server dependency; geometry and analysis execute on the user's machine.

## Development status

v1 is unreleased. CAD-only import is the supported scope. The owner paused STL
on 2026-09-20; its implementation, development history and outstanding problems
are preserved on [features/stl-import](https://github.com/Brinkwatertoad/SpjutSim-FEA/tree/features/stl-import).
See the [archive guide](https://github.com/Brinkwatertoad/SpjutSim-FEA/blob/features/stl-import/docs/STL-DEVELOPMENT.md).
See [CAD-only verification](docs/reviews/cad-only-import.md).
The [plan index](docs/plans/README.md) schedules new pre-v1 work in Plans 30–37,
final usability review in Plan 38, and the exact-candidate audit in Plan 20.
Plans 39–46 prepare post-v1 capabilities and do not gate this release.

## Run locally

Open `web/index.html` directly in a current Chromium desktop browser. Startup renders the local Three.js scene and checks WebAssembly availability. Gmsh and FEM workers start only when an operation needs them; full engine smoke checks are in the runtime test harness. No network requests or local server are required.

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

Open `tests/browser/cad-import-workflow-tests.html` with local-file access enabled
(or from the optional HTTP server) for direct import, unsupported files, overlapping
reads, stale worker completions and replacement review.

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
application's resize sequence, pane controls, keyboard focus, preference
fallbacks, and stable content widths across scrollbar modes and overflow changes.
Repeat at 2× DPI. `tests/browser/result-range-tests.html`,
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
from the HTTP server) to check automatic preflight before solving, blocked checks,
cancellation, stale worker completion, and the existing memory confirmation.
It should report `Passed`.

Open `tests/browser/analysis-authoring-tests.html` directly in Chromium to run
the material/load contract, compact setup inspector summaries and in-place
editing, keyboard/focus behavior, controller invalidation, boundary projection,
surface integration, rigid model/selected-face orientation, and six-face
glyph-orientation checks. It should report `Passed` without a server.

Open `tests/browser/local-frame-tests.html`, `tests/browser/local-support-ui-tests.html`, and
`tests/browser/local-support-workflow-tests.html` with
local-file access enabled or from the HTTP server. They verify frame validation,
immediate frame edits/Undo, rotated Tet4/Tet10 analytical solves, nonzero prescribed
motion, intersecting-face conflicts, signed glyphs, project reopen, replacement,
undo/suppression and curved-face rejection. Native CTest includes local constraint
and full/half symmetry benchmarks. See [Plan 35 evidence](docs/reviews/35-local-directions-and-supports.md).

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
documented local-file browser access) to audit the 50-entry STEP/IGES/BREP corpus. The runner continues through deliberate failures and exports a
compact JSON report. It automatically reloads between 24-case batches to release
terminated worker objects without a browser garbage-collection flag.

After changing files in `workers/`, regenerate the checked-in local-file worker wrappers:

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
Final release review remains pending. Wrangler runs
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
The separate SpjutSim-UI-Kit repository is not relicensed.
The [distribution policy](docs/release/distribution-policy.md) records approval,
source obligations, and final artifact approval.

## Current capabilities

The implemented app supports one homogeneous isotropic CAD solid under small-strain
linear-static loading. Tet10 is the production default; Tet4 remains a reference
option. CAD import/meshing and the first-party FEM solver run in separate disposable
workers. Both direct-local and optional HTTP modes use the validated serial runtimes.

The Setup pane contains Model, Material, Supports, Loads and Mesh. Supports constrain
global or local displacement components, including nonzero prescribed values.
Rectangular manual frames stay global; planar CAD frames follow model rotation.
Planar sliding/symmetry presets restrain normal motion and leave tangential motion
free. Symmetry requires appropriate geometry/loading; loads are not scaled automatically. Loads include
pressure, total global/local force, area-distributed normal force and gravity. Valid
changes commit immediately; incomplete text stays local. Escape closes the editor,
and Undo reverses committed edits.
Existing rows locate/edit their assignments. Model orientation supports axis rotation
and selected-face alignment; replacing CAD uses explicit face-mapping review.

Solve runs constraint/memory checks before execution and retains cancellation,
the WASM cap and high-memory confirmation. Engineering edits invalidate dependent
results; presentation and assignment renames preserve them. Undo/Redo retains bounded
setup definitions and clears after source import/replacement. Mesh removal retains
one mesh by reference for Undo until new meshing or incompatible geometry/settings;
results are never restored.

Model/Mesh/Stress/Deformation views include signed camera controls, independent
projection/style/mesh-overlay choices, movable/resizable legends, contour limits
and approximate point probes. Deformation supports Auto/user scale and animation.
The first solve opens von Mises; later solves retain compatible view choices while
resetting color limits to Auto. Locate peak marks the actual recovery sample,
including an interior location.

Results distinguish unaveraged solver peaks from smoothed boundary contours.
Yield FoS uses the smaller available yield strength, with an independently capped
contour. Global mesh convergence tracks displacement/energy separately from peak
stress stability. One solve or a smooth contour does not establish safety.

File → Settings provides navigation bindings, SI/USCS/custom unit preferences and
FEA Classic/Light/Dark/Vivid themes. Custom unit sets support Save copy, name-based
save/rename, automatic updates to an active saved set and Delete to Custom.
All engineering values remain SI; unit changes convert current entries without
invalidating results. Material source/limitations remain visible; see
[polymer strength evidence](docs/material-strengths.md).

After solving, use the existing report format control and Export icon for an editable
DOCX or text/PNG ZIP. Both include setup/results/diagnostics/convergence and clean
reset/fitted scene images: assignments, mesh, stress, optional FoS and Auto deformation.
Captures restore the user's scene and abort on stale results. Validate a DOCX with:

```sh
python3 tests/validate_report_docx.py path/to/report.docx
```

Save project (Ctrl/Cmd+S) downloads a `.spjutsim-fea` file containing CAD and
committed setup. Include mesh/results is opt-in. File → Open (Ctrl/Cmd+O) accepts
CAD or a project file. Project opening validates
source and face identity before replacing the current analysis. Local recovery
writes committed setup promptly and automatically reopens the previous part.
File → Local recovery offers older copies; live-tab conflicts and failures are
reported. File → New resets the project while preserving preferences/libraries
and a recoverable previous setup. New has no keyboard shortcut. Reload/close
never shows an unsaved-site warning; storage failure does not disable manual saving. See [the format and limits](docs/project-format.md).

Model shows CAD volume and density-derived mass before meshing. Display offers
pick-through, hide/isolate and Show all for Model/Mesh faces; assignment rows locate
existing loads/supports. Visibility never removes faces from the analysis.
The options icon directly on the Mesh row opens formulation settings, including
Tet4; Tet10 remains the default. Nondefault settings remain in the row summary. The duplicate View menu is removed; signed views,
Fit, Reset and Perspective remain at the viewport. Report controls sit together
beside Solve/Results. Stress/Deformation interaction is retained.

Setup selectors commit immediately. Numeric fields commit on Enter or blur; invalid
text leaves the previous valid assignment intact. Close an editor with its row or
Escape, and use Undo to reverse committed changes. Existing compact rows expose
right-aligned removal. Rectangular frames use global-axis rotation controls and an
axis preview; supplementary area/direction explanations live behind info controls.

The [material library](docs/material-library.md) reuses the Truss searchable table
and full property editor, including optional properties, notes and sources. Save
stores a reusable record; Use assigns a project snapshot. Cross-app import remains
future work. Test these workflows with `tests/browser/immediate-setup-tests.html`
and `tests/browser/material-library-tests.html` using the same local-file browser
configuration as the CAD workflow tests.

Assignment options include Duplicate and Suppress/Include. The empty viewport offers Import CAD… and Open Cube Example, with no placeholder
solid. The example already has material, supports, load and Tet10 settings.
A dismissible guide starts after CAD import; dismissal is remembered. Help →
Show setup guide brings it back. The guide highlights clickable controls: an
editor opener or Add, face selection on the model, then the editing controls.
Closing the editor returns the guide to Add for another assignment. The button highlight surrounds the whole control without
changing its normal styling.
A valid material choice or property edit advances to Supports; other stages use Next/Back.
Rerenders do not scroll the pane or advance the guide.
The guide teaches Generate mesh, Inspect mesh,
then Solve; the prepared cube starts at Generate mesh. Recovered projects reopen
quietly. Mesh and solve runs generation, checks and solve on explicit request, retaining cancellation and
independent Generate mesh/Run checks actions. Rebuild the embedded example with
`python3 tools/build-examples.py` when its source fixture changes.

The options button beside Export adds title/notes, selected preset images and an
optional current view. Defaults remain complete; mandatory engineering context
cannot be omitted. Export becomes Cancel export while capturing and restores the
scene on completion, cancellation or failure. Validate project archives with:

```sh
python3 tests/validate_project_file.py path/to/project.spjutsim-fea
```

Plans 30–34 are implemented with [verification and remaining owner checks](docs/reviews/30-34-verification.md).
Practical supports/loads (35–37) and final usability review (38) remain planned;
advanced studies/physics remain post-v1. See [the plan index](docs/plans/README.md).

## Documentation and focused browser checks

[spec.md](spec.md) defines thematic requirements and numerical/architectural limits.
[docs/plans](docs/plans/README.md) owns delivery status and review checkpoints.
[Review records](docs/reviews/requirements-history.md) preserve historical changes,
commits, tests and owner acceptance. [UI_FOUNDATION.md](UI_FOUNDATION.md) records
the UI foundation provenance pin.

In addition to the test commands/harnesses above, open these browser harnesses
with the documented local-file access or optional HTTP server:

- `assignment-draft-tests.html`, `engineering-history-tests.html`,
  `solve-checks-ui-tests.html` and `grouped-authoring-tests.html` cover committed
  edits, cancellation, stale checks, history and the actual grouped workflow.
- `review-contract-tests.html` covers normal-force integration and glyph contracts.
- `material-strength-tests.html`, `load-unit-tests.html`, `load-entry-tests.html`
  and `unit-preferences-tests.html` cover material provenance and physical-value
  preservation through unit/editing changes.
- `docx-tests.html`, `report-tests.html` and `report-workflow-tests.html` cover
  packages, actual solved captures/downloads, restoration and stale export.

All are under `tests/browser/`. Automated passes do not substitute for the
owner walkthrough required by the applicable plan.

- `project-file-tests.html`, `project-workflow-tests.html`, `project-recovery-tests.html`
  cover portable validation, atomic open, stale operations and real IndexedDB failures.
- `project-interface-tests.html` and `project-cad-tests.html` exercise the actual UI,
  STEP/IGES/BREP round trips, cached reopen and a fresh analytical solve.
- `contextual-workflow-tests.html`, `model-information-tests.html` and
  `face-access-tests.html` cover suppression, prescribed displacement readiness,
  volume/mass, units and viewport selection.

`project-resume-tests.html` covers prepared-example equilibrium, automatic reopen,
New/empty restoration, guide dismissal, mesh options placement and Open/Save shortcuts.
