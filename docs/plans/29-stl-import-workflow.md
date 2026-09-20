# Task 29: STL import workflow implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent.
> Follow repository AGENTS.md; do not dispatch subagents. Use behavioral TDD for
> each package and one final complete-diff review. Stop at M29 before Task 30.

**Goal:** Let users see an STL immediately, receive automatic routine cleanup,
confirm scale or a visible repair proposal, and continue to analysis setup.

**Architecture:** Separate bounded preview/diagnostic preparation from accepted
solid geometry. A small disposable JavaScript worker prepares the source; the
controller owns the pending transaction; rendering/UI consume its contracts.
Gmsh surface preparation moves to meshing and keeps source-group ownership.

**Tech Stack:** Existing classic JavaScript, typed arrays, file-safe workers,
local Three.js, pinned Gmsh/WASM, Python/CMake/CTest. No new dependencies.

**Spec:** `spec.md` §§6.1, 15.11, 16, 18–21, 26 and
[STL workflow design](../designs/stl-import-workflow.md).

**Status:** Owner-feedback follow-up in progress on `feat/stl-import-workflow`. The initial implementation is committed; its automated and
presentation evidence is in the [M29 review](../reviews/29-stl-workflow.md).
Owner walkthrough/acceptance is pending. Task 30 and release acceptance have not
started. The full resource calibration matrix exceeded the local harness deadline;
the resource smoke profile and STL-specific 50k/200k bounds passed.

## Global constraints and execution order

- No backwards compatibility: replace legacy STL option/metadata versions,
  request shapes, identities and UI paths. Update all live producers/consumers and
  fixtures together. No aliases, migration functions or dual implementations.
- Preview is not a validated solid. No analysis operation can consume it.
- Keep original bytes, installed analyses and numerical validation intact.
- Preserve 16 MiB/200,000-triangle limits, 512 internal surfaces, 2 million
  intersection candidates, 120-second per-operation deadlines and solver preflight.
- Cap diagnostic details at 1,000 records / 200,000 referenced primitives; state
  explicitly when checks or locations are incomplete.
- No automatic welding, component deletion, smoothing, arbitrary repair,
  automatic surface-method search or new CAD kernel without explicit dependency approval.
  The approved follow-up below supersedes the original-triangle default.
- First-use source-unit assumption is visibly `mm`; remember only successful STL
  source-unit confirmations. Physical scale is confirmed by Use model.
- Execute packages 1 → 2 → 3 → 4 → 5 → 6. Packages 1–2 can be verified in
  isolated harnesses. Packages 3–5 form one application cutover: complete controller,
  UI and meshing integration together before a runnable checkpoint or handoff.
  Do not introduce temporary compatibility adapters or ship both import flows.

## File ownership

| Responsibility | Files |
| --- | --- |
| Decode and strict solid checks | `workers/stl-import.js` |
| Bounded localized findings | New `workers/stl-diagnostics.js` |
| Cleanup and shape-change proposals | `workers/stl-repair.js` |
| Preparation lifecycle and events | New `workers/stl-preparation-worker.js`, new `web/js/workers/stl-preparation-client.js` |
| Shared transient contracts | New `web/js/geometry/stl-preparation.js`; load in worker and browser |
| Transaction and installation | `web/js/analysis/app-controller.js`, `web/js/geometry/geometry-model.js`, `web/js/app.js` |
| Pending model and issue overlays | `web/js/render/viewport-controller.js`, new `web/js/render/stl-diagnostics-display.js` |
| Import panel and selection/mesh controls | `web/js/ui/stl-import-ui.js`, `web/js/ui/analysis-authoring-ui.js`, `web/js/ui/ui-controller.js`, `web/index.html`, `web/css/app.css` |
| Accepted-source meshing and identities | `workers/mesher-worker.js`, `workers/stl-reconstruction.js`, `workers/stl-remesh.js`, `web/js/workers/mesher-client.js`, `web/js/analysis/analysis-document.js`, `web/js/analysis/replacement-migration.js`, `web/js/geometry/rigid-orientation.js` |
| Worker boundary and reproducible packaging | `workers/solver-worker.js`, `web/js/workers/solver-client.js`, `web/js/workers/worker-protocol.js`, `web/js/workers/local-worker-bootstrap.js`, `tools/build-local-runtime.py`, `tests/test_framework.py`, distribution manifests |

