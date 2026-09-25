# Immediate setup follow-up verification

Implemented on `feature/35-local-directions-and-supports`, 2026-09-24.
The approved scope is recorded in [the follow-up plan](../plans/35-immediate-setup-followup.md).

## Result

- Material choices, assignment presets, face changes, and validated field edits
  commit immediately. Numeric/text input commits on Enter or blur. Enter followed
  by blur is one history entry; incomplete input retains the committed definition.
- Editors stay open after changes. Opening alone creates no assignment. Escape or
  row collapse discards only pending text. Undo closes the editor and restores the
  previous definition, including frame changes. Clean editors permit Save/Solve.
- Compact rows expose removal without expansion. Mesh removal retains one existing
  mesh by reference for Undo; a new mesh operation or incompatible settings/model
  releases it. No numerical buffers are copied and no solved result is restored.
- Rectangular frames use global-axis rotations, ±90°, Reset, and separate labeled
  global/local axis previews. Existing arbitrary bases reopen without conversion
  to Euler angles. Origin stays under a disclosure.
- Face area/count and direction explanations are available through information
  disclosures. Validation errors remain visible and keyboard accessible.
- The library uses the unchanged Truss shared UI with an FEA adapter and ported
  layout. Full records include optional properties, provenance and notes. Copy,
  edit and storage reload preserve metadata; modifying a value removes its old
  property citation. Unchanged values preserve exact SI data in USCS displays.
  [Library provenance and future cross-app mapping](../material-library.md).

## Checks

Chromium 151.0.7922.34, direct `file://`, local-file access enabled:

- All **46 browser suites passed** in the complete final run, including the new
  `immediate-setup` and `material-library` suites. Existing numerical Tet4/Tet10,
  local support, report, project/recovery, worker and layout workflows passed.
- **77 Python tests passed** (`python3 -m unittest discover -s tests`).
- HTTP with cross-origin isolation and 2× device scale: immediate setup, material
  library, and local support UI all passed.
- `python3 tools/audit-distribution.py` and `git diff --check` passed.
- Visually inspected the full material-record dialog and rotated frame editor,
  including the setup pane at a 760px viewport. Separated the global/local triads
  to prevent overlapping labels. The full diff was reviewed for invalidation,
  history identity, memory retention, visibility, accessibility, and provenance.

Reproducible browser entrypoints are listed in README. Local diagnostic logs and
screenshots are in ignored `build/immediate-*` files. No native numerical kernels,
worker protocols, solver WASM, mesher artifacts, or third-party binaries changed.
Cross-app material import remains future work; no compatibility is claimed for
loading a Truss library file directly into FEA.

Owner acceptance of the revised interface remains pending.
