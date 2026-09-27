# Edge rounding, larger beam and Examples menu

**Withdrawn by the owner (2026-09-26).** Rounding was removed from the app,
worker APIs and current specification after repeated usability/reliability problems.
The material below is historical evidence, not a supported feature or active plan.
The corrected beam example and Examples menu are retained.


Owner requested implementation on 2026-09-26. Working-tree implementation;
owner walkthrough remains pending. No deployment or release acceptance implied.

Model → Auto-round sharp edges opens a reversible preview and radius comparison.
Eligible edges are selected automatically; support/load faces, their vertices,
seams and smooth/unclassifiable edges are excluded and explained. A suggested
radius is an explicit geometry assumption (1% of the smallest bounding span),
with optional browser persistence. No default is a manufacturing specification.

The comparison runs r/2, r and 2r, with two meshes at each fixed radius. It shows
actual displacement/energy/stress changes against 2%/2%/5% screening thresholds,
plus von Mises yield FoS and the governing yield strength. Original CAD and
results remain intact. Compact assumptions/results survive project save/reopen
and appear separately in reports; changed engineering inputs invalidate them.

Numerical evidence from the generated stepped/notched prism, steel E=200 GPa,
nu=0.3, 250 MPa yield, fixed X=0 end and 100 N in −Y at X=0.2 m:

| Radius | Finer nodes | Max displacement | Raw peak von Mises | Peak mesh change |
| --- | ---: | ---: | ---: | ---: |
| 2 mm | 103,480 | 2.06952 µm | 2.80734 MPa | 3.606% |
| 4 mm | 34,796 | 2.04356 µm | 2.08797 MPa | 1.631% |
| 8 mm | 14,938 | 1.99009 µm | 1.58867 MPa | 0.539% |

All displacement/energy changes were below 0.19%. These numbers demonstrate
separate mesh and radius sensitivity in this fixture, not an independently
validated stress-concentration benchmark or a universal rounding prescription.
Small radii can make the automatic study expensive. The two-mesh check is not an
error bound. Protected constraint singularities are deliberately not rounded away.

The beam now has canonical dimensions 2 × 0.2 × 0.1 m, rotated −90° about X,
with a 2 kN end load in −Y. Real Tet10 solve: mean tip Y displacement −1.59008 mm
against −1.6 mm beam theory (0.62% difference); Y reaction 1999.99999 N;
normalized equilibrium residual 4.96e−11. Mesh: 4,005 nodes / 2,028 elements.
Examples → Cantilever beam / Axial cube preserves the prior recovery copy and
starts clean example assignments.

Verification:

- All 51 applicable Chromium 152 browser harnesses passed under direct file access
  across the full run and focused rechecks. The two mocked application harnesses
  needed the new UI initializer added to their fixtures; both then passed.
  Unchanged CAD corpus/resource/validation matrices were not repeated.
- Real fillet tests validate generated BREP reimport, stable face identities,
  protected-edge rejection and original-result preservation. Study tests cover
  sequential worker disposal, WASM cap, declined high-memory confirmation,
  cancellation, stale inputs and malformed saved comparisons. Saved classifications
  are recomputed from numerical evidence.
- The six-solve workflow verifies previews, numerical summaries, normal report
  text, portable-project round-trip, reopen, cancellation and changed-load
  invalidation. A close/reopen event race was reproduced and fixed; its regression
  is exercised by the workflow.
- Real rounding CAD and the complete six-solve workflow also passed under isolated
  HTTP at 2× device scale. Beam/menu and workspace layout passed there too.
  Inspected the rounding dialog at 1440×1000, 850×600 and 640×600; no horizontal
  overflow. Saved radius/edge selection restore with the table. Keyboard Escape
  closes the dialog; focus restoration waits for the resized workspace layout.
- All 77 Python tests and 10 native CTest checks passed. Worker wrapper and example
  regeneration are reproducible; distribution hashes are refreshed using the
  audit tool. No vendored runtime or native solver changes.
- Reviewed the complete diff for state ownership, stale callbacks, numerical
  meaning, resource lifetimes, keyboard access, persistence and scope.

Evidence lives under ignored `build/`: `rounding-browser-full.log`,
`m29-file-rounding-workflow.json`, `rounding-http-evidence.json`,
`rounding-1440.png`, `rounding-850.png`, `rounding-640.png` and focused browser JSON records.

## Four-leg part follow-up

