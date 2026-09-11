# SpjutSim FEA

SpjutSim FEA is a local-first browser application for simple static finite element analysis of a single STEP, IGES, OpenCASCADE BREP, or validated STL solid. The browser application has no runtime network or server dependency; geometry and analysis execute on the user's machine.

## Development status

v1 is unreleased. The approved interface, result-clarity, and bounded STL work
is tracked in [plans 21–30](docs/plans/README.md). Plans 21–23 are implemented
and accepted in the [combined owner review](docs/reviews/21-23-review.md) on
2026-09-08; plans
24–27 are implemented and accepted in the [grouped owner review](docs/reviews/24-27-followup.md) on 2026-09-10; M28 is accepted on 2026-09-11; M29 is implemented pending owner review. Plan 30 remains ahead of the final plan 20 candidate audit. No v1 acceptance is
implied by passing automated checks.

The [accepted STL contract](docs/designs/stl-import-contract.md) and
[M29 review packet](docs/reviews/29-stl-workflow.md) describe the supported subset
and end-to-end evidence.

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
from the HTTP server) to check automatic preflight before solving, blocked checks,
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

For the optional supplied-funnel diagnostic, place `Better Vented Parametric Funnel.stl`
in `tests/fixtures/stl/` and open `tests/browser/funnel-solve-tests.html` from the
local server (or Chromium with local-file access enabled). It uses millimeters,
original triangles, coarse Tet10, ABS, a fixed bottommost patch and 1 MPa pressure
on the topmost patch, with an explicit two-minute trial limit. Allow about three
minutes. `Passed` means the ill-conditioned solve reports live progress and stops
at that budget with no accepted
results; it does not mean the funnel has a valid solution. The user-supplied STL
is not part of the redistributed fixture corpus.

Normal analyses default to a ten-minute sparse-solve limit. Change **Solve time
limit (minutes)** in the Checks panel for a shorter trial or a longer converging
solve. Assembly and stress recovery are separate from this limit.

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
documented local-file browser access) to audit the 68-entry corpus: the original 50 STEP/IGES/BREP cases
plus 18 STL cases. The runner continues through deliberate failures and exports a
compact JSON report. It automatically reloads between 24-case batches to release
terminated worker objects without a browser garbage-collection flag.

Open `tests/browser/stl-import-tests.html`, `stl-workflow-tests.html`,
`stl-mesh-solve-tests.html`, `stl-convergence-tests.html`, and
`stl-resource-tests.html` with local-file access enabled or from the HTTP server.
They cover full solid validation, transactional units/patch review, analytical
Tet10 solves, remeshing/replacement, convergence, limits, and cancellation.
`stl-reconstruction-tests.html`, `stl-surface-modes-tests.html`, and
`mesh-quality-tests.html` cover primitive recovery, original-surface meshing,
source/candidate contracts, holes, cancellation and local-scale quality checks.
Run `stl-mesh-solve-tests.html?surfaceMode=reconstruct` and
`stl-mesh-solve-tests.html?surfaceMode=original` for both new numerical paths.
`stl-remesh-tests.html` and `stl-mesh-solve-tests.html?surfaceMode=remesh`
check experimental parametrization, multiple surfaces per selection group,
feature-angle identity, cancellation and numerical behavior. With the local
funnel fixture present, `funnel-solve-tests.html?surfaceMode=remesh` runs the
40° feature-angle/coarse-mesh trial; append `&preset=normal` or `&preset=fine`
to compare refinement. It reports meshing/solving time, volume change, quality,
stress and displacement; convergence alone does not establish accuracy.
Regenerate the CC0 STL fixtures with
`python3 tools/cad-fixtures/generate-stl-fixtures.py`.

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
STEP/IGES/BREP and bounded STL import and Tet4/Tet10 meshing in disposable Gmsh workers, SI-backed analysis
authoring, exact-topology memory preflight, and the first-party FEM core compiled
as a pinned single-threaded embedded WASM worker runtime. Solves return validated
transferable result models with raw and smoothed stress fields, reactions,
equilibrium and solver diagnostics. The workspace has persistent Setup/Results width preferences, visible pane
toggles, and keyboard/pointer splitters. A separate action bar below the menubar
places Tools and engineering Undo/Redo on the left and Solve beside Results on
the right. Save/Export remain disabled placeholders. Disclosure triangles inside both panels match
Truss. Solve opens Checks, runs preflight, and continues to Results when the
check passes. Large-memory confirmation and cancellation remain available. Empty Results starts collapsed. Below
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
invalidates the mesh and results. Component forces, gravity, and support
components stay in global axes; pressure and normal force follow their assigned
surfaces. Material and opaque surface IDs are retained.

