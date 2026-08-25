# Task 5: Generate and extract a Tet4 mesh

## Outcome

Generate coarse/normal/fine/custom Tet4 meshes for the imported solid and return
a validated `VolumeMeshResult` that is independent of Gmsh. Boundary triangles
must retain their CAD `FaceId` mapping across remeshes.

## Implementation

- Define `MeshSettings` and `VolumeMeshResult` JSDoc contracts plus boundary
  validators. Use `Float64Array` for node positions and `Uint32Array` for
  connectivity; make boundary-face ranges and their `FaceId` mapping explicit.
- Implement presets from `spec.md` section 7.3 using the geometry bounding-box
  diagonal. Custom mode needs minimum and maximum size; keep `elementType` in
  the contract but accept only `tet4` in this milestone. Reject unsupported
  types and non-finite or inconsistent sizes before starting Gmsh.
- Add the worker `mesh` operation: restore/import geometry, configure sizing,
  generate 3D Tet4 elements, extract nodes with dense zero-based indices, and
  extract oriented boundary triangles grouped by the existing CAD `FaceId`s.
- Compute node/element/boundary counts, min/max characteristic size, the named
  Gmsh tetrahedral quality metric and distribution summary, inverted count, and
  near-zero-Jacobian count. Keep thresholds named and conservative; hard-fail
  inverted elements and report poor-but-valid quality as a warning.
- Transfer array buffers rather than cloning them. Validate lengths,
  connectivity bounds, supported element type, complete boundary mapping, and
  protocol version once at the receiving boundary.
- Store mesh metadata/buffers through controller commands. Mesh-setting or
  geometry changes invalidate mesh and results; remeshing must preserve face
  selections and terminate the mesher before later solver allocation.
- Add compact mesh controls and progress/cancel UI. Rendering the volume mesh is
  optional; retaining the CAD preview with a mesh summary is sufficient.

## Verification

- For the cube fixture, verify positive element volumes, in-range connectivity,
  boundary triangles on all six faces, expected total surface area within an
  explicit tolerance, and stable `FaceId` sets across all presets/remeshes.
- Test malformed settings, cancellation, Gmsh failure normalization, buffer
  transfer/ownership, and controller invalidation.
- Confirm finer presets increase resolution for the fixture without asserting
  exact Gmsh-dependent node counts. Run all suites and repeat the workflow from
  `file://` and HTTP.

## Done when

The cube can be repeatedly meshed into solver-ready Tet4 typed arrays, quality
and topology validation block unsafe output, and the main thread never depends
on Gmsh-specific tags or wrapper objects.
