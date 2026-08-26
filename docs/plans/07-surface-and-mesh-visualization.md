# Task 7: Validate and render CAD and mesh surfaces

## Outcome

Render trustworthy curved STEP previews and make every generated mesh visibly
inspectable. Users can switch between a clean CAD Model view and a Mesh view
showing boundary-triangle wireframe or mesh lines over the shaded solid.

## Implementation

- Add generated curved STEP fixtures (at least a cylinder with planar caps and
  one multiply curved surface) with known bounds/volume and known CAD-face
  counts. Use them to tune scale-aware preview tessellation and verify winding,
  smooth normals within curved faces, and intentional hard edges between CAD
  faces. Keep the exact tessellation tolerance named and benchmark-adjustable.
- Extend the preview contract only as needed for renderer-ready normals and
  actual CAD feature-edge polylines. Do not use `EdgesGeometry` over the preview
  triangulation as a substitute for CAD edges, because that exposes incidental
  facets on curved surfaces.
- Build a mesh-display buffer from `VolumeMeshResult.nodePositionsM` and its
  boundary triangles. Deduplicate line segments with data-oriented storage,
  retain boundary-range `FaceId` mapping, and avoid rendering every interior
  Tet4 edge in the default view. Offer boundary wireframe and shaded-surface
  plus mesh-line styles.
- Add controller-owned viewport presentation state and an accessible mode/style
  control. Model is available after import; Mesh becomes available and active
  after meshing. A mode change is UI state only and must not invalidate the
  geometry, mesh, face selection, or later results.
- Keep picking and selected-face highlighting valid in both Model and Mesh
  modes. Dispose replaced GPU buffers/materials and avoid per-triangle objects
  or repeated full-mesh passes during a render.
- Keep import, renderer, and selection consumers dependent on `GeometryModel`,
  not STEP/Gmsh tags. Centralize source-format validation so a future STL or
  other adapter can produce the same downstream contracts. Do not implement
  STL analysis yet: first specify watertightness and stable surface-patch
  identity to replace CAD `FaceId`s.

## Verification

- Verify curved-fixture bounds/volume, chord deviation, triangle normals,
  feature-edge placement, face picking around the curve, and absence of false
  triangulation edges in Model mode at multiple model scales.
- For each mesh preset, verify the displayed boundary triangle/edge counts are
  derived from the mesh contract, Mesh mode activates after generation, both
  mesh styles render, and remeshing replaces rather than accumulates resources.
- Test mode switching, selection highlighting, resize/camera movement, context
  loss where practical, and both `file://` and HTTP workflows.

## Done when

Curved CAD looks smooth without hiding true CAD boundaries, every completed
mesh is immediately visible in the main viewport, and the visualization path
contains no STEP- or Gmsh-specific assumptions that block a later importer.