The owner supplied `tests/fixtures/cad-corpus/Part Studio 1 - Part 1.step`
(SHA-256 `741c23b27caa18417230b8efe64ea18560af1c9485b8bce19c87abbb9ef33431`),
with the bottom of each leg fixed and the large flat top loaded. The fixture is
used unchanged. The owner approved starting with inner corners.

Reproduction found 48 original CAD edges: 36 excluded by the five assigned faces,
8 eligible inner junction edges and 4 eligible outer underside edges. All twelve
failed together in OpenCASCADE even at the suggested radius, although each edge
worked alone and the eight inner edges worked together at half/base/double radius.
The previous default combined incompatible inner and outer fillets and its error
message did not explain a useful recovery.

Changes:

- Inspect solid occupancy around sharp edges to distinguish inner/outer corners;
  ambiguous classification remains manual. Default to inner corners. Explicit
  All eligible edges retains the user's full requested selection and reports
  kernel failure instead of silently dropping edges or altering the radius.
- Inner corners / All eligible edges / Clear presets, direct preview picking,
  exact-edge highlighting, selected/inner/outer/all list filters, and excluded
  counts grouped by reason. Blue selected edges remain visible through geometry;
  picking prioritizes visible edges and permits deselecting visible blue overlays.
  Dragging to orbit does not toggle an edge. Keyboard checkboxes remain available.
- Stable opaque edge IDs link CAD inspection to preview curve ranges, including
  oriented models. A rounded preview has its own identities; Edit edges on original
  returns to the source model before changing the selection.
- The real six-solve run exposed one inverted Tet10 element in the smallest-radius
  refined mesh. Gmsh's direct high-order optimizer stalled at a negative scaled
  Jacobian. Elastic smoothing followed by high-order optimization repaired the
  regression. This extra step applies to explicitly curvature-resolved meshes;
  all existing inversion/degeneracy gates remain hard failures.

The `rounding-part` regression checks all three fillets, unique mapping of all
five protected faces, refined curved Tet10 meshes, positive sampled Jacobians,
and protected boundary-node coordinates. `rounding-selection` exercises actual
app import/setup, presets, failure/recovery, direct picking, zoomed perspective,
drag suppression, keyboard highlighting and original-assignment preservation.

All 53 applicable browser harnesses passed across the full direct-file run and
focused checks. The new CAD and selection checks also passed under isolated HTTP
at 2× display scale. Python 77 and native CTest 10 passed. Unchanged full CAD
corpus/resource/validation matrices were not repeated. Evidence: ignored
`build/rounding-followup-browser.log`, focused browser JSON, and
`build/part-rounding-selection.png`.

The complete supplied-part radius comparison also finished under direct file
access with illustrative steel (E=200 GPa, nu=0.3, yield 250 MPa), 100 N total
force in −Z on the top, four fixed feet, and Tet10 maximum sizes 8 / 5.6 mm:

| Radius | Coarse / finer nodes | Finer max displacement | Finer raw peak stress | Peak mesh change |
| --- | ---: | ---: | ---: | ---: |
| 0.127001 mm | 84,614 / 155,284 | 0.818263 µm | 38.6083 MPa | 1.712% |
| 0.254002 mm | 46,520 / 86,755 | 0.815504 µm | 25.4391 MPa | 3.236% |
| 0.508004 mm | 26,754 / 49,336 | 0.808331 µm | 17.0955 MPa | 4.081% |

Displacement/energy changes were below 0.74%; all three one-step comparisons met
the screening thresholds. This demonstrates workflow completion and separates
mesh sensitivity from the substantial radius sensitivity; it does not establish
an actual manufacturing radius or independently validate this part's stresses.
Fine-case preflight estimates ranged from 332 to 811 MB. Evidence and screenshot:
`build/part-rounding-full.json`, `build/part-rounding-result.png`.

Inspected expanded edge selection at 1440×1000, 850×600 and 640×600: no horizontal
overflow, eight selected edges retained, Escape closes the dialog. Screenshots:
`build/part-rounding-1440.png`, `build/part-rounding-850.png`,
`build/part-rounding-640.png`. Reviewed the full change for opaque identity
mapping, CAD protection, selection/drag behavior, buffer reuse and cleanup,
worker sequencing, unchanged numerical gates and preservation of prior work.

## Stress-guided two-mesh workflow (2026-09-26)

