# Convergence clarity and repeatable browser verification

Status: Implemented and automatically verified, 2026-09-26. Owner walkthrough
pending; this is not release acceptance. Rounding remains removed.

Changes:

- Three separate zero-based charts show displacement, raw peak von Mises and
  strain energy in preferred units against actual mesh DOF. Point tooltips and
  accessible descriptions identify per-mesh values. Last-refinement percentage
  changes and recorded thresholds appear beside each quantity.
- One mesh, zero baselines, identical values/DOFs and incomplete studies have
  explicit presentation. Global stability never conceals unresolved peak stress;
  peak-based FoS guidance remains separate from design acceptance. Numerical
  classification, screening tolerances and result retention are unchanged.
- Mesh/resource rows remain available under expandable details. Extracted
  convergence status/chart presentation from the general UI controller into
  `web/js/ui/convergence-view.js`; no broader refactor or dependency changes.
- `tools/run-browser-tests.cjs` reuses an existing Playwright/Chromium installation,
  runs named harnesses or the application suite, records browser/mode/DPI and
  available numerical evidence, and fails on harness failures or uncaught errors.
  README documents paths, HTTP mode, 2× DPI, output and benchmark exclusions.
  This is optional test tooling, not application build/runtime tooling.

Supplied-part workflow uses unchanged `Part Studio 1 - Part 1.step`, four fixed
feet, 100 N in −Z on the top, illustrative E=200 GPa, nu=0.3, yield=250 MPa, and
Tet10 meshes. It performs an original solve followed by two quick checks:

| Target size | DOF | Max displacement | Raw peak von Mises |
| --- | ---: | ---: | ---: |
| 8 mm | 4,377 | 0.772014 µm | 4.15596 MPa |
| 5.6 mm | 7,755 | 0.790551 µm | 4.62559 MPa |
| 3.92 mm | 13,368 | 0.797001 µm | 5.59529 MPa |

The last comparison changes displacement by 0.8159%, strain energy by 0.9872%
and peak stress by 20.9637%. The UI reports the first two within their 2%
thresholds and stress outside 5%; it does not claim a mathematical singularity
or design acceptance. Force-balance residuals satisfy the 1e-6 workflow check.
The test asserts unchanged CAD, supports, loads and engineering revision during
refinement. This is workflow/numerical-consistency evidence, not independent
stress validation or a manufacturing/design assessment of the part.

Verification:

- All 50 application browser harnesses passed under direct file access using the
  checked-in runner. Focused presentation checks passed again after visual fixes.
- Convergence-view, supplied-part workflow and ordinary mesh-check workflow passed
  over isolated HTTP at 2× device scale.
- Python: 77 passed. Distribution audit and whitespace checks passed.
- Reviewed the full touched presentation/runner integration for unit conversion,
  zero handling, incomplete-study wording, script order, accessibility, memory and
  preservation of unrelated work. Numerical/native/worker code was not changed.
- Inspected the actual part's measured values in 300 px-wide charts; fixed a long
  energy-axis label clipping at the left margin and removed repeated axis help.
- Unchanged CAD-corpus/resource/validation benchmark matrices were not rerun.

Ignored evidence: `build/convergence-browser-suite.json`,
`build/convergence-part-evidence.json`, `build/convergence-http-evidence.json`,
`build/convergence-charts.png`.

Owner walkthrough: solve the supplied part with the fixture setup, choose Check
with a finer mesh twice, then Review convergence. Confirm that the displacement
and stress conclusions are independently understandable; expand Mesh values and
resource details for the full table. Advanced numerical limits remain separate
from the design's required movement and FoS.

The owner-directed usability follow-up is implemented. Next numbered development
work is Plan 36 bearing loads, followed by 37 moments/offset forces and 38 integrated
pre-release review. No release or publication action is authorized by these tests.


## Follow-up: include peak stress in the stopping rule

The owner requested the full study continue for stress-based strength assessment.
Early convergence now requires both global response (displacement and energy)
and raw peak von Mises stability. The global/stress classifications remain separate;
thresholds remain 2% / 2% / 5%. Unresolved stress continues up to four meshes,
subject to the existing resource/failure/cancel stops. The two-mesh quick check
still solves only one additional mesh. A full stress-unresolved study now states
that its mesh limit was reached and its strength assessment remains unresolved.
A cancellation at a completed level takes priority over an early-convergence exit.
No FoS labels, failure criteria, solver kernels or material definitions changed.

