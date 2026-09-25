# Setup controls follow-up verification

Implemented on `feature/35-local-directions-and-supports`, 2026-09-25.
Scope: [owner-requested controls follow-up](../plans/35-setup-controls-followup.md).

- Closing or switching immediate assignment editors clears their selected faces.
  Deliberate selections outside an editor still seed a new assignment. Legacy
  transactional controller cancellation retains its original behavior.
- Compact rows have direct Duplicate, Include/Suppress, and Delete actions.
  Duplicate opens an empty face set with a visible picking prompt; first pick
  creates the copy, further picks edit it, and Escape before picking creates
  nothing. CAD frames attach to the new face without changing the original.
  Suppression immediately changes the eye, row styling, and visible status.
- Material Save and Edit in library icons sit beside the selector. Save updates
  a selected user entry after inline edits; built-ins become uniquely named custom
  copies. Edit opens the full selected record. The library uses FEA danger/accent
  styling and Truss footer ordering. Its shared Truss component remains unchanged.
- Information controls sit beside field headings and reveal combined details
  directly below. Material values and property sources survive display-unit
  changes; actually edited properties lose their inherited source citation.

Verification:

- All 46 browser suites passed under Chromium 151.0.7922.34, direct `file://` with
  local-file access, including real CAD, solver, project/recovery, report, and
  layout workflows.
- Immediate setup, material library, and local support UI also passed over
  cross-origin-isolated HTTP at 2× device scale.
- All 77 Python tests passed. Distribution audit and `git diff --check` passed.
- Inspected material controls, full library/footer, suppression, duplicate prompt,
  and the 760px-high layout. Screenshots and diagnostic results are in ignored
  `build/controls-*` files; browser test entrypoints are documented in README.
- Reviewed the complete diff for selection ownership, Undo identity, CAD frame
  rebinding, validation, source preservation, accessibility, dependency boundaries,
  unnecessary work, and memory retention. No numerical kernels, worker protocols,
  generated/vendor assets, or large-buffer ownership changed.
