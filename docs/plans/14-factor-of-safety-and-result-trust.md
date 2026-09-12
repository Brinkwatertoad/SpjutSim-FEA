# Task 14: Complete factor-of-safety and result trust views

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the single-solve trust layer with yield-based factor of safety, unambiguous raw/smoothed reporting, actionable warnings, and a complete analysis summary.

**Architecture:** Derive factor of safety and presentation warnings from immutable result/material snapshots in pure analysis modules. Extend the result model once, then let the viewport and output pane consume that contract without duplicating engineering calculations in UI code.

**Tech Stack:** Plain JavaScript/JSDoc, typed arrays, Three.js result rendering, static browser tests.

**Spec:** `spec.md` Sections 2.3, 3.7, 11, 12, 14, 15.5, 15.8–15.10, 16, and Milestone 4.

## Global constraints

- SI values remain authoritative; unit conversion and formatting stay at UI boundaries.
- Raw recovery extrema and smoothed display extrema must remain separately named.
- Missing strength suppresses FoS without blocking a valid displacement/stress solve.
- Warnings never silently change meshes, loads, solver settings, clipping, or reported extrema.
- Upstream engineering edits invalidate all derived FoS/summary data with the result.

---

## Starting point

The result contract already carries displacement, von Mises/principal stress,
reactions, equilibrium, solver statistics, raw Tet4 extrema, smoothed surface
fields, and approximate surface probes. The UI lacks factor of safety, the full
specified result summary, the linear-model large-displacement warning, and a
single structured warning model that can later receive convergence/singularity
status.

## Implementation

- [x] **Add a pure FoS contract.** Create
  `web/js/analysis/factor-of-safety.js` with an explicit strength-selection
  result: smaller of tensile/compressive yield when both exist, the supplied
  yield when only one exists, and unavailable when neither exists. Compute raw
  FoS at recovery samples and a separately named surface-smoothed FoS field;
  represent zero-stress FoS as unbounded in engineering data while providing a
  finite, clearly labeled contour ceiling for color mapping only.
- [x] **Extend and validate result snapshots.** Update
  `web/js/analysis/result-model.js` and `web/js/analysis/app-controller.js` so
  the validated solver result is decorated with the material strength
  value/source, criterion identifier (`von-mises-yield`), raw minimum FoS and
  location/sample owner, displayed minimum, applied-load summary, and warnings
  before it becomes controller state. Reject missing/inconsistent typed fields
  and never derive FoS from ultimate strength.
- [x] **Add the FoS result view.** Extend `web/index.html`,
  `web/js/render/viewport-controller.js`, and `web/js/ui/ui-controller.js` with
  an available-only-when-defined FoS field, unitless legend, minimum markers,
  strength/criterion explanation, and separate raw/displayed values. Preserve
  unclipped extrema when the contour ceiling or percentile clipping is active.
- [x] **Finish result summaries and probes.** Report element type,
  nodes/elements/DOFs, residual/iterations/time, max displacement/location, raw
  and displayed stress extrema, principal extrema, minimum FoS, strain energy,
  applied loads, total reactions, equilibrium residual, and warnings. Probes
  identify coordinates, displacement vector/magnitude, active field, and
  diagnostic `FaceId`, and label smoothed/interpolated values as approximate.
- [x] **Centralize single-solve warnings.** Add pure warning generation for mesh
  quality, unusual material assumptions, solver diagnostics, and
  `maxDisplacement > 0.05 * boundingBoxDiagonal`. Display the small-strain,
  linear-elastic, static, single-isotropic-solid assumptions in the completed
  summary and in any serialized result-summary metadata.
- [x] **Prepare convergence integration.** Define a stable summary/warning slot
  for `convergenceStatus: 'not-run' | ...` and singularity annotations without
  inferring convergence from one mesh. Task 15 fills these fields; Task 14 must
  display `Not studied` rather than implying trust.
- [x] **Document and regenerate.** Load the new analysis script in the direct-
  local-safe order, update README result capabilities/limitations, regenerate
  worker wrappers when worker code changes, and keep the result contract
  versioned with its validator.

## Verification

- Add pure browser tests covering both/one/no yield strengths, compressive-
  strength selection, zero stress, invalid strength, raw versus displayed FoS,
  SI/display formatting, and stale-result invalidation.
- Extend `tests/browser/wasm-solve-result-tests.js` for result validation,
  warning thresholds, summary fields, approximate probes, contour clipping, and
  no-FoS behavior. Extend the Tet10 vertical slice with a known yield strength
  and expected minimum FoS away from singular boundaries.
- Run the Python, native, worker, authoring, result, vertical-slice, and direct-
  local suites documented in README; verify keyboard/screen-reader names for
  the new field and output content.

## Done when

A completed Tet10 solve communicates what was solved, its numerical balance and
limits, and its raw versus displayed extrema; yield FoS appears only from valid
yield data with the specified criterion; and no single-mesh result is labeled
converged or safe by implication.
