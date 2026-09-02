# Task 11: Complete priority release features

## Outcome

Deliver the approved priority release work described in
`docs/superpowers/specs/2026-09-01-priority-release-features-design.md`, led by a
compact setup inspector that keeps model/material, supports, and simple loads
visible and directly editable without searching through scattered sections.

## Delivery order

1. Compact setup inspector and unified in-place authoring.
2. STEP/IGES/BREP import and model orientation.
3. Component-based X/Y/Z supports and six-mode rigid-body diagnostics.
4. Distributed surface-contacting glyphs and a corner XYZ triad.
5. Truss-compatible deformation animation.
6. Transactional replacement-model setup transfer.
7. UI Kit-compatible factory/imported color schemes.
8. Complete release regression and direct-local verification.

Each package must leave the application usable and independently testable. The
first package's executable plan is
`docs/superpowers/plans/2026-09-01-compact-setup-inspector.md`. Later packages
receive separate executable plans because they modify independent contracts and
have distinct numerical/browser acceptance evidence.

## Progress

- Complete: compact setup inspector and unified in-place authoring.
- Complete: STEP/IGES/BREP import and model orientation.
- Complete: component-based X/Y/Z supports and six-mode rigid-body diagnostics.
- Complete: distributed surface-contacting glyphs and a corner XYZ triad.
- Complete: Truss-compatible deformation animation.
- Complete: single-hierarchy Setup pane with Model-owned CAD import.
- Complete: transactional replacement-model setup transfer.
- Complete: UI Kit-compatible factory/imported color schemes.
- Complete: release regression and direct-local verification.

## Constraints

- Preserve the dependency-free plain-JavaScript and direct `file://` runtime.
- Keep worker lifecycle, transferable bulk data, and solver/mesher boundaries.
- Use test-driven development for nontrivial behavior.
- Do not add alpha-contract backward compatibility.
- Update `spec.md`, README instructions, checked-in generated wrappers, and
  regression fixtures with the package that requires each change.

## Done when

All acceptance additions in the approved design are verified, the existing v1
numerical behavior remains intact, and the complete applicable Python, C++,
browser, Gmsh, WASM, and direct-local suites pass.