Keep numerical predicates with the parser and repair logic with the repair module.
The diagnostics module aggregates findings; the display module owns disposable
GPU layers. Avoid generic worker-job abstractions or unrelated controller rewrites.

## 1. Publish a bounded source preview and localized diagnostics

**Tests:** Add `tests/browser/stl-preparation-tests.{html,js}`; extend
`stl-import-tests.{html,js}` and `worker-runtime-tests.{html,js}`.

**Interfaces:** Introduce `StlImport.decode(sourceBytes)` returning finite,
exactly indexed `Float64Array positions`, `Uint32Array triangles`, source bounds
and source facet identity, in file-coordinate units. Extract it from the existing
`readUnvalidated` path without imposing solid validity or SI scale acceptance.
Define `StlDiagnostics.inspect(decoded, limits)` returning check coverage and
bounded findings. Reuse the same predicates for strict validation and diagnosis;
never maintain a weaker alternate validator.

The preparation contract uses this envelope (types are plain JavaScript data,
not a TypeScript dependency):

```js
// Request to the preparation worker; sourceBytes is a transferred work copy.
{ protocol: 4, type: 'prepare-stl', requestId, sessionId, generation,
  sourceBytes, lengthUnit, patchAngleDegrees: 40, maxHoleDiameterRatio: 0.01 }
// Stage events: preview -> progress/diagnostics -> prepared, or error.
{ protocol: 4, type: 'stl-preview', requestId, sessionId, generation,
  preview: { revision: 'source', positions, triangles, bounds } }
// Diagnostic location IDs always address their named preview revision.
{ kind: 'open-boundary', status: 'unresolved', revision: 'source',
  bounds, count, triangleIds, edgeVertexIds, vertexIds }
```

`positions` in previews retain source coordinates; a validated positive unit scale
is applied for display. Diagnostic index arrays are `Uint32Array`; edge entries
are pairs. Empty locations use empty arrays. Aggregate `coverage` records each
check as `passed/failed/skipped/limit`, and `locationsTruncated`/`countsExact`
describe collection limits. Boundary validation rejects mismatched revisions,
nonfinite bounds, odd edge arrays, out-of-range indices and exceeded caps.

- [x] Write failing behavioral cases: an open cube yields a preview before a
  deliberately delayed topology pass; inconsistent winding is double-sided
  displayable; disconnected components and both intersection triangles receive
  correct locations; malformed bytes/nonfinite coordinates never reach rendering.
- [x] Extract decode and diagnostic passes. Continue independent safe checks
  after a finding, skip checks with invalid prerequisites, and reuse spatial
  acceleration. Deterministic counts/locations must not use an all-pairs scan.
- [x] Create the lightweight worker/client, send one source preview before checks,
  and enforce whole-request timeout/cancellation. Transfer preview buffers once;
  keep one bounded working copy if validation needs the data after transfer.
- [x] Move the coarse protocol to 4 across the shared constant, mesher/solver
  envelopes, startup handshake, tests and builder in this package; native solver ABI
  stays unchanged.
  Package the new worker without Gmsh/FEM payloads; reject protocol 3 outright.
- [x] Verify stale/malformed events, truncated diagnostics, deadline and cancellation
  behavior in file and HTTP modes. Build wrappers reproducibly before proceeding.

## 2. Split automatic cleanup from reviewable shape changes

**Tests:** Extend `stl-repair-tests.{html,js}`, `stl-preparation-tests.{html,js}`
and `stl-large-tests.{html,js}`. Reuse exact-predicate and ASCII-precision fixtures.

