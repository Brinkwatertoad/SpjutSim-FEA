# Material strengths, load units, and report export

Spec tracking: required — tracked in spec.md.

Goal: provide sourced polymer yield defaults, convenient SI/imperial load entry,
part-size verification, and an offline ZIP report of the solved analysis.

Architecture: retain SI analysis contracts; unit choices are browser preferences.
Results and reports share formatted summary rows. A report module owns text and
ZIP packaging, and the viewport owns clean scene captures. No runtime dependencies,
worker changes, worktrees, or backward compatibility paths.

Execute directly in the current agent on `feat/material-load-units-report`.

- [x] Material defaults: add field provenance and bulk-material limitations in
  `web/js/analysis/material-catalog.js` and `docs/material-strengths.md`; verify
  yield selection and catalog snapshot behavior, then commit.
- [x] Load entry and size: support MPa/Pa/psi/ksi and N/kN/lbf/kip with transactional
  conversion of pressure, normal magnitude, and all force components. Persist
  choices independently; reopening an SI load displays the selected units. Force
  is the initial load type. Show undeformed part bounding dimensions immediately
  before mesh/system rows in Results. Add browser regressions, then commit.
- [ ] Report: enable the existing Export action only for current solved results
  without pending edits or running operations. Download one ZIP containing UTF-8
  `report.txt` with parameters, Results/diagnostics and convergence rows (tab
  delimited), plus numbered PNGs: loads/supports, mesh, von Mises stress,
  optional yield FoS, and displacement with Auto shape. Each capture uses Reset
  View then Fit Model, excludes gizmo/UI chrome and selection/probe markers, and
  includes the appropriate result legend. Preserve the user's presentation and
  camera on success/failure. Use a dependency-free stored ZIP writer (PNGs are
  already compressed). Test ZIP interoperability and real headless captures.
- [ ] Run full Python/native suites and applicable browser harnesses; review the
  complete diff, update documentation/checklists, and commit the report feature.

Validation includes conversion round trips, signed forces, invalid/blank input,
reopening/saving loads, preference persistence, unavailable FoS, snapshot/restoration
on capture failure, ZIP CRC/readback, file:// loading, and solved numerical regression.
