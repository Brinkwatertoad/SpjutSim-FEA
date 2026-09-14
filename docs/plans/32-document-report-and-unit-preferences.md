# Document reports and preferred units

Spec tracking: required

## Design

- Export a native DOCX containing editable parameter/results tables and the existing clean, reset-and-fit PNG captures. Keep the text/PNG ZIP option. Generate Office Open XML and package it with our stored ZIP writer; add no dependencies or runtime downloads.
- Give Settings a preferred 840 × 720 px size, capped to the viewport, with internally scrolling tab panels. This follows the Truss Settings size; preserve FEA's UI Foundation reference pin.
- Add browser-local SI/USCS presets and named custom unit sets. SI retains existing displays. USCS uses ksi material properties, psi pressures/stresses, inches for dimensions, and lbf forces. Changing units converts entered values and never changes solver SI data, invalidates a solve, or changes imported-file interpretation.
- Custom sets follow SpjutMath: Save creates a copy, editing the name saves or renames a set, edits update an active saved set, and Delete keeps the current values as Custom. Names must be unique. Inline force/pressure and result units update the same preference owner.
- Reference: SpjutMath milestone-4-visualization-data `3733a6027f722f602e3102bc5f650cad3d1b215f`, `src/ui/unit-presets.js`. Follow its preset lifecycle and editable name field; unit data and browser persistence remain FEA-owned.

## Work

- [x] DOCX packaging, report format control, shared report content and package validation.
- [x] Central unit definitions, persisted presets/custom sets, fixed Settings size.
- [x] Convert authoring fields and all engineering displays; retain explicit source-file units.
- [x] Browser integration and regression coverage, full applicable suites, final diff review.
Delivery: commit coherent chunks and push `feat/material-load-units-report` (no merge/deploy).

Verification and final review: [Plan 32 review](../reviews/32-document-report-and-unit-preferences.md).
