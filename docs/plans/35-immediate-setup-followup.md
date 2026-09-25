# Immediate setup and material library follow-up

Approved scope: immediate validated setup edits with meaningful Undo, compact-row
removal, rotation-based rectangular frames, optional information disclosures,
and a material library closely following SpjutSim Truss.

- [ ] Add controller support for continuing an immediately committed assignment;
  keep incomplete text local, preserve identity and suppression, allow Undo while
  editing, and permit solve/save when an editor has no pending changes.
- [ ] Wire setup changes to commit on change/Enter, keep editors open, remove
  Apply/Cancel, and put removal on compact rows. Test invalid inputs, face picking,
  no-op edits, component forces, Undo/Redo, and result invalidation.
- [ ] Replace axis triples with global-axis incremental rotations, ±90° and Reset,
  an SVG axis preview, and information disclosures for assignment details.
- [ ] Reuse the Truss engineering-library UI with an FEA adapter: searchable table,
  selection, Use/Add/Copy/Edit/Delete, full optional fields, sources and notes.
  Preserve provenance on copies and edits; document shared field mappings and
  FEA-only requirements without claiming cross-app import is implemented.
- [ ] Update product docs, migrate UI tests, run applicable complete suites and
  direct-file workflows, visually inspect the UI, review the full diff, commit.

Implementation stays in the current agent and feature branch. Browser code remains
classic dependency-free JavaScript. Native numerical kernels are unchanged.
