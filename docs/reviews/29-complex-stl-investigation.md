# Complex STL follow-up: supplied vented funnel

Date: 2026-09-11. Investigated against `811b668` on
`feat/28-29-stl-import`. **Experiments only; production behavior is unchanged.**

The supplied `tests/fixtures/stl/Better Vented Parametric Funnel.stl` has SHA-256
`80ebe627b1483cf5832bb78566654db0885133ef96d2f821d009435413ed8c68`.
The supplied file and its Windows metadata remain untouched and untracked;
this investigation does not add them to the CC0 fixture corpus.

## Findings

The 6,024,763-byte ASCII file contains 31,426 triangles and 15,711 exact-indexed
vertices. It passes the production manifold, winding, volume, and intersection
checks (308,946 candidate pairs). At the default 40° grouping it has **17 user
patches**, but the current 1e-8-radian geometric classification produces **29,623
near-planar regions**, exceeding the 512-region guard before Gmsh reconstruction.
The guard counts internal geometric surfaces, not selectable patches. Raising it
slightly or increasing the user grouping angle does not address this case.

Probe units were millimeters, explicitly chosen for the experiment, not inferred
by the application. Bounds are approximately 69.739 × 79.998 × 81.5 mm; enclosed
volume is 15,245.84095 mm³. The source also contains extremely short edges; the
preserved-boundary mesh has a minimum corner-edge length of 0.00004 mm.

## Tested alternatives

1. **Preserve the input surface triangulation.** Create one indexed discrete
   surface per existing user patch, construct a volume from those surfaces, and
   use `Mesh.MeshOnlyEmpty=1` before volume generation. Keep straight Tet10 edge
   nodes. This avoids reconstructing tens of thousands of parametric surfaces
   and preserves all 31,426 source boundary triangles and all 17 patch groups.
   With the pinned runtime it generates 50,964 Tet10 elements / 99,232 nodes in
   about 21 seconds including import, using 64 MiB mesher WASM capacity.

   The production browser rejects 161 elements under its current whole-model
   degeneracy threshold (`6e-12 * modelDiagonal³`). A diagnostic-only probe
   retained that rejected mesh to inspect it: all sampled Jacobians are positive,
   and the minimum determinant divided by each element's longest corner-edge
   length cubed is 4.549e-10. None fails the native Tet10 criterion of `1e-12`
   against that local scale. This identifies a browser/native criterion mismatch;
   it does not justify simply disabling the browser's check.

   Shape quality remains poor: minimum gamma 1.521e-9, fifth percentile 0.000805,
   14,738 elements below the existing 0.1 warning threshold, and maximum edge
   ratio about 65,269. Native memory/topology preflight on a synthetic supported,
   loaded setup estimates 548,938,770 bytes with its existing 1.5 safety factor.
   This is not a completed solve, convergence study, or validation of the funnel's
   structural performance. A production implementation must preserve quality
   warnings and solver failure/convergence checks.

2. **Relax geometric classification and remesh the surfaces.** Neighbor-region
   counts remain 23,694 at 0.1°, 13,140 at 1°, and fall to 65 at 5°. A 5° Gmsh
   reconstruction/import succeeds, but coarse volume meshing returns no Tet10
   elements for this funnel. This experiment did not establish a usable
   tolerance-controlled remeshing route. It would also require geometric-error
   bounds before enabling approximate surface changes.

The cube control succeeds on both routes. The preserved-surface route has only
12 Tet10 elements for its original 12 boundary triangles, demonstrating why
surface resolution cannot be implied by the existing mesh-size selector.

## Proposed next implementation

Add an explicit **Use original STL surface** meshing choice for complex files,
retaining the current surface-remeshing path. The UI must explain that the original
surface resolution remains fixed and mesh-size settings control interior sizing;
surface refinement requires a better source tessellation. No smoothing, welding,
decimation, or automatic repair is part of this choice.

Persist/version the choice with reconstruction settings, preserve opaque patch
identity and explicit assignment migration, retain source/work/timeout limits,
and validate patch ownership and boundary preservation after meshing. Correct the
browser/native degeneracy mismatch with scale-invariance, genuine sliver, inverted,
and mixed-scale regression cases; do not lower the native tolerance or suppress
gamma warnings. Exercise analytical solves, native preflight, cancellation,
fresh-worker reconstruction, and convergence limitations before delivery.

This changes meshing behavior and the documented numerical criterion. Repository
`AGENTS.md` requires asking before material behavior/architecture choices, so the
proposal awaits the owner's decision. No M29 acceptance is inferred.

## Reproduction in this workspace

Ignored diagnostic scripts are `build/inspect-funnel.cjs`,
`build/probe-funnel.cjs`, `build/inspect-funnel-mesh.cjs`,
`build/preflight-funnel.cjs`, and `build/remesh-funnel.cjs`. Their injected worker
variants live beside them; they leave shipped worker sources untouched. These
use the already installed operator Playwright/Chromium tools, not new application
dependencies. The diagnostic mesh inspector intentionally disables only the
browser rejection temporarily to measure the rejected mesh; never package that
override as an implementation.

Compact measured records are in `29-complex-stl-evidence.json`.
