# STL simulation surfaces

The owner authorized a reconstruction follow-up on 2026-09-11. The original
[M28 contract](stl-import-contract.md) remains the record of the initial decision.
This extension uses the existing Gmsh/OpenCASCADE runtime and native solver.

## User workflow

Choose explicit source units, a grouping angle, and one simulation surface:

- **Try surface reconstruction** (initial selection): merge coplanar regions or
  recover a complete cylinder/conical frustum with perpendicular flat ends.
  Specify a positive maximum deviation in source units. Review the candidate,
  reported deviation bound, dimensions and selectable surfaces. Switch the
  preview between original and reconstructed surfaces before applying.
- **Use original STL surface**: retain every source triangle and its coordinates.
  Each selectable patch becomes one indexed discrete surface. Existing boundary
  triangles remain fixed during volume meshing (`Mesh.MeshOnlyEmpty=1`), and
  quadratic boundary edges remain straight. Refinement cannot remove the input's
  small or poorly shaped surface facets.

The source bytes are retained in either mode. Changing units, grouping, mode or
reconstruction deviation invalidates the pending candidate. Installation and
assignment transfer remain explicit; failure, cancellation and stale completion
preserve the installed analysis. Comparing the two previews is display-only.
Reconstruction failure never silently selects the original surface.

## Implemented reconstruction boundary

`workers/stl-reconstruction.js` performs area-weighted plane/cylinder/cone fitting
on connected source patches. It normalizes the fitting equations by source scale,
finds candidate axes from normal covariance, and checks the entire source facets,
including circular sagitta between vertices. A successful fit alone is not a
successful reconstructed solid.

- Polyhedra: preserve shared boundary vertices/curves and inner wire loops while
  merging coplanar triangles. Only numerical nonplanarity (at most `1e-10` times
  model diagonal and one quarter of the selected deviation) is accepted. Moving
  approximate planar intersections is not supported. Redundant collinear boundary
  vertices can be removed within the numerical geometric bound.
- Cylinders and conical frusta: require one curved annulus and two planar disks,
  perpendicular ends, positive radius/height, monotonic single-turn circular rims,
  and positive radial projection of every curved facet. Build the actual OCC
  primitive, with separate stable source ownership for each end and side.
- A whole-solid check requires every source patch to own exactly one recovered
  surface and every shell curve to have two incident uses. Planar face replacement
  by OCC is matched by area centroid; ambiguous matches fail. Meshing uses the
  recovered geometry and curved Tet10 boundary nodes, followed by normal quality
  validation and native solver preflight.

The curved bound uses fixed-axial-coordinate radial projection. The fit's signed
normal-distance bound is multiplied by `sqrt(1+slope²)`; the projection checks
establish coverage of the annulus and disks. A `2e-10 * diagonal` numerical margin
is added. Polyhedral recovery includes a `1e-10 * diagonal` margin. A bound larger
than the selected tolerance rejects the reconstruction. This is a bound on the
recovered geometry; its display tessellation and finite-element approximation
have their own resolution errors.

This first implementation does **not** reconstruct arbitrary intersections of
fitted surfaces, fillets, spheres, freeform regions, partial cylindrical cutouts,
cones ending at an apex, or combinations of curved primitives. Those require
additional shared-intersection/trim construction and geometric validation.
Unsupported regions are reported with `STL_RECONSTRUCTION_UNSUPPORTED`; kernel
construction failures use `STL_RECONSTRUCTION_FAILED`. The supplied funnel can be
imported/meshed using its original surface, but its large complex regions are not
reconstructed by this implementation. Neither increasing the old classification
angle nor accepting a primitive fit without a valid solid is a fallback.

## Contracts and limits

The coarse worker protocol remains **3**: the extension is explicitly versioned
inside the existing optional STL contracts. Version-1 options/metadata retain the
legacy facet-preserving classification path and identities. New UI requests use:

```
{ version: 2, lengthUnit, patchAngleDegrees, normalization: 'none',
  surfaceMode: 'original' | 'reconstruct',
  reconstructionToleranceM: null | positive finite SI distance }
```

`null` is required for original-surface mode. Version-2 source metadata repeats
`surfaceMode`; `reconstruction` is null or a version-1 report containing the
selected tolerance, maximum deviation bound and source-ordered fitted surfaces.
Successful reconstruction includes `originalPreview` beside the candidate
`preview`; both have identical opaque patch IDs. The original preview remains in
source orientation and is used only by the import review. Source membership,
options version, mode and deviation are included in identity hashing. A fresh
meshing worker reparses/reconstructs from retained source bytes and verifies IDs.
Preview buffers transfer without cloning through the worker boundary.

The 16 MiB, 50,000-triangle, 512-surface, 2-million-intersection-candidate and
120-second operation bounds remain. Original-surface mode counts selectable
patches against the surface bound instead of requiring one geometric surface per
near-planar facet group. Input solid/topology/intersection validation is unchanged.
No welding, hole filling, winding reversal or general mesh repair is performed.

Browser mesh degeneracy now matches the existing native Tet4/Tet10 criterion:
`abs(det J) <= 1e-12 * longestCornerEdge³`. Tet10 uses the same four quadrature
locations. Nonpositive sampled Jacobians remain hard failures. A regular small
element is no longer rejected solely because another part of the model is large;
low gamma quality still produces a visible warning.

## Verification

`stl-reconstruction-tests.html` checks fitting and source-facet bounds.
`stl-surface-modes-tests.html` exercises real import/mesh workers, dense primitive
recovery, holes, curved nodes, source retention, identity, invalid metadata,
unsupported fits, and cancellation. `stl-workflow-tests.html` covers the actual
review UI. `mesh-quality-tests.html` checks element-relative degeneracy.

`stl-mesh-solve-tests.html?surfaceMode=reconstruct` applies the spec Section 16.2
1% axial displacement/stress and 0.1% analytical reaction targets to curved Tet10
meshes, and requires finer-cylinder meshing to reduce displacement/stress error.
The solver's equilibrium residual must still be below `1e-6`. Flat/faceted cases,
including `?surfaceMode=original`, retain the tighter existing constant-strain
checks. No native integration rule was changed.
