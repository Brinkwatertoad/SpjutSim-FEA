# Task 8: Author material, supports, and loads

## Outcome

Let the user define a validated isotropic material and attach fixed/prescribed
supports, pressure, total force, and gravity to the imported solid using CAD
face selections. The analysis document becomes sufficient to prepare a Tet4
solver request.

## Implementation

- Define and validate the `IsotropicMaterial`, boundary-condition, load, and
  gravity contracts from `spec.md`, keeping SI values authoritative and unit
  conversions at the UI boundary. Require density only when gravity is active
  and distinguish hard errors from unusual-but-valid material warnings.
- Add controller commands to create, edit, select, and remove named analysis
  items from the current face selection. Reject empty/unknown faces,
  non-finite values, incomplete prescribed displacements, and invalid vectors;
  keep face selections stable across remeshes.
- Build semantic Material, Supports, and Loads tools using the checked-in UI
  helpers and native form controls. Show units beside inputs, make validation
  actionable, and let selecting an existing item highlight its CAD faces.
- Render fixed-support, prescribed-displacement, pressure, force, and gravity
  glyphs in a separate viewport overlay. Derive glyph placement/normals from
  mapped boundary surfaces, keep visual scale separate from numeric magnitude,
  and obtain semantic colors from theme tokens.
- Implement explicit invalidation: editing material, supports, loads, or gravity
  invalidates results but not geometry/mesh; editing geometry clears dependent
  items. Changes never trigger an implicit remesh or solve.
- Prepare a mesher-independent solver-input projection that maps `FaceId`
  ranges to boundary triangles/nodes and retains enough surface integration
  data for consistent pressure and total-force assembly. Do not divide a total
  force by boundary-node count.

## Verification

- Unit-test contract boundaries, SI/display conversions, every controller
  command, duplicate/unknown faces, gravity-density rules, and invalidation.
- On the cube fixture, verify face highlight round trips, boundary-node mapping,
  pressure direction, integrated total force, and glyph orientation on all six
  faces across remeshes.
- Test keyboard-only authoring, help text, errors, theme changes, direct-local
  startup, and repeated item edits without leaked Three.js resources.

## Done when

A user can fully describe the cube axial-load benchmark through the UI, the
document holds validated SI data keyed by CAD faces, and the exact data needed
for load integration and constraints can be sent to a solver without Gmsh.
