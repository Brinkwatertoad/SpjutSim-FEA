# Combined M21–M23 owner review

- Status: **Accepted 2026-09-08**. Implementation and automated checks complete.
- Authorization: on 2026-09-07 the owner requested several plans before a manual
  check and allowed subagents. Implementation of 21–23 was batched; usability
  acceptance was not inferred.
- Working tree: branch `work/plans-21-23`, based on
  `ffde30c3176311eaa85aacd79064cfb545241388`, with the plan 21–23 changes shown by
  `git diff` and new workspace/result tests and review evidence. Not published.
- App: open `web/index.html` directly, or run `python3 tools/serve.py` and open
  `http://127.0.0.1:8000/web/`.
- Automated browser: Chrome for Testing 151.0.7922.34 (cached Chromium 1234), Linux x86_64,
  headless software WebGL; direct `file://` with local-file access enabled for
  fixture harnesses. Navigation/layout/picking also exercised at 2× DPI.
- Start with [the shared cube setup below](#shared-solved-fixture), then follow
  [M21 workspace](21-workspace.md), [M22 results](22-result-clarity.md), and
  [M23 camera](23-camera.md). These are one combined review session.
- Owner review revisions approved 2026-09-07–08: action bar placement,
  quiet whole-model stress scale, hover/depth gizmo, Perspective switch, graphical
  animated Reset view, Truss disclosure triangles, and automatic preflight on
  Solve. Owner subsequently confirmed: “Manual check passes.”

## Shared solved fixture

Import `tests/fixtures/generated-unit-cube-m.step` (a 1 m cube). Set custom
material E = 1 GPa, Poisson ratio = 0.25, density = 1000 kg/m³, tensile yield =
250 MPa. Generate a **coarse Tet10** mesh (5901 nodes, 3517 elements in this
runtime). Add supports and load using the signed View commands to identify faces:

1. On X = 0, constrain only X displacement to zero.
2. On Y = 0, constrain only Y displacement to zero.
3. On Z = 0, constrain only Z displacement to zero.
4. On X = 1, add total force `[1000, 0, 0]` N.
5. Press Solve to run preflight and solve. Results opens; use the cube Reset view
   icon and Fit model. Explicit Run preflight is also available.

Expected axial displacement on X = 1 is 1e-6 m; sample von Mises is
1000.0000091943822 Pa, smoothed surface maximum 1000 Pa, sample yield FoS
249999.99770140447. Reaction X is approximately −1000 N. This is an analytical
presentation fixture, not a material suitability assessment.

For the constrained example, replace the three symmetry supports with one
Fixed (X/Y/Z = 0) support on X = 0, keep the load/material/mesh, then preflight
and solve again. Expected sample peak is 1518.2881864894243 Pa, smoothed surface
maximum 1224.4141845703125 Pa, sample FoS 164659.1221776205 and smoothed minimum
FoS 204179.28125. The nearby support edge produces the intended peak contrast.

The exact sample positions and equilibrium evidence are recorded in
[evidence/21-23-integration.json](evidence/21-23-integration.json).

## Automated evidence

- Python: `python3 -m unittest discover -s tests` — 77 tests pass.
- Native: README configure/build commands and `ctest --test-dir build/native-fem`
  — 8/8 pass. This host's unpacked CMake lives under
  `build/operator-tools/cmake/root/usr/bin`; its adjacent
  `usr/lib/x86_64-linux-gnu` was supplied through `LD_LIBRARY_PATH`.
- All 18 ordinary browser harnesses pass (workspace, range, formatting,
  result presentation, automatic solve workflow, navigation, worker runtime, CAD import, Tet4/Tet10 mesh,
  picking, authoring, solve, FoS, both pure convergence harnesses, Tet10 vertical
  slice, and real cube convergence). The five-case validation benchmark and
  50/50 CAD corpus harness also pass. Harnesses are standalone HTML files under
  `tests/browser`, with results reported in their status element.
- Workspace/navigation/picking pass at 2× DPI. Full app startup reaches
  “Local runtime ready” without a server. Workspace and WASM-result harnesses
  also pass under the optional HTTP server. Live 1× → 2× → 1.25× pixel-ratio
  changes update the drawing buffer through window resize. Projection menu activation by keyboard
  and settings persistence also pass in the real app.
- Baseline/current worker comparisons use identical Tet4, uniform Tet10, and
  constrained Tet10 inputs: all 25 compared result/location arrays per case,
  raw extrema and equilibrium are bit-for-bit unchanged. See
  [the comparison records](evidence/22-baseline-comparison.jsonl).
- [Integration evidence](evidence/21-23-integration.json) records actual solved
  values and camera invariance. Camera commands preserve analysis revision,
  mesh/result objects, loads, and supports. No page errors occurred.
- Worker wrappers regenerated with `python3 tools/build-local-runtime.py`;
  artifact hashes refreshed through `tools/audit-distribution.py --refresh-hashes`.
  The local distribution audit passes. Its former final artifact approval is
  stale for this changed manifest; Task 20 must bind the final accepted artifact.
- One complete diff review covers boundaries, allocations, validation, focus,
  result ownership and generated files. Historical validation/resource reports
  are retained. This batch does not recertify the release resource matrix or
  supply a new release candidate audit.

## Review revisions (2026-09-08)

- Action bar: Tools left; disabled Undo/Redo/Save/Export; Solve immediately left
  of Results on the right. Both panels use Truss disclosure triangles.
- Solve runs preflight first when needed, reuses a ready worker, stops on failed
  checks/cap/cancellation/edits, and retains high-memory confirmation. The
  integration fixture now uses the actual Solve button for both cases. Progress
  and preflight failures are visible in Results even when Tools is collapsed.
- Quiet legend: `von Mises (MPa)`, zero and sample-peak endpoints; rendered
  colors use the same scale. Hover reveals the surface maximum and smoothing
  explanation. Boundary range metadata remains unchanged.
- Gizmo: circles/negative labels on area hover or focus, with no-hover fallback;
  labels test against arrow depth. Perspective is a 3D display switch. Cube
  Reset view animates target, angle, and zoom with reduced-motion support.
- Revised [hover](evidence/23-gizmo-hover.png) and
  [reset](evidence/23-reset-view.png) screenshots supplement the updated solved
  workspace images. All 18 browser harnesses, 77 Python tests, and 8 native
  tests pass for the revisions; layout/navigation/picking also pass at 2× DPI.
  Original numerical benchmark and baseline-comparison evidence above remains
  applicable: these revisions change presentation and command orchestration.

## Owner acceptance — 2026-09-08

The owner confirmed “Manual check passes” and authorized commit/push after two
final cosmetic fixes: restore Solve’s accent background, and place the menus
immediately after SpjutSim FEA with runtime status aligned to the far right.
Both fixes are covered by the workspace browser harness. The updated screenshots
show this final header. M21–M23 are accepted; Plan 24 is next. v1 remains unreleased.
