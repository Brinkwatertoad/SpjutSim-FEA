# Combined M24–M27 owner review

The owner supplied corrections after this packet. Use the
[follow-up recheck packet](24-27-followup.md) for the current workflow, including
automatic checks on Solve and normal-force authoring.

Status: **Pending owner review**. Implementation and automated checks complete;
manual usability acceptance is not inferred. The owner requested all four plans
as one batch with incremental commits. Task 28 remains outside this batch.

Prior accepted work was fast-forwarded into `main` and pushed before creating
`work/plans-24-27` from `b947a84`. The new work stays on that branch for this review.
Plans 24, 25, and 26 are committed as `447e90a`, `a500755`, and `4e332c8`;
the final implementation commit contains plan 27 and grouped regression fixes.
Use `git log main..work/plans-24-27` to inspect the complete commit group.

Open `web/index.html` directly, or run `python3 tools/serve.py` and open
`http://127.0.0.1:8000/web/`. Allow roughly 40–60 minutes for the combined checks.

## Shared setup

Import `tests/fixtures/generated-unit-cube-m.step` (1 m cube). Set material
E = 200 GPa, Poisson ratio = 0.3, density = 7850 kg/m³, tensile yield = 250 MPa.
Use the signed camera views to identify faces. Add a Fixed support on X = 0 and
a total force `[1000, 0, 0]` N on X = 1. Use descriptive names such as “Fixed end”
and “Axial force”. Generate a coarse Tet10 mesh, press **Check model**, inspect
Checks, then press **Solve**.

The automated version produces sample von Mises peak 1588.4376967739508 Pa and
maximum displacement 5.009923755857133e-9 m. The fully fixed end creates a
nonuniform stress field; these are reproducibility values, not a uniform axial
analytical solution. Native element/solver tests and the cube WASM harness
supply separate numerical acceptance evidence.

For an approximately constant axial-stress field, replace Fixed with three
component supports: X = 0 constrains only X, Y = 0 only Y, and Z = 0 only Z.
Keep the axial load. Check and solve again; expected axial displacement at
X = 1 is 5e-9 m and von Mises is approximately 1000 Pa.

## M24 — display and legends

- [ ] Switch Model, Mesh, Stress, and Deformation; find principal stress,
  displacement components, and FoS. In shaded result views, Mesh overlay off
  removes element lines while Shaded with edges retains only part boundaries.
- [ ] Exercise deformation scale and Play/Stop, then return to Stress. Confirm
  the stress view is undeformed and numerical summaries remain unchanged.
- [ ] In Display, try vertical/horizontal legends, Pa/kPa/MPa and m/mm, manual
  limits, and range lock. Clip below the peak and confirm endpoint colors and
  clipping guidance. Unit changes preserve the same physical limits; incompatible
  field changes reset them. Locked compatible limits survive another solve.
- [ ] Try the constant-field setup, FoS `10+`, light/dark themes, and a short or
  narrow window. Read labels and compare contour colors with the key.

## M25 — assignment previews

- [ ] Begin each support/load type with no selection and with preselected faces.
  Plain clicks toggle faces; background clicks preserve them. Orbit, use the
  gizmo, and Clear selection. Inspect selected area, direction, units, and glyphs.
- [ ] Change pressure, force direction, and nonzero prescribed components before
  Apply. Incomplete values stay editable with useful errors. Preview glyphs are
  distinct from committed assignments and the edited original is suppressed.
- [ ] Cancel an edit after a solve: original assignment, result, and prior view
  return. Save an unchanged edit: the solve remains valid. Apply changed values:
  stale results disappear once while the usable mesh remains.
- [ ] Try leaving a dirty editor, empty selection, conflicting components, and
  Escape. Confirm Apply/Cancel guidance preserves your work. Repeat selection
  and preview on a curved CAD fixture of your choice.
- [ ] Explain whether adding faces spreads a fixed total force or changes the
  force produced by constant pressure; check that the UI makes this distinction clear.

## M26 — explicit checks and readable setup

- [ ] Check an incomplete setup, follow a finding to its editor, fix it, and
  check again. Read constraint readiness and memory estimate; expand details.
- [ ] Confirm import, mesh generation, form edits, and View checks do not run a
  check automatically. Solve requires a current successful check.
- [ ] Edit a load after checking: Check required appears and the old report is
  labeled stale. Change only camera/legend or assignment name: numerical state
  remains valid. Cancel a check/solve and explicitly recheck before retrying.
- [ ] Try long descriptive names, collapsed panels, narrow layouts, and keyboard
  navigation. Read setup values and persistent explanations for disabled actions.
  Synthetic cap/high-memory states are covered by the solve harnesses; no large
  allocation is needed for this review.

## M27 — correcting engineering edits

- [ ] Add, edit, delete, rename, undo, and redo both assignment types. Confirm
  face sets, values, names, original IDs/order, and descriptive action labels.
  Make a new edit after Undo and confirm the discarded Redo is unavailable.
- [ ] Undo material, gravity, mesh settings, and model rotation. Numerical edits
  require a recheck; mesh settings/orientation require a new mesh. Old results
  never reappear. Rename Undo/Redo preserves a valid solve.
- [ ] Use Ctrl/Cmd+Z in text fields and in the viewport. Try the platform Redo
  shortcut, Settings, an active preview, and worker execution. Native text undo
  keeps its usual behavior; engineering history is disabled while busy/drafting.
- [ ] Import/replace/remove geometry and confirm the visible history-reset
  explanation. Cancelling a preview or saving unchanged values adds no entry.

## Automated evidence and review scope

Verified 2026-09-09 on Linux x86_64, cached Chromium 1234 with software WebGL:

- `python3 -m unittest discover -s tests`: **77 passed**.
- README native configure/build plus `ctest --test-dir build/native-fem`:
  **8/8 passed**. This host uses cached CMake under
  `build/operator-tools/cmake/root/usr/bin`, with
  `build/cmake-local/usr/lib/x86_64-linux-gnu` on `LD_LIBRARY_PATH`.
- **22 browser harnesses passed**: worker-runtime, step-import, tet4-mesh,
  tet10-mesh, preview-selection, workspace-layout, result-range,
  result-formatting, result-presentation, viewport-navigation, solve-workflow,
  solve-checks-ui, analysis-authoring, assignment-draft, engineering-history,
  wasm-solve-result, cube-wasm-vertical-slice, factor-of-safety, convergence,
  convergence-runner, cube-convergence, and grouped-authoring.
  Each is a standalone `tests/browser/<name>-tests.html`; fixture fetches require
  HTTP or Chromium local-file access.
- Direct-file app startup and real Tet10 workflow passed. HTTP startup reports
  “Local runtime ready” with isolation enabled; the grouped authoring harness
  also passed over HTTP. The group checks 1440×900, 1440×500, 850×600, and
  500×400 viewport bounds and presentation-only numerical-state preservation.
- Regression coverage includes capped history/typed-array rejection, stable
  IDs and monotonic names, stale FaceIds, draft commit/cancel, convergence draft
  guards, explicit preflight gates, short/signed/uniform legends, SI range locks,
  palette matching, mesh-line independence, and renderer buffer reuse.
- Complete-diff review covered validation, worker/revision boundaries,
  accessibility, memory retention, repeated mesh work, and error recovery.
  No native kernel, dependency, vendor, or generated runtime changes.

Owner decision and corrections: **Pending**. M24, M25, M26, and M27 remain
unchecked until the owner provides the combined manual result.