**Interfaces:** Replace monolithic `StlRepair.repair` with
`StlRepair.prepare(decoded, {maxHoleDiameterRatio}, limits)`. Its output identifies
automatic edits, proposed edits, retained coordinates and original/candidate facet
mapping. The worker serializes/revalidates the candidate and completes with:

```js
{ protocol: 4, type: 'stl-prepared', requestId, sessionId, generation,
  result: { state: 'ready', sourceDigest, preparedDigest, preparedSourceBytes,
    candidatePreview, sourceTriangleByCandidate, geometryCandidate, diagnostics, changes, validation } }
// state: ready | needs-review | blocked
// changes: { automatic: [...], proposed: [...] }, with revision-bound locations.
// preparedSourceBytes/candidatePreview are null when identical to source;
// validation identifies the checked revision and unit scale.
```

`ready` requires complete solid validation with no proposed shape edits;
`needs-review` requires complete validation and at least one proposed edit;
`blocked` cannot install. Build groups, digests and SI `geometryCandidate` in the
worker only after full validation; invalid candidates carry null geometry. The
geometry candidate is not installed until controller checks and user consent pass.
If a changed candidate fails validation, its preview may remain for diagnosis but
no accepted geometry is produced. Every serializer
output is reparsed before a ready/reviewable result is emitted.

- [x] Test automatic correction of reversed/inward winding, exact duplicate and
  exact-zero-area removal without coordinate changes. Confirm thin real facets
  and high-precision ASCII coordinates survive unchanged.
- [x] Test hole fills and stray removals always produce `needs-review`, include
  accurate before/after locations, and never discard/join components. Preserve
  existing loop/convexity/planarity/diameter and serialization limits.
- [x] Implement deterministic source-to-candidate facet maps through compaction,
  orientation and added faces. Record source locations before deleting faces.
- [x] Test cleanup that fixes one problem but leaves another: source stays visible,
  fixed/unresolved findings remain distinct, incomplete validation stays blocked.
  Verify no stale candidate or old consent survives a unit/repair-setting edit.
- [x] Verify original bytes are unchanged, digests/counts reconcile, bounds exclude
  removed outliers, and the 200,000-triangle case stays within explicit limits.

## 3. Own preparation and installation as a controller transaction

**Tests:** Extend `review-contract-tests.{html,js}` and add controller scenarios
to `stl-preparation-tests.{html,js}`; update `unit-preferences-tests.{html,js}`.

**Interfaces:** Replace `geometryReview` with `stlImportSession` and controller
methods `beginStlImport(source)`, `updateStlImportSettings(settings)`,
`applyStlPreparationEvent(event)`, `cancelStlImport()` and
`acceptStlImport({acceptShapeChanges})`. They own session/generation checks,
readiness and validation; UI handlers never assemble accepted geometry themselves.
`acceptStlImport` returns only validated, consented installation data to the app
coordinator, which installs it or invokes existing replacement mapping when assignments exist.

- [x] Write failures for cancellation/stale completion after a newer source,
  settings edit or closed session; wrong digests/units/revisions; preview objects
  offered as geometry; and consent sent for a blocked or outdated candidate.
- [x] Implement one source-unit preference independent of display units. A new
  session uses the last installed source unit or `mm`, always marked assumed;
  committing stores it. Blocked/cancelled sessions do not update the preference.
- [x] Validate and adopt worker-produced source/group geometry from a completely
  checked preparation result, without Gmsh startup. Compute grouping, hashing and
  SI geometry buffers in the preparation worker, not the controller. Keep strict
  geometry-contract guards for worker and controller data.
- [x] Test replacement Cancel/failure preserves prior source, assignments, revision,
  mesh and results; successful installation uses normal invalidation/history rules.
  Unit edits retain source preview but revoke old validation and consent.
- [x] Assert invalid previews cannot enable authoring, meshing, solve, convergence
  or report export. Dispose pending workers/buffers on every terminal transition.

## 4. Replace the import dialog with visible progress and actionable findings

