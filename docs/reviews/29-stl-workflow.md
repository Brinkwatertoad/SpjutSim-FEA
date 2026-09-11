# M29: STL import through analysis

Status: **Implemented; owner review pending.** M28 was accepted on 2026-09-11
(“yes, accept.”). This packet covers plan 29 on `feat/28-29-stl-import`.
Plan 30 and release acceptance have not started.

## Delivered behavior

Import binary or ASCII STL, choose explicit length units, review dimensions and
selectable patches, then accept the model. The adapter validates a single closed,
connected, outward-wound manifold solid, including vertex links and intersections.
Defects produce stable, actionable errors without repair, welding, or reversal.
Stored normals are advisory; triangle winding defines the surface.

Connected angle-based grouping defaults to 40°. Patch identity derives from
original bytes/options and triangle membership. Fresh-worker reconstruction,
remeshing, and rigid orientation preserve identity. Changing units/grouping opens
the existing explicit assignment-transfer workflow. Failed/cancelled/stale review
preserves the installed model and analysis. CAD↔STL transfer supports mapping and
dropping assignments, and clears engineering history on installation.

Tet10 retains straight source facets, six-node integration faces, separate display
triangles, and positive-Jacobian checks. Component forces, normal forces, pressure,
supports, preflight, result views, FoS/peak, and convergence consume the shared
analysis contracts. The native solver and pinned Gmsh/WASM binaries are unchanged.
The coarse worker protocol is 3; the local-runtime builder bundles the STL helper.

## Automated evidence

See [machine-readable evidence](29-stl-evidence.json), the
[68-case corpus report](../../benchmarks/cad-corpus/chromium-152-stl.json), and
the [accepted contract](../designs/stl-import-contract.md).

- 79 Python tests and all 8 native tests pass.
- All 33 browser harnesses pass in Chromium 152.0.7977.75 under direct `file://`;
  the resource matrix uses its smoke profile for this change.
- HTTP repeats pass for STL review, mesh/solve, convergence, and resource smoke.
- All 68 corpus classifications agree: original 50 CAD expectations plus six
  accepted and twelve rejected STL fixtures. Existing quality warnings remain.
- Five validation records, 36 historical resource records, fixture hashes, and
  distribution artifacts validate. Historical records are audited, not represented
  as newly rerun release calibration.
- The 18 STL fixtures/manifest and both worker wrappers regenerate byte for byte.
- Real-app offline startup/import produces no remote requests or script errors.
  The review was visually checked at 1440×1000 and 760×700, with no horizontal
  overflow; the narrow dialog scrolls to its footer. Keyboard patch buttons and
  native dialog focus/Escape complement viewport picking.

The corpus harness reloads after 24 cases, retaining a manifest-checked session
checkpoint. Chromium deferred collection of terminated worker objects during an
uninterrupted 68-case run. Forced GC established the cause; document batches then
passed without a GC flag. Every fixture still receives a fresh worker, and no
classification, mesh-quality, or identity expectation was relaxed.

### Numerical checks

The 1 m cube uses E=1 GPa, ν=0.25, component symmetry supports, and 1000 N axial
force. Computed loaded-face displacement is approximately 1.0000000023e-6 m,
raw von Mises stress 1000.000009 Pa, and relative equilibrium residual 2.1e-10.
The analytical targets are 1e-6 m and 1000 Pa. Displacement/stress relative
tolerances are 2e-5/2e-4 (absolute floors 1e-11 m/1e-3 Pa), with equilibrium
below 1e-6. Recovery-sample peak location and yield FoS=250,000 are verified.

The radius-0.5 m, height-1 m faceted cylinders use E=1 GPa, ν=0, a fixed base,
and 1000 N tensile loading. Their reference displacement is F·L/(E·A), where A
is the **faceted** cross-section. Cases use component force, normal force, and
pressure respectively; stress F/A and reaction −1000 N pass the same checks.

| Sides | Faceted area (m²) | Displacement (m) | Source area deficit vs circle |
| --- | --- | --- | --- |
| 16 | 0.7653668363 | 1.306563016e-6 | 2.55047% |
| 32 | 0.7803612594 | 1.281457773e-6 | 0.641319% |
| 64 | 0.7841371104 | 1.275287179e-6 | 0.160562% |

This separates source tessellation error from FE mesh convergence. A separate
two-level cube study uses 1,154 and 2,390 Tet10 elements; displacement, energy,
and raw stress satisfy the existing convergence criteria. Rotating then undoing
the STL invalidates mesh/results, and source-digest mismatch rejects remeshing
under old patch identities.

### Bounds and resource checks

The accepted bounds remain 16 MiB source, 50,000 triangles, 512 internal surfaces,
2,000,000 intersection candidates, and 120 seconds per STL operation. Separate
generated cases exercise exact storage/surface bounds; excess byte/triangle,
surface, and intersection-work cases return the specified limit errors.

A 50,000-triangle cube imports in approximately seven seconds, preserving six
patches and all triangles; the validator examines 432,507 candidate pairs. The
source is 2,500,084 bytes, preview buffers 6,606,192 bytes, and measured import
WASM capacity 64 MiB. Fresh-worker coarse Tet10 reconstruction produces 3,756
elements/6,333 nodes with positive sampled Jacobians and 395,832 mesh-buffer bytes.
Timings and exact sampled values are in the evidence JSON.

Cancelling during validation terminates the worker; a fresh import and mesh
succeed. The timeout termination/error path is tested using a simulated 100 ms
deadline, while the production deadline remains 120 seconds. The existing solver
memory preflight remains mandatory. WASM capacity is a high-water allocation,
not live native memory or browser RSS; JS maps, strings, Blob code, and garbage
collection add unmeasured transient memory. These are bounded development tests,
not a new full cross-browser release resource calibration.

## Owner walkthrough — about 20 minutes

Open `web/index.html` directly, or run `python3 tools/serve.py` and open `/web/`.
Use files in `tests/fixtures/stl/`.

1. Import `cube-binary.stl`. Confirm units start blank. Choose meters, review the
   1×1×1 m dimensions and six patches, pick using the canvas and patch buttons,
   then accept. Repeat with `cube-ascii.stl`; try millimeters and check the SI
   dimension conversion before cancelling.
2. Apply a material, supports, and a force or pressure using patch selection.
   Mesh with Tet10, run checks, solve, and inspect Stress, Deformation, FoS,
   and Locate peak. The automated analytical harness supplies the quantitative
   reference; an arbitrary manual setup need not reproduce the axial case.
3. Import `cylinder-32.stl`, inspect its faceted side patch, and change grouping.
   For an installed model, use **Review STL units and patches…** in Model.
   Verify that applying new grouping requires mapping/dropping existing assignments;
   Cancel must retain the previous model/setup/result.
4. Try `open.stl`, `self-intersecting.stl`, and `pinched-vertex.stl`. Check that
   each failure explains re-export/correction, preserves the old model, and offers
   no automatic repair. Cancel a review while validation is running and retry.
5. Remesh, rotate/undo, and replace STL with CAD and back. Inspect explicit
   assignment transfer and the cleared history after replacement. Run a small
   convergence study if desired.

Owner response: **not yet received**. Record the actual M29 response here before
starting plan 30. Automated results do not constitute owner or v1 acceptance.
