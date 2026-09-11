# M29 follow-up: STL simulation surfaces

Status: **Implemented; owner review pending.** The owner authorized this follow-up
on 2026-09-11. Work remains on `feat/28-29-stl-import`. This is not final M29 or
release acceptance.

## Delivered behavior

The import review offers **Try surface reconstruction** and **Use original STL
surface**. Reconstruction exposes a maximum deviation and an original/candidate
preview switch. Mode/deviation changes invalidate acceptance and enter the normal
explicit assignment-transfer workflow. Source bytes remain unchanged.

The first reconstruction path merges coplanar polyhedra, including through-holes,
and recovers full cylinders/conical frusta with perpendicular flat ends. It
checks complete facets, circular rims, projection orientation, shared shell
boundaries and source ownership. Redundant collinear boundary vertices are
removed within the numerical bound. Unsupported regions/intersections produce a
stable diagnostic; no approximate fit is silently promoted to a solid.

Original-surface meshing retains source triangles, uses one discrete surface per
selectable patch, and bypasses the old near-planar-region bottleneck. Browser
Jacobian validation now matches the native solver's element-relative tolerance;
low gamma quality remains visible. Native FEM and pinned Gmsh/OCCT binaries are
unchanged. See the [design and contract](../designs/stl-simulation-surfaces.md).

## Measured evidence

[Machine-readable evidence](29-stl-surface-evidence.json) records the Chromium
152.0.7977.75 checks, numerical results, source hashes and supplied-part outcome.

- All 79 Python and 8 native tests pass.
- All 36 distinct browser harnesses pass under `file://`: the 33 existing
  harnesses plus fitting, simulation-surface and element-relative quality tests.
  The existing resource matrix used the smoke profile.
- Both new surface modes pass analytical Tet10 solves; reconstructed cylinder
  refinement reduces displacement and stress error. The existing flat/faceted
  tolerances are retained; curved cases use the spec Section 16.2 targets.
- HTTP repeats pass for the surface-mode tests, real review UI, reconstructed
  numerical/refinement tests and original-surface numerical tests.
- The 68-case CAD/STL corpus agrees with expectations. Five validation and 36
  historical resource records validate; these are not new cross-browser release
  calibration measurements.
- Worker wrappers regenerate exactly; the distribution audit includes the new
  reconstruction source. Offline startup/review makes no remote requests or
  script errors. The dialog fits 1440×1000 and 760×700; the narrow layout scrolls
  to its controls without horizontal overflow.

Representative coarse Tet10 results:

| Source | Source triangles | Recovered surfaces | Volume elements |
| --- | ---: | ---: | ---: |
| Cube | 12 | 6 | 3,509 |
| Subdivided cube | 3,072 | 6 | 3,530 |
| Cylinder | 4,096 | 3 | 2,761 |
| Rotated conical frustum | 128 | 3 | 1,144 |
| Square tube with through-hole | 32 | 10 | 2,109 |

Without removal of redundant straight boundary vertices, the subdivided cube
produced 148,541 elements. The regression verifies that source surface density
no longer forces that excess volume-mesh density.

For the recovered 32-segment cylinder, coarse-to-fine displacement error falls
from approximately **0.00943% to 0.000565%**, and raw stress error from **0.253% to
0.0324%**. Both levels meet the 1% axial target. These are curved finite-element
approximation errors, distinct from the recovered-geometry deviation bound.

## Supplied funnel

`Better Vented Parametric Funnel.stl` remains an untouched, untracked user fixture;
it is not added to the CC0 corpus or distributed. The reproduction explicitly
assumed **millimeters**, used 40° grouping and coarse Tet10 meshing, and used a
fresh worker for meshing after import.

- Original-surface import: approximately **1.4 seconds**, 17 selectable patches.
- Import plus fresh-worker meshing: approximately **21.7 seconds**.
- All **31,426 source boundary triangles** retained; **50,964 Tet10 elements** and
  **99,232 nodes**.
- No inverted or element-relative degenerate sampled Jacobians.
- **14,738 low-gamma elements**; minimum gamma approximately `1.52e-9` and minimum
  corner-edge length `4e-8 m`. The warning remains; a generated mesh is not proof
  of an accurate or well-conditioned structural solution.
- At a **0.01 mm** reconstruction deviation, **4 of 17 patches** are unsupported.
  The production worker reports `STL_RECONSTRUCTION_UNSUPPORTED` and explicitly
  offers original-surface mode. No full funnel reconstruction or structural solve
  is claimed.

## Owner review

Import a familiar part with explicit units. Try reconstruction, inspect the
reported deviation, compare source/candidate and select faces. Change the
threshold and confirm that a new review is required. On the supplied funnel,
select **Keep STL triangles (no simplification)**, review its dimensions and generate a mesh;
inspect the quality warning before proceeding with an analysis. Cancel a repeat
review to check that the installed setup is retained.

General freeform reconstruction and intersections between multiple curved
primitives remain future work. Input validation/storage/work limits and the
solver's existing memory preflight continue to apply.

The [subsequent funnel solve investigation](29-funnel-solve.md) records the
nonconvergence, corrected progress and finite solve budgets. Import/mesh success
does not establish that this funnel can currently produce a valid FEA result.