**Tests:** Rewrite `stl-workflow-tests.{html,js}` and
`stl-repair-workflow-tests.{html,js}` around outcomes rather than obsolete controls;
extend `workspace-layout-tests.{html,js}` and `viewport-navigation-tests.{html,js}`.

**Interfaces:** `StlImportUI` consumes `stlImportSession` and calls controller
actions. `StlDiagnosticsDisplay` owns preview/issue GPU buffers and exposes
`setPreview(preview, scale)`, `setDiagnostics(diagnostics)`, `focusIssue(index)`,
`showRevision(revision)` and `dispose()`. Integrate through `ViewportController`;
generic `/web/ui` helpers never import simulation contracts.

- [x] Add real-app tests for immediate source display and usable rotate/zoom while
  checking; one Use model action after a valid/automatically cleaned part; dimension
  changes without manual refresh; and no mesh-strategy/grouping controls in import.
- [x] Replace the modal canvas with the main viewport and compact preparation
  panel. Snapshot/restore only presentation state on Cancel; do not clone the
  installed analysis. Disable conflicting engineering controls during preparation.
- [x] Render grouped findings and proposed changes, keyboard focus/zoom, Show all,
  Original/Prepared comparison without camera jumps, and labeled through-surface
  highlighting. Keep issue clicks separate from engineering face selection.
- [x] Implement Use model / Use repaired model readiness, shape-change explanation,
  download-original, choose-another-file and Cancel. Blocked states retain preview
  and specific next steps; advanced repair limits recheck automatically.
- [x] Remove Try surface repair, Update preview, import surface-mode selectors and
  the old dialog handlers/DOM. Remove their legacy tests; retain their engineering
  assertions in the new flow. Keep technical codes expandable.
- [x] Test keyboard-only operation, focus restoration, live-region progress,
  reduced motion, all themes, narrow desktop sizes and 2× DPI. Stage events must
  not rebuild geometry or issue layers when only text/counts change. Normalize
  render coordinates around a local origin before Float32 upload; retain decoded
  Float64 coordinates for checks, dimensions and engineering geometry.

## 5. Separate source groups from simulation-surface settings

**Tests:** Update `stl-surface-modes-tests`, `stl-reconstruction-tests`,
`stl-remesh-tests`, `stl-mesh-solve-tests`, `stl-convergence-tests`,
`analysis-authoring-tests` and `engineering-history-tests` browser pairs.

**Interfaces:** Replace combined legacy `importOptions` with one current source
contract and an independent mesh-settings field:

```js
stlSource = { version: 3, lengthUnit, patchAngleDegrees,
  sourceDigest, preparedDigest }; // original/prepared buffers owned by controller
meshSettings.stlSurface = { version: 1, method: 'analysis',
  reconstructionToleranceM: null, remeshFeatureAngleDegrees: null };
// reconstruct: positive reconstructionToleranceM, null remesh angle
// remesh: null tolerance, angle in [1,40]; defaults to 5 on explicit selection
```

Use one validator per contract at all relevant boundaries. Canonical group IDs
include prepared source/group membership, grouping definition and source units;
exclude simulation-surface settings and orientation. Fresh-worker meshing checks
source digest and exact group ownership before applying supports/loads.

- [x] Test same-source groups retain IDs across original/reconstruct/remesh,
  refinement and rigid orientation; changed source/units/grouping invokes explicit
  assignment transfer. Reject missing, overlapping or ambiguous surface ownership.
- [x] Move grouping controls into Model selection and surface-method controls into
  Mesh Advanced. Default to rebuilt analysis boundaries; present optional reconstruction candidate
  comparison before Apply. Applying a method/tolerance/angle invalidates mesh and
  results, retains verified source groups and authored assignments, and is an
  engineering edit subject to normal history rules. Failed/cancelled preparation
  leaves the previous settings and analysis intact.