Regression tests cover stress stabilizing on the third mesh, continuing rising
stress to the fourth mesh, the unchanged quick-check bound, memory blocking,
and cancellation both during unresolved stress and on a newly stable level.
The browser runner also now recognizes the legacy data-result failure signal,
so a failed harness with an unprefixed status does not wait for a timeout.

The unchanged supplied-part workflow now exercises both repeated quick checks
and a full study. With the same fixture setup above, the fourth target size is
2.744 mm (10,867 nodes); displacement is 0.812164 µm and raw peak stress 6.66804 MPa.
Last-step changes: displacement 1.9026%, energy 1.9427%, stress 19.1724%.
The first two satisfy their thresholds but stress does not. The real app and report
state: “Converged globally; stress unresolved — the 4-level limit was reached.
Strength assessment remains unresolved.” CAD and assignments remain unchanged.
This verifies continued refinement and honest termination; it does not independently
validate the stress result or establish a mathematical singularity.

Evidence: `build/stress-stop-red.json`, `build/stress-status-red.json`,
`build/stress-stop-focused.json`, `build/stress-stop-part.json` and
`build/stress-stop-suite.json`. The first two record the failing regressions before
implementation. The roadmap remains unchanged: buckling, fatigue and fracture
have no scheduled dedicated plans; feasibility discussion did not add new scope.

Follow-up verification: all 50 application browser harnesses and 77 Python tests
passed. Distribution audit and whitespace checks passed. Final review confirmed
separate numerical classifications, bounded stress continuation, unchanged quick
checks, cancellation precedence, and report visibility of unresolved strength.
No worker/native changes or full benchmark-matrix rerun were needed.

Convergence-band follow-up: charts now shade and label the interval around the
previous mesh value, with dashed bounds at previous ± abs(previous) × recorded
tolerance (5% stress, 2% displacement/energy by default). Labels include numerical
bounds in preferred units and the reference mesh. The zero-based axis includes
the upper bound; single-mesh charts omit the band and zero baselines retain a
zero-width interval. Numerical classifications and stopping rules are unchanged.

The new regression failed before implementation, then all three focused harnesses,
all 50 application browser harnesses and 77 Python tests passed. Evidence:
`build/convergence-band-red.json`, `build/convergence-band-focused.json`, and
`build/convergence-band-suite.json`. Visual inspection of
`build/convergence-charts.png` confirmed readable bands and labels at 300px width
using the supplied-part results. Distribution audit and whitespace checks passed.

Auto-range follow-up: vertical axes now enclose the data and convergence band
with 8% padding (nonnegative lower bound), with explicit scale-bound labels.
Data-value Y labels prioritize recent meshes; the previous mesh DOF is added
alongside the endpoint labels when space permits. Measured SVG text bounds
suppress overlapping labels. Band opacity increased to 28%, and guidance states
that charts auto-range. Classification and tolerance calculations are unchanged.

Verification: the new range regression failed before implementation; all three
focused harnesses, all 50 application browser harnesses and 77 Python tests passed.
Tests cover intermediate DOF/value labels, label collisions and all-zero ranges.
Evidence: `build/convergence-range-red.json`, `build/convergence-range-focused.json`
and `build/convergence-range-suite.json`. Inspected the refreshed 300px-wide
`build/convergence-charts.png`; bands, axis values and guidance are readable.

Integration review (2026-09-27): owner authorized committing the accumulated
changes and merging locally into main, stopping before Plan 36. Reviewed the
outstanding application, tests, documentation and example changes; no blocking
issues found. Fresh pre-merge verification passed all 50 application browser
harnesses (`build/premerge-browser.json`), 77 Python tests and 10 native CTest
tests after configuring/building `build/usability-native` with the local CMake
tools. Distribution audit and whitespace checks passed; embedded examples
regenerated byte-for-byte. The supplied STEP fixture is unchanged. Benchmark
matrices were not rerun; this integration is not release authorization.
