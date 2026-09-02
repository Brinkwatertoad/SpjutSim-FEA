# CAD Import and Model Orientation Implementation Plan

> **For Codex:** Execute this plan in order with focused tests at each contract boundary. This package directly replaces STEP-specific alpha contracts; do not add aliases or compatibility readers.

**Goal:** Import STEP, IGES, and OpenCASCADE BREP through one format-neutral local worker path, and let users rotate the active part or align a selected face normal while preserving global loads/supports and invalidating mesh/results.

**Architecture:** Retain canonical `sourceBytes` plus `sourceFormat` in the application controller. Geometry owns an orthonormal rigid orientation contract. Pure geometry helpers transform preview buffers/bounds and compute face-normal alignment; the mesher worker applies the same orientation to returned solver coordinates. The compact Model editor owns import-neutral orientation controls.

**Constraints:** Plain dependency-free JavaScript, direct `file://` execution, transferable typed arrays, disposable workers, no STL/OBJ, and no backward compatibility for `stepBytes` or STEP-only names.

---

### Task 1: Replace STEP-specific browser contracts

**Files:**
- Modify: `web/js/geometry/geometry-model.js`
- Modify: `web/js/analysis/app-controller.js`
- Modify: `web/js/workers/mesher-client.js`
- Modify: `web/js/app.js`
- Modify: `web/js/ui/ui-controller.js`
- Modify: `web/index.html`
- Test: `tests/browser/worker-runtime-tests.js`
- Test: `tests/test_framework.py`

**Steps:**
1. Add failing contract tests for extension-to-format detection, format/name agreement, non-empty `sourceBytes`, and neutral controller retention.
2. Add `sourceFormatForFilename`, supported-format metadata, and format-neutral request/model validation for STEP/STP, IGES/IGS, and BREP.
3. Replace `stepSource`/`stepBytes` with `geometrySource`/`sourceBytes` throughout first-party application and client code.
4. Update the file input, menu text, progress/errors, and accept list to say CAD rather than STEP.
5. Run Python and worker-runtime tests; commit.

### Task 2: Extend worker import and remesh protocols

**Files:**
- Modify: `workers/mesher-worker.js`
- Regenerate: `web/generated/local-runtime/mesher-worker-source.js`
- Modify: `tests/browser/step-import-tests.html`
- Modify: `tests/browser/step-import-tests.js`
- Add: `tests/fixtures/generated-unit-cube-m.iges`
- Add: `tests/fixtures/generated-unit-cube-m.brep`
- Modify: `tests/fixtures/README.md`

**Steps:**
1. Add failing browser cases importing a one-meter cube in IGES and BREP plus extension/format mismatch rejection.
2. Validate `sourceFormat` and `sourceBytes` in import and mesh requests.
3. Choose the temporary extension and OpenCASCADE `importShapes` format from the validated format; keep stable diagnostics format-neutral.
4. Return the requested `sourceFormat` and restore geometry with the same format for remeshing.
5. Generate the worker wrapper with `python3 tools/build-local-runtime.py` and run import/mesh browser suites; commit.

### Task 3: Add pure rigid-orientation contracts

**Files:**
- Add: `web/js/geometry/rigid-orientation.js`
- Modify: `web/js/geometry/geometry-model.js`
- Modify: `web/index.html`
- Test: `tests/browser/analysis-authoring-tests.html`
- Test: `tests/browser/analysis-authoring-tests.js`
- Test: `tests/test_framework.py`

**Steps:**
1. Add failing tests for identity validation, signed global-axis composition, transformed positions/normals/bounds, and orthonormal determinant-one enforcement.
2. Define a frozen orientation value with a row-major 3x3 rotation matrix and concise Euler-free summary/history.
3. Implement pure matrix/vector composition and geometry-preview transformation without mutating source buffers.
4. Make every imported geometry include identity orientation and validate it as part of the public model contract.
5. Run focused tests; commit.

### Task 4: Apply orientation to meshing and invalidation

**Files:**
- Modify: `web/js/analysis/app-controller.js`
- Modify: `web/js/workers/mesher-client.js`
- Modify: `workers/mesher-worker.js`
- Regenerate: `web/generated/local-runtime/mesher-worker-source.js`
- Modify: `tests/browser/worker-runtime-tests.js`
- Modify: `tests/browser/tet4-mesh-tests.js`

**Steps:**
1. Add failing tests that orientation preserves material/support/load/face IDs, clears mesh/preflight/results, and advances analysis revision.
2. Add the controller orientation command using the pure transformed geometry contract.
3. Include orientation in mesh requests and rotate returned node positions in the worker before transfer.
4. Verify a 90-degree cube mesh has transformed coordinates, positive Tet4 volumes, and stable boundary face mappings.
5. Regenerate the worker wrapper, run focused suites, and commit.

### Task 5: Rotate about global axes from the compact Model editor

**Files:**
- Modify: `web/index.html`
- Modify: `web/css/app.css`
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `web/js/ui/setup-inspector-summary.js`
- Test: `tests/browser/analysis-authoring-tests.js`

**Steps:**
1. Add failing UI tests for the default 90-degree angle, X/Y/Z selection, positive/negative application, compact orientation summary, and focus/status behavior.
2. Add compact axis, angle, rotate-positive, rotate-negative, and reset controls inside the one Model editor.
3. Dispatch the controller orientation command; keep force, gravity, and support components global.
4. Show a readable orientation summary in the Model row without expanding ordinary row height excessively.
5. Run focused browser tests; commit.

### Task 6: Align a selected surface normal

**Files:**
- Modify: `web/js/geometry/rigid-orientation.js`
- Modify: `web/js/analysis/app-controller.js`
- Modify: `web/index.html`
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Test: `tests/browser/analysis-authoring-tests.js`

**Steps:**
1. Add failing tests for area-weighted outward normals, shortest rotation, deterministic antiparallel handling, non-planar warning, and degenerate-face rejection.
2. Implement pure selected-face normal analysis from preview triangles and current orientation.
3. Add the controller command to align one selected face with ±X/±Y/±Z.
4. Add the direction selector and Orient action to the inline Model editor, with actionable validation and warning feedback.
5. Run focused tests; commit.

### Task 7: Integrate documentation and verify the package

**Files:**
- Modify: `README.md`
- Modify: `spec.md`
- Modify: `tests/browser/cube-wasm-vertical-slice-tests.js`
- Modify: remaining STEP-specific tests/call sites found by `rg`

**Steps:**
1. Remove superseded STEP-only and `stepBytes` wording from first-party contracts and tests; retain historical/license references only where accurate.
2. Document supported extensions, global-coordinate behavior, orientation invalidation, and direct-local test coverage.
3. Review the complete diff for accidental source-buffer mutation, extra full-mesh passes, worker transfer ownership, stale generated code, and duplicate UI state.
4. Run all Python tests, native CTest targets, direct-file browser suites, HTTP CAD/mesh/WASM suites, and the direct-file app smoke test.
5. Commit the completed package and proceed to component supports/stability diagnostics.