- [x] Refactor reconstruction/remesh adapters to consume prepared source and mesh
  settings without changing numerical algorithms. Preserve original-facet,
  curved-reconstruction, straight-remesh and area-warning behavior; no automatic
  fallback. Display physical fidelity warnings with mesh results.
- [x] Delete STL versions 1/2, `normalization: 'none'`, obsolete repair requests,
  legacy classification/identity branches and imports of old validators. Update
  live fixture manifests, corpus option validators and test constructors together.
  Preserve historical evidence as historical; do not rewrite measured outcomes.
- [x] Run the analytical cube in all modes and after automatic cleanup/reviewed
  filling. Retain tight constant-strain checks; reconstructed curved cases retain
  §16.2's 1% displacement/stress, 0.1% reaction and <1e-6 equilibrium thresholds.
  Test pressure, total force, remeshing, orientation and convergence with retained
  assignments; keep unsupported primitive/freeform cases explicit.

## 6. Verify the complete workflow and replace the M29 walkthrough

**Files:** `tools/build-local-runtime.py`, `tests/test_framework.py`,
`tests/fixtures/corpus-v1.json`, `tools/cad_corpus.py`, `tests/test_cad_corpus.py`,
`tests/browser/cad-corpus-tests.js`, `tests/browser/stl-resource-tests.{html,js}`,
`docs/reviews/29-stl-workflow.md`, `README.md`, `spec.md`, release evidence records.

- [x] Update corpus expectations with separate raw defects and prepared outcomes.
  Winding/duplicate fixtures may now become usable; open/intersecting/disconnected
  cases must retain explicit diagnostics. Preserve all 50 CAD classifications.
  Record new measurements separately from the older 68-case report.
- [x] Regenerate file-safe wrappers twice and confirm byte equality. Audit packaged
  preparation-worker content, script ordering, protocol consistency and distribution
  hashes; no Gmsh/FEM rebuild is needed unless numerical sources change separately.
- [x] Run `python3 -m unittest discover -s tests`, native configure/build/CTest,
  `python3 tools/validate-validation-records.py`, `python3 tools/validate-cad-corpus.py`,
  `python3 tools/validate-resource-records.py`, and distribution audits following
  README. Run every applicable pure and integrated browser harness, all STL surface
  modes, the CAD corpus and report/unit/history regressions. Keep actual logs and
  browser/platform/commit scope; older records are not new passes.
- [x] Exercise file/HTTP Chromium and supported Firefox checks, offline startup,
  repeated replace/cancel/retry, deadlines, 200,000-triangle bounds and truncated
  issue collection. Measure time to first preview, stage timing, buffer/GPU ownership
  and WASM overlap. Confirm preview precedes delayed expensive checks; avoid claiming
  a universal latency or whole-browser memory figure from buffer sizes alone.
- [x] Review the complete diff once for numerical validation, state ownership,
  allocations/copies, stale events, accessibility, missed legacy paths and unintended
  vendor/generated edits. Use verification-before-completion before success claims.
- [x] Replace `docs/reviews/29-stl-workflow.md` with current evidence and the owner
  walkthrough below, preserving links to dated historical evidence. Update README
  from implemented behavior only. Keep M29 unchecked until actual acceptance.

### M29 owner walkthrough — approximately 20 minutes

1. Open valid binary and ASCII parts. See each part before checking finishes,
   confirm visible dimensions and continue with one action. Correct an assumed
   unit and confirm the resulting physical size.
2. Open a reversed/duplicate-facet example. Watch automatic cleanup, inspect
   optional changes, and continue without a separate repair command.
3. Open a small-hole example. Focus the highlighted opening, compare the proposed
   fill, reject it once, then explicitly accept it. Download the unchanged original.
4. Open an intersecting example (including the optional gargoyle). Compare the
   rebuilt solid, reject once, then accept its stated material changes. Open a
   disconnected example and inspect grouped blockers; unsupported input stays visible.
5. Cancel replacement of an already solved model and verify its view/setup/results
   return. Retry, then complete an explicit assignment transfer where needed.