The owner reported that the edge-selection workflow still did not work well and
requested automatic rounds near peak stresses. The primary flow now selects nearby
inner corners from original raw recovery samples, uses one visible assumed radius,
and runs exactly two meshes. Advanced controls retain radius override and manual
selection. Initial UI has no edge list or empty result table. Changes to assumed
radius/selection clear the displayed previous comparison. Original CAD/setup and
results remain authoritative; partial/cancelled operations do not publish a new
completed study. Legacy schema-1 three-radius reports remain readable.

Selection uses the native Tet4/Tet10 sample locations in world coordinates,
80% of the raw peak as a candidate threshold, and a local mesh/part-size distance
cap. This heuristic neither establishes a manufacturing radius nor identifies
every possible singularity. Protected nearest edges and unmatched hot samples
are disclosed; a distant available corner is never substituted. Bounding-box
pruning, fixed-size scratch buffers and cooperative yielding keep the matching
cancellable without duplicating bulk result data. No solver, CAD kernel, numerical
tolerance, dependency or generated worker changes were required in this pass.

Real supplied-part evidence (same illustrative steel/100 N setup as above): the
original solve automatically selected all eight inner leg-to-top edges. Of eight
samples in the high-stress band, four were nearest protected edges and are explicitly
reported as unchanged. The other four samples selected the eight junction edges.
At the suggested 0.254002 mm radius, coarse/fine meshes have 46,520 / 86,755 nodes
and 24,774 / 47,188 elements. Raw peak stress is 24.6416 / 25.4391 MPa; relative
changes are stress 3.2362%, displacement 0.7294%, energy 0.4539%. The result meets
the one-step screening thresholds for this assumed geometry, not a design verdict
or independent validation of the part's stresses. Evidence:
`build/part-hotspot-full.json`, `build/part-hotspot-result.png`.

New `rounding-hotspots` tests cover distinct hot regions, excluding cold/remote
corners, protected faces, Tet4/Tet10 sample mapping, rotation, zero stress, stale
results and cancellation. New `rounding-hotspot-workflow` exercises the actual
supplied CAD through original solve, automatic selection, two rounded meshes,
save/reopen, report export, cancelled preview and invalidation after a load edit.
It also checks collapsed advanced controls and no dialog overflow at 640 px.
Inspected the actual compact preview at 1440 and 640 px:
`build/part-hotspot-selection.png`, `build/part-hotspot-selection-640.png`.

Verification: all 55 applicable browser harnesses passed under direct file access
(54 in `build/hotspot-browser-suite.log`, plus the full supplied-part workflow).
Focused selection/workflow tests passed again after clearing stale assumption
results. The new hotspot unit and full part workflow plus advanced selection also
passed over isolated HTTP. Python unittest: 77 passed. Native CTest: 10 passed.
Distribution audit and whitespace checks passed. The user's STEP SHA-256 is still
`741c23b27caa18417230b8efe64ea18560af1c9485b8bce19c87abbb9ef33431`.
The unchanged full CAD-corpus/resource/validation benchmark matrices were not rerun.
Final review covered selection bounds/orientation, protected-edge disclosure,
fixed-radius execution, worker disposal, stale/cancel paths, compact metadata,
legacy report compatibility, keyboard access and preservation of prior changes.

## Removal verification (2026-09-26)

Removed the rounding UI, analysis modules, worker commands, interactive edge hook,
rounding-only curvature options, report integration, tests and generated notch
fixture. Rebuilt the bundled worker from source and refreshed the distribution
hashes. Ordinary meshing retains its established path. Current README/spec and
plan index no longer present rounding as supported. Historical project metadata
is inert and is not interpreted or exported as rounding results.

The corrected beam/Examples menu, mesh-check/Settings/result-guidance work, and
the owner's STEP fixture remain intact. Its SHA-256 is unchanged. Verification:
48 applicable browser harnesses passed under direct file access; worker-runtime,
mesh-check-workflow and usability-priorities also passed over HTTP. Python: 77
passed; native CTest: 10 passed. Distribution audit and whitespace checks passed.
Evidence: ignored `build/rounding-removal-browser.log` and focused HTTP JSON.
No full CAD-corpus/resource/validation benchmark matrix was rerun. Review found
no remaining rounding hooks in production source or bundled workers.

Next planned work is the remaining convergence-presentation/readability/browser
verification usability pass, then Plan 36 bearing loads. This withdrawal is not
acceptance of the discarded feature or authorization to publish a release.
