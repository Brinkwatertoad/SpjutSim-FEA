# Material, load-unit, and report verification

Implementation complete on `feat/material-load-units-report`. This records
engineering verification; it does not claim owner acceptance of M29/M30 or v1.

- `ac917a4`: sourced bulk polymer yields, field provenance and limitations.
- `9e4d6e3`: inline SI/imperial load conversions and original part dimensions.
- Final feature commit: ZIP report and clean scene captures, integration tests,
  documentation, and consistent inactive pressure defaults when editing a force.

## Final automated evidence

| Check | Passed | Total runtime |
| --- | --- | --- |
| `python3 -m unittest discover -s tests` | 79/79 | 2.182 s |
| Native CMake build + CTest (CTest time) | 8/8 | 0.38 s |
| Chromium direct-file applicable browser harnesses | 29/29 | 58.275 s |
| Chromium 2× DPI report/workspace harnesses | 2/2 | 19.584 s |

Combined suite runtime: 80.421 s, excluding compilation and investigative runs.
Browser harnesses use the existing repository-local Playwright tooling with
headless Chrome for Testing 151.0.7922.34 and `--allow-file-access-from-files --enable-unsafe-swiftshader`.

Main browser coverage: report-workflow, report, load-entry, load-unit,
material-strength, analysis-authoring, assignment-draft, engineering-history,
result-formatting, result-presentation, result-range, review-contract,
solve-checks-ui, solve-workflow, viewport-navigation, workspace-layout,
factor-of-safety, convergence, convergence-runner, worker-runtime,
wasm-solve-result, cube-wasm-vertical-slice, cube-convergence, grouped-authoring,
step-import, tet4-mesh, tet10-mesh, preview-selection and stl-mesh-solve.

System Python had no Playwright module; the existing Node verification tooling
was used. The first CMake invocation failed on missing `libarchive.so.13`.
Configuration/build/CTest succeeded with the repository-local CMake binaries and
`LD_LIBRARY_PATH="$PWD/build/cmake-local/usr/lib/x86_64-linux-gnu"`.
No application dependency or worker artifact changed.

The initial broad run caught outdated Export placeholder/stub expectations in
two harnesses; these now follow the real enabled-export behavior. A visual check
caught a linear/sRGB legend mismatch. A pixel regression failed before the color
conversion fix and passed afterward. Final suites include those corrections.

## Report and UI checks

- Real STEP cube imported, constrained, meshed and solved using PLA.
- Normal force and signed component values survive N/kN/lbf conversion and saved
  load editing; pressure survives MPa/Pa/psi/ksi conversions and reopening.
- Blank numeric fields remain blank; invalid conversions preserve the prior
  values/preference. Browser preferences reload without changing SI data.
- Original dimensions follow result length units and use undeformed geometry.
- Five distinct scene images, optional four-image path without FoS, exact shared
  Results/diagnostics text, material provenance, Auto shape and download checked.
- Camera pose/roll, selection, probe, overlay/presentation and animation phase
  restored after each capture and an injected failure. Changed analysis revisions
  abort the export instead of downloading a stale report.
- PNGs visually inspected: model/overlays only, no UI/gizmo/grid, readable legend;
  legend colors checked against the viewport's sRGB palette.
- Three produced archives independently opened with Python `zipfile`: 3/3 passed
  file-count, every-entry CRC, UTF-8/tabular text and PNG signature/dimension checks.
- Full diff reviewed for contract ownership, stale data, conversion precision,
  resource restoration, accessibility and new dependencies. `git diff --check` passed.

Reproducible harnesses are checked in under `tests/browser/`. Local execution
logs and sample artifacts remain ignored under `build/plan31-*`, including a real
downloaded ZIP. No source file outside SpjutSim-FEA was changed.

## Deliberate limits

New material strengths are editable bulk reference values from different test
conditions, not certified printed-part allowables. Existing fields retain their
sources. See [material evidence](../material-strengths.md).
Images use the current viewport resolution and projection, reset/fitted camera,
automatic result limits and Auto deformation. ZIP contains text and PNG; PDF and
editable project-file serialization are deferred as requested.
