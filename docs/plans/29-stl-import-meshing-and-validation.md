# Task 29: STL import, meshing, and validation implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M29 before Task 30. Task 28 must first supply the accepted concrete contract.

**Goal:** Deliver the accepted binary/ASCII STL subset through units, patch selection, Tet10 meshing, setup, and solve.

**Architecture:** Isolate tessellated parsing/validation from the existing OCC adapter, behind the shared geometry contract. Import options persist with original source metadata for disposable-worker reconstruction; all existing analysis consumers use opaque surface IDs.

**Tech Stack:** Classic JavaScript/typed arrays, pinned or explicitly approved Gmsh WASM, existing native FEM, Python fixture/audit tooling.

**Spec:** `spec.md` Sections 6–8, 15.11, 16, 18–21, 26; accepted `docs/designs/stl-import-contract.md` produced by Task 28.

## Dependencies and constraints

- Requires accepted M28, including exact API/version/patch-ID decisions. Confirm the proposed file boundaries below against that accepted design before coding.
- No hidden repair, unit inference from filename, automatic patch reassignment, extra-solid selection shortcut, or native-solver format dependency.
- Existing 50-case STEP/IGES/BREP corpus remains intact. New STL evidence supplements it rather than weakening its expectations.
- Keep large validation/classification/meshing work in disposable workers and preserve preflight/cancellation/source-distribution obligations.

Status: implemented; automated evidence and owner walkthrough are in
[`docs/reviews/29-stl-workflow.md`](../reviews/29-stl-workflow.md). M29 owner acceptance is pending.

## Implementation

### 1. Add the validated import adapter and source contract

**Create:** `workers/stl-import.js` for parsing/topology validation and `web/js/ui/stl-import-ui.js` for unit/patch review, subject to M28's accepted packaging boundary.
**Modify:** `workers/mesher-worker.js`, `web/js/geometry/geometry-model.js`, `web/js/workers/worker-protocol.js`, `web/js/workers/mesher-client.js`, `web/js/analysis/app-controller.js`, `web/js/app.js`, `web/index.html`.
**Create tests:** `tests/browser/stl-import-tests.{html,js}`.

- [x] Add failing parser/contract cases for ASCII/binary, binary headers beginning with `solid`, truncated/count-overflow data, nonfinite coordinates, invalid units, and malformed topology with the exact codes accepted in Task 28.
- [x] Implement the accepted adapter and explicit units/dimension review. Installation is transactional: failed/cancelled input preserves the existing model and setup. Persist unit scale/grouping/normalization settings with source metadata and validate them at both UI and worker boundaries.
- [x] Add patch review with hover/select and grouping adjustment. Show dirty assignment-remap consequences before applying later regrouping; never silently move loads to a newly numbered patch.
- [x] Version affected geometry/worker contracts and update validators consistently. Keep ordinary CAD behavior format-neutral downstream.

### 2. Complete remeshing, orientation, replacement, and analysis

**Modify:** `workers/mesher-worker.js`, `web/js/mesh/volume-mesh.js`, `web/js/mesh/mesh-display.js`, `web/js/geometry/rigid-orientation.js`, `web/js/analysis/replacement-migration.js`, `web/js/ui/replacement-migration-ui.js`, relevant glyph/selection adapters.
**Create tests:** `tests/browser/stl-mesh-solve-tests.{html,js}`.

- [x] Test patch identity across fresh-worker remeshing, rigid orientation, and explicit replacement mapping. Exercise both CAD→STL and STL→CAD assignment transfer with accept/drop/cancel behavior.
- [x] Preserve six-node Tet10 solver boundary faces, separate display triangles, positive Jacobians, patch boundary ownership, and correct pressure/total-force integration. Do not invent smooth CAD curvature from a faceted STL boundary.
- [x] Run a planar STL cube axial/symmetry case against the existing analytical displacement/stress/equilibrium tolerances. Compare curved STL to its documented faceted geometry and refinement evidence, not an unexplained exact-CAD expectation.
- [x] Verify draft preview, Apply, checks, solve, FoS/probe/peak, undo boundaries, cancellation, and convergence with imported patches.

### 3. Package, audit, and document the supported subset

**Modify:** `tools/build-local-runtime.py`, `tests/fixtures/corpus-v1.json`, `tools/cad_corpus.py`, `tests/test_cad_corpus.py`, `tests/browser/cad-corpus-tests.js`, `tests/fixtures/README.md`, `README.md`, `spec.md`; distribution manifests only when generated payloads change.

- [x] Extend the corpus with licensed valid and rejected STL cases and exact expected classifications. Add storage/resource limits from Task 28 evidence; never relax existing quality/corpus gates to make the import pass.
- [x] Package worker helpers reproducibly for both local and HTTP paths. Run `python3 tools/build-local-runtime.py`; rebuild Gmsh only if M28 approved the change, and refresh its source/hash/license records if rebuilt.
- [x] Run complete Python/native/browser suites, existing CAD corpus, STL corpus, validation-record checks, and affected resource/distribution audits. Report measured STL memory and cancellation behavior. Update capability claims only after tests pass.

## Manual review M29 — STL end-to-end, about 20 minutes

- [ ] Owner imports a known-dimension binary and ASCII part, confirms units, selects patches, applies supports/load, meshes, explicitly checks, and solves.
- [ ] Inspect a curved part's grouping and faceted appearance; try an invalid/open file, remesh, replace, cancel, and recover without losing prior work.
- [ ] Confirm rejected cases explain what the user can fix and do not imply arbitrary STL repair support. Record acceptance before Task 30.

## Done when

The accepted STL subset has complete numerical, topology, direct-local, and usability evidence and M29 is accepted. It is not yet release acceptance.