Binary and ASCII STL require explicit m/mm/cm/in/ft units and a dimensions/patch
review before installation. Import supports one closed, connected, consistently
outward-wound, non-self-intersecting manifold solid. Normal import rejects defects
without changing the file. For local topology or winding errors it offers **Try
surface repair**, followed by a repaired-model preview and a change report. Review
that candidate before importing it. Connected angle-based patches default to 40°
(adjustable 1–179°). Choosing units automatically previews the original
triangles; confirm the dimensions, then select **Import model**. Open **Advanced**
to change grouping or choose **Reconstruct simple surfaces** with a maximum
deviation. Reconstruction currently merges
coplanar faces (including holes) and recovers full cylinders/conical frusta with
perpendicular flat ends. Compare the original and candidate before applying.
More complicated fitted-surface intersections and freeform regions are reported
as unsupported; selecting the original surface preserves every triangle and can
retain very small or low-quality elements. See the
[simulation-surface design](docs/designs/stl-simulation-surfaces.md).
**Remesh STL surfaces (experimental)** is a separate option that creates
parametrized surfaces and regenerates both the surface and volume mesh. It
retains selection groups, allowing each group to own several surfaces. It does
not recover smooth CAD curves. The remesh feature angle defaults to 5° to retain
more creases; the supplied funnel trial uses 40°. Changing it requires a new
review. Coarse meshes can approximate away details, so inspect the mesh and
compare refinement before relying on stresses. Meshing failure does not silently
change modes or settings. Mesh/checks diagnostics warn when a patch area changes
by more than 1%, since that can alter pressure forces. See the
[funnel experiment](docs/reviews/29-funnel-remeshing.md) for measured limitations.
**Review STL import settings…** in the Model editor uses explicit assignment transfer, with Cancel
preserving the installed model. Source bytes and options reproduce patch IDs in
fresh workers and after rigid orientation. Limits are 16 MiB, 200,000 triangles,
512 internal geometric surfaces, 2 million intersection candidates, and 120
seconds per STL worker operation. A file below the storage limits can still
exceed the geometric/work limits. Existing solver memory preflight still applies.
Detailed models (25,000+ triangles) show meshing-time advice during review and
beside the mesh controls. This is qualitative guidance, not an estimated finish
time: shape, mesh settings and hardware matter. Begin with Coarse and compare
refinement; keeping original triangles can still produce a dense mesh.
Repair can remove duplicate, zero-area or isolated stray triangles, correct
winding and fill small flat convex holes within the selected limit (default 1%
of the remaining part diagonal; 0 disables filling). It never moves vertices or
joins/discards components. The repaired source must pass every solid check.
**Discard repair** returns to the original pending source; **Download original
STL** preserves access to the original bytes after installation via import
settings. General shape rebuilding, intersecting/disconnected-surface repair,
shells, multiple solids, and OBJ remain deferred.

Open `tests/browser/stl-repair-tests.html` for local repair, numerical and refusal
checks, and `stl-repair-workflow-tests.html` for the real worker/UI flow,
source preservation, cancellation, deadlines and fresh-worker meshing. Append
`?fixture=gargoyle` to either for the supplied file's remaining-component refusal.
`stl-mesh-solve-tests.html?surfaceMode=original&repair=1` checks an analytical solve
after winding repair; `stl-large-tests.html?repair=1` exercises repair at 200,000
triangles. See the [repair design](docs/designs/stl-surface-repair.md) and
[repair evidence](docs/reviews/29-stl-surface-repair.md).

Open `tests/browser/stl-large-tests.html` to check a procedural 200,000-triangle
cube in original/reconstruction modes and mesh the recovered surfaces in a fresh
worker. The optional `?fixture=gargoyle` variant reads the user-supplied
`tests/fixtures/stl/cathedral_gargoyle.stl` and verifies its nonmanifold rejection
in all three modes. That file has 66,174 triangles and passes the size limits,
but needs surface repair before simulation. Neither supplied STL is redistributed.
See [capacity and usability evidence](docs/reviews/29-stl-import-usability.md).

The left pane is one compact Setup sequence: Model, Material, Supports, Loads,
and Mesh. Solve runs checks before execution; the Checks tab precedes Results. Model owns CAD import/replacement and collapses to a
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

File → Settings → Appearance provides FEA Classic, Light Mode, Dark Mode, and Vivid
schemes using the UI Kit portable color contract. Scheme changes apply live to
the interface and semantic viewport colors, persist locally when storage is
available, and support portable version-3 JSON import/export. Imported schemes
that omit FEA-specific load, support, or XYZ roles receive the documented FEA
Classic fallbacks.

