# STL reconstruction follow-up

Authorized by the owner on 2026-09-11: preserve the source STL, reconstruct a
separate simulation surface within a user-selected geometric tolerance, starting
with planes, cylinders and cones. Keep original-surface meshing as an option.
Continue on `feat/28-29-stl-import`; do not redistribute the supplied funnel fixture.

1. Test and implement deterministic, area-aware primitive fitting and connected
   region boundaries. Verify rotated primitives, rejected fits, holes and seams.
2. Construct shared trimmed surfaces with the pinned Gmsh/OCC APIs; check a closed
   single solid, reconstruction error, feature preservation, and source ownership.
   Keep unsupported regions explicit; never infer successful recovery from a fit
   or volume agreement alone.
3. Version reconstruction options/metadata, preserve the original source, and add
   a tolerance/strategy review with original/reconstructed comparison and explicit
   application. Reconstruct identically in fresh workers and invalidate normally.
4. Retain an explicit original-surface path and align browser Jacobian validation
   with the existing native element-relative criterion, with regression evidence.
5. Exercise known analytical/reference shapes, source-error and topology guards,
   funnel import/mesh, cancellation, remeshing, file/HTTP packaging, and applicable
   complete suites. Update the spec, user instructions, and review evidence.

No new dependency or Gmsh/FEM runtime rebuild is authorized or planned. Surface
fitting is not general reverse engineering: uncertain regions and failed solid
construction must remain visible. M29 and release acceptance remain separate.

## Implementation outcome

The first recovery path is deliberately bounded to coplanar polyhedra and whole
cylinders/conical frusta with perpendicular flat ends. General trimmed periodic
surfaces did not pass the closed-solid/volume-mesh probe; accepting those fits
would be incorrect. Unsupported intersections and freeform regions return an
explicit reconstruction diagnostic. The funnel is supported through the separate
original-surface path, with its poor-element warning preserved.

Completed behavior and evidence are recorded in
[the follow-up review](../reviews/29-stl-simulation-surfaces.md). This does not
constitute M29 owner acceptance or final release/resource calibration.