6. On an accepted STL, author supports/load, mesh, check and solve. Find advanced
   surface options in Mesh and grouping near selection without reopening import.
   Exercise one method change, verify assignments and invalidation, then remesh.

Record confusing steps and fix them within M29. Task 30 follows accepted M29;
Task 20 subsequently audits the exact release candidate. Planning approval is
not implementation completion, usability acceptance or release authorization.

## 7. Owner feedback: useful diagnosis and analysis-ready surface meshing

This is the continuation of M29, not a second STL plan. No compatibility layer.

- [x] Open the selected filename before file reading finishes; distinguish reading,
  checking/repairing, ready, proposed repair, and unsuccessful repair. Preserve the
  previous analysis until acceptance, including read cancellation and late results.
- [x] Replace intersection-pair rows with connected regions and exact aggregate
  counts. Count components as components. Put locations in expandable diagnostics;
  explain unavailable repairs without inventing a manual task list. Hide issue
  controls for clean imports and separate highlighting from viewport Fit.
- [x] Independently audit gargoyle intersections and implement a stronger solid
  repair path. Joining components or changing material requires a validated preview
  and explicit acceptance. Do not describe cleanup as general solid repair.
- [x] Make rebuilt surfaces the analysis default. Recover exact planar boundaries
  before volume meshing; use the existing discrete chart path for other surfaces.
  Preserve engineering groups independently of internal surfaces. Keep original
  triangles as an explicit advanced choice. Avoid silent method fallback.
- [x] Add thickness-aware size control, source/mesh boundary-area and volume checks,
  geometric deviation evidence and quality regression cases for elongated and
  rotated parts. Report practical limitations and resource limits explicitly.
- [x] Verify focused and complete applicable tests, update the current walkthrough
  and specification, and commit tested checkpoints. M29 acceptance remains open.

Known remaining limitation: gargoyle now passes strict preparation after reviewed
solid reconstruction, but default meshing hits the 512-chart bound. A wider-chart
experiment then hits the conservative global thickness workload cap. Local adaptive
sizing/more capable chart construction remain future work; no gargoyle solve is
claimed. See the current M29 review for the measured limits and dependency tradeoffs.

## 8. Approved detail-preserving repair and chart-free complex STL meshing

The owner rejected whole-model wrapping because it erased gargoyle detail and
approved the following replacement. Keep one design/plan and no compatibility path.

- [x] Prove intersection subdivision and solid-boundary extraction on the original
  gargoyle, preserving unaffected exterior triangles. Add regression evidence for
  coordinates, exterior detail, topology, orientation and Float64 serialization.
  Replace automatic wrapping; never silently approximate the whole source.
- [x] Integrate the proven repair behind the replaceable native interface, with
  bounded work/memory, provenance, localized changes and explicit material consent.
  Measure the new WASM size and preserve corresponding-source/license auditing.
- [ ] For complex surfaces, generate a quality boundary mesh directly on the
  repaired surface with constrained features/selection seams and bounded deviation;
  feed this discrete boundary to Gmsh without creating parametrization charts.
  Preserve existing exact planar-boundary meshing for suitable mechanical parts.
- [ ] Replace global minimum-thickness sizing with a graded local field used by
  both surface and volume meshing. Estimate element/memory workload locally and
  retain explicit resource and fidelity rejection.
- [ ] Verify gargoyle detail and successful volume meshing, elongated/rotated and
  thin-appendage cases, grouping/loads, cancel/stale results, native/browser numerical
  suites, file startup, packaging and complete diff. Commit tested checkpoints.

M29 acceptance remains pending. Prior wrap results and failures are historical
evidence, not acceptance criteria for this revision.

Repair checkpoint: native ABI and five Chromium file-mode browser suites pass.
The original gargoyle yields 61,448 strict-valid facets, including 57,030 unchanged
source facets, identical exterior bounds and one explicitly proposed tiny enclosed
void fill. Runtime: 1,004,422 bytes / 336,902 gzip; no added dependency. Meshing
items above remain in progress.