See `spec.md` for the product specification and `UI_FOUNDATION.md` for the UI-kit provenance pin.

Display controls use Model/Mesh/Stress/Deformation segments with contextual field
and deformation controls. Display contains independent mesh overlay, shaded/part-edge/
wireframe styles, units, vertical/horizontal legend, and Automatic/Manual limits.
Range lock retains SI limits for the same field across results; field changes reset
incompatible limits. Compact style/orientation preferences persist locally.

Support/load editors now preview changes before Apply/Save. Click faces to toggle
without Shift; background clicks preserve the draft. Cancel/Escape restores the
previous available view and leaves a completed solve intact. Dirty drafts stay
open until Apply or Cancel. The preview reports selection area, global direction,
and the distinction between constant pressure and total force across all faces.
Run `tests/browser/assignment-draft-tests.html` for transactional regression checks.

Checks remain available through View checks and the Checks output tab; stale
reports are labeled with their setup revision. Numerical edits require a new
check; camera/display changes and assignment renaming preserve readiness. A
completed, failed, or cancelled solve gets a fresh check on the next Solve
because its worker has been disposed. Run checks only remains in the Checks tab. `tests/browser/solve-checks-ui-tests.html`
covers report currency, setup links, memory gates, and draft blocking.

Engineering Undo/Redo covers committed support/load add, edit, delete, and rename;
material, gravity, mesh settings; and rigid model orientation. Toolbar and Edit
menu actions show the available edit. History retains at most 50 small definitions
and 2 MiB of serialized data, with no source, mesh, result, or worker snapshots.
Undoing engineering values clears stale results and requires a new check;
orientation and mesh-setting changes also require remeshing. Renames preserve
valid results. Import, replacement, and removal clear history. Undo/Redo is
unavailable during assignment previews or worker execution. Ctrl/Cmd+Z and the
platform Redo shortcut leave text fields, modals, and Settings to their own undo.

Open `tests/browser/engineering-history-tests.html` for command, invalidation,
identity, memory-bound, and shortcut regressions. Open
`tests/browser/grouped-authoring-tests.html` from the optional HTTP server or in
Chromium with local-file access enabled to exercise the real app through import,
Tet10 meshing, preview/Apply/Cancel, check-then-solve, legends at four viewport
sizes, rename/undo, and stale-check recovery. The
[grouped M24–M27 review packet](docs/reviews/24-27-review.md) supplies the owner
checks; automated passes do not constitute manual acceptance.


The M24–M27 manual-review corrections are accepted in the
[combined review](docs/reviews/24-27-followup.md). Deformation opens with Auto scale.
Editing either color limit selects Manual. Drag the legend title or use its
arrow keys to move it; drag the bottom-right handle or use its arrow keys to
resize it. Both orientations remember their own size/position and stay within
the central viewport. Clicking a result selects the actual surface point with
interpolated values and a nearby detail label. Locate peak selects an internal
recovery sample through the same interface; background-click/Escape clears it.

Force defaults to a magnitude of 1 N along local surface normals, with Push/Pull.
Components default to [0, 1, 0] N. Pressure defaults to 1 MPa. Normal magnitude is
distributed by area; opposing normal directions can cancel in the resultant.
Its normalization uses the native integration rule on solver faces in the worker,
then calls the existing pressure kernel. `review-contract-tests.html` covers
normal-force validation, flat/curved Tri6 normalization, and glyph spacing.
The grouped harness compares a normal-force Tet10 solve with its vector equivalent.
Gravity has a separate Loads editor with direction, Apply/Save, Cancel edit, and Remove gravity,
and independent arrow visibility in Display. Enabling it shows an arrow in its
chosen direction; disabling removes it. Successful assignment Apply/Save clears
face selection. Transfer setup uses nearly the whole screen and shows original,
mapped, and active preview assignments on the two models. The top-right status
shows the current operation with an activity icon; routine history text below
Setup is hidden.

New solves retain the chosen view, field, and deformation settings while resetting
color limits to Auto. Display contains Perspective and separate support/load/gravity
arrow visibility. File → Settings → Controls allows middle-button rotation or pan.
Help → About contains application information and license notices. Empty Supports
and Loads rows open their corresponding editors directly.

Result display units include psi/ksi for stress and inch for displacement, with
SI storage unchanged. Legends, manual limits, point details, and Results summaries
follow the selected units. Fit model is the icon below-left of the view gizmo;
it animates to fit while preserving the viewing angle. Setup/Results and the
history/save/export toolbar use the Truss icons, and Edit shows Ctrl+Z/Ctrl+Y.
