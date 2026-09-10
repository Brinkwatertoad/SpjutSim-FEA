# M28: STL feasibility and contract decision

- Status: **Pending owner review and contract decision**.
- Branch: `feat/28-29-stl-import`, based on `fed435a`.
- Implementation: the branch's `tests/browser/stl-*` experiments, generated
  `tests/fixtures/stl` corpus, fixture generator, and proposed design. Production
  application/worker code and capability claims remain unchanged.
- Browser/platform: Chromium 152.0.7977.75 on Linux; direct `file://` with local
  file access enabled, and HTTP through `tools/serve.py`.
- [Proposed contract](../designs/stl-import-contract.md).
- [Recorded runtime and UI evidence](28-stl-runtime-evidence.json), including
  exact experimental source hashes and pinned runtime metadata.

## Decision

Accept or revise this contract before production implementation in plan 29:

1. Binary/ASCII STL for one closed, connected, outward-oriented manifold solid;
   full validation rejects self-intersections and ambiguous geometry. No hidden
   welding, automatic winding reversal, hole filling, or multibody selection.
2. Explicit m/mm/cm/in/ft source units, followed by dimension and patch review.
3. Connected angle-based user patches, initially 40°, adjustable from 1° to 179°.
   Preserve the actual STL facets in the mesh. A curved patch groups facets;
   it does not reconstruct smooth CAD geometry.
4. Stable source/options/membership-derived opaque patch IDs. Changed units or
   grouping require explicit assignment remapping; failed/cancelled review
   retains the existing model and setup.
5. Use the pinned runtime's indexed-mesh APIs, avoiding its tolerance-welding
   STL reader. No dependency, runtime, or native FEM API changes.
6. Proposed ceilings: 16 MiB input, 50,000 triangles, 512 internal surfaces,
   2,000,000 intersection candidate pairs, 120-second mesher timeout. Plan 29
   must verify boundary/resource cases; the small feasibility cases do not
   establish capacity at those ceilings.

This is a supported-subset/design decision, not M29 numerical or usability
acceptance. Plans 28 and 29 remain unchecked until their respective owner gates.

## Walkthrough (about 20 minutes)

1. Open `tests/browser/stl-patch-demo.html`. Select **cube-binary.stl**, choose
   **mm**, and inspect the dimensions: **0.001 × 0.001 × 0.001 m** (1 mm per edge).
   Confirm that no units were inferred before your choice. Repeat with ASCII.
2. Select a colored cube face by clicking or using its patch button. There are
   **six user patches**, even though this runtime internally uses eight surfaces.
3. Select **cylinder-32.stl** and use **m**, grouping angle **40°**. There are
   **three user patches**: two end caps and the curved side. Rotate by dragging;
   hover or use the labeled buttons to identify/select a patch.
4. Change grouping to **1°**. There are **34 patches** (32 sides plus two caps).
   Inspect the changed IDs and the explicit remapping consequence. Return to
   40° and confirm the original source/options IDs return.
5. Press **Probe Tet10**. Inspect positive sampled Jacobians, six-node solver
   boundary faces, and four display triangles per boundary face. No analysis
   model is installed by this experimental button.
6. Select **open.stl**. Expect `STL_OPEN_SURFACE` with instructions to export a
   closed solid and an explicit statement that holes are not filled. The prior
   preview remains available. Try inward/nonmanifold examples too.
7. Select **thin-plate.stl**, choose units and probe. The retained low-quality
   warning is intentional. The automated harness covers cancelling a longer
   volume mesh and succeeding in a new worker afterward.

## Automated checks

- 77 Python tests passed; fixture regeneration reproduces all 15 files and the
  manifest byte-for-byte.
- Native CMake build and all eight CTest tests passed. This environment used
  its existing operator CMake binary/libraries because CMake is not on PATH.
- All 26 non-resource browser harnesses other than the new runtime harness
  passed: the 22 selected authoring/result/worker/STL-parser regressions, plus
  cube convergence, grouped authoring, the 50/50 CAD corpus and five-case
  numerical validation benchmark.
- New runtime harness: 14 mesh runs per transport (12 exact indexed import
  cases plus two STL-reader characterizations), under both file and HTTP.
  Each uses a fresh worker. Positive Tet4/Tet10 Jacobians, faceted volume,
  Tri6/display subdivision, source-patch ownership and stable fresh-worker IDs
  passed. Cancellation and recovery also passed on both transports.
- Demo: explicit units/dimensions, keyboard-accessible patch buttons, selection,
  regrouping and rejected-file preview preservation passed without page errors.
- Offline direct-local application startup: `Local runtime ready`, no page
  errors, no HTTP(S) requests.
- CAD corpus manifest, five stored validation records and distribution artifact
  audit passed. No production runtime, generated worker or vendor files changed.
- Complete-diff review covered experimental/production boundaries, lifecycle,
  bounded input, numerical evidence, identity, error wording, and accessibility.

The resource release matrix was not rerun: this package measures the experimental
STL path separately, does not alter the production runtime, and makes no updated
release resource claim. Existing CAD/native numerical passes are regression
evidence; they are not evidence of STL solve accuracy.

## Remaining implementation and limits

The demo parser is explicitly an experimental topology screen. Full accelerated
self-intersection and vertex-link validation, resource ceilings, production
transactional installation, merged per-patch boundary ranges, CAD/STL replacement,
orientation/draft/history integration, axial solve/refinement evidence, corpus
extension and packaging belong to plan 29. They have not been declared complete.

WASM measurements report capacity high water, not live heap or whole-browser
memory. Only small fixtures were measured. General STL repair remains out of
scope; numerical uncertainty must produce a visible rejection.

## Owner response

Not yet received. Record the actual response and date here; do not infer
acceptance from automated checks or the request to implement both plans.
