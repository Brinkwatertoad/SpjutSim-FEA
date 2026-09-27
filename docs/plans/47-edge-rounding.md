# Edge rounding and radius sensitivity

**Withdrawn by the owner (2026-09-26).** Rounding was removed from the app,
worker APIs and current specification after repeated usability/reliability problems.
The material below is historical evidence, not a supported feature or active plan.
The corrected beam example and Examples menu are retained.


Owner approved implementation on 2026-09-26. Execute in the current agent.

Goal: an accessible, unobtrusive Model option to preview automatic rounding and
compare assumed radii without changing the original CAD or claiming a universal
manufacturing radius. Include the corrected larger beam and Examples menu.

Design: run CAD inspection/fillets in the existing disposable Gmsh worker. Keep
CAD tags private to that worker API. Preview a reversible analysis variant in a
dialog; leave the original analysis intact. Exclude edges incident to assigned
faces and their vertices, and require unambiguous unchanged assigned-face mapping.
Report exclusions rather than silently moving supports/loads. A remembered radius
is optional; the initial suggestion is explicitly exploratory (1% of the smallest
bounding-box span). Reject invalid/unbuildable radii; never increase radius to pass.

Compare r/2, r, 2r using the same selected edge set. Solve two meshes per radius
(0.7 refinement), with the existing resource guards and one worker phase at a time.
Keep only compact summaries and the selected preview/result; preserve the original
project. Separate radius sensitivity from mesh sensitivity and avoid an invented
design acceptance criterion. Save compact study assumptions/results in project
metadata, check their input fingerprint before presentation/export, and include
them in normal reports. Cancellation and stale inputs cannot publish success.

- [x] Correct beam to −90° about X, dimensions 2 × 0.2 × 0.1 m before rotation,
  2 kN in −Y, 40–50 mm Tet10 target; expected tip displacement 1.6 mm.
- [x] Add both examples to the top menu with recovery-preserving project replacement.
- [x] Add validated worker inspection/fillet operations and real CAD regressions.
- [x] Add model-owned sequential radius-study execution, cancellation and summaries.
- [x] Add unobtrusive entry points, preview/selection, radius settings and result table.
- [x] Verify file/HTTP operation, numerical checks, persistence/report behavior,
  failed/cancelled/stale operations; review full diff and update spec/README.

No new dependencies, native solver changes or runtime network requests. Generated
worker wrappers must be reproducible. Existing CAD and setup remain authoritative.

Owner-directed follow-up: validate the supplied four-leg STEP with protected feet
and top; default to inner corners (owner approved), support direct edge picking
and selection presets, collapse exclusions, and resolve curved-mesh inversion
without weakening numerical gates. See the follow-up in the review record.


Owner-approved replacement workflow: stress-guided rounding (2026-09-26)

The earlier manual edge / three-radius primary flow is superseded. Use the original
raw stress samples to find nearby sharp inner corners, show a suggested assumed
radius with an advanced override, and run exactly two meshes of one fixed geometry.
Keep protected faces and original analysis intact; disclose unmatched hotspots.

- [x] Add cancellable stress-to-CAD matching, including multiple hot regions,
  rotated Tet4/Tet10 results, protected edges and stale-result rejection.
- [x] Change new studies to one radius/two solves; retain legacy report support.
- [x] Simplify the dialog; move edge editing/radius override under Advanced.
- [x] Verify the supplied STEP end to end, persistence, reports, failures and UI;
  run applicable suites and review the complete change.
