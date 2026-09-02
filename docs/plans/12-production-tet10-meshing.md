# Task 12: Generate production Tet10 meshes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated, renderer-compatible Tet10 mesh path while preserving Tet4 as the working debug/reference solve path.

**Architecture:** Generalize the application mesh contract by element type, and carry two explicit boundary representations: quadratic Tri6 faces for solver integration and linear render triangles for picking and display. Keep Gmsh ordering knowledge inside the mesher adapter; downstream code consumes documented application ordering and typed arrays.

**Tech Stack:** Plain JavaScript, Gmsh/OpenCASCADE WASM worker, typed arrays, Three.js, static browser test harness.

**Spec:** `spec.md` Sections 3.4, 5.4, 7, 8.4, 10.2, 18, 19, and Milestone 3.

## Global constraints

- Preserve dependency-free plain JavaScript and direct `file://` execution.
- Keep meshing off the main thread and transfer bulk `ArrayBuffer` ownership.
- Do not expose Gmsh APIs, element tags, or wrapper objects outside `workers/mesher-worker.js`.
- Tet4 remains available and solve-capable until Task 13 proves Tet10 end to end.
- Do not tune quality thresholds without recording the fixture/benchmark evidence.

---

## Starting point

`web/js/mesh/volume-mesh.js` and `workers/mesher-worker.js` currently accept
only `elementType: 'tet4'`, extract Gmsh type-4 tetrahedra and type-2 boundary
triangles, and assume four connectivity entries per element. Rendering,
selection, support/load glyphs, and the Tet4 solver all consume the same linear
boundary triangles. This task separates solver-order boundary data from display
triangulation before adding quadratic elements.

## Implementation

- [ ] **Generalize mesh settings and result contracts.** Update
  `web/js/mesh/volume-mesh.js`, `web/js/analysis/analysis-document.js`,
  `web/js/workers/mesher-client.js`, and `workers/mesher-worker.js` so
  `elementType` accepts `tet4` or `tet10`, derives nodes-per-element from a
  single descriptor, and validates every typed-array length and index. A Tet10
  result carries ten volume nodes per element, six solver nodes per boundary
  face, and separate three-node display triangles grouped by the same stable
  `FaceId` ranges.
- [ ] **Lock down ordering and boundary orientation.** Define one documented
  application ordering for Tet10 and Tri6 nodes beside the extraction code,
  convert Gmsh type 11 and type 9 connectivity into it, and test corner-node,
  mid-edge-node, face-orientation, and outward-normal relationships on the cube.
  Derive the table from the pinned Gmsh element properties/node-ordering
  documentation rather than memory. Unknown/mixed element blocks fail with a
  structured mesh error.
- [ ] **Generate and optimize second-order meshes.** For Tet10 requests, create
  the 3D mesh, convert/set it to second order, run the selected high-order
  optimization supported by the pinned Gmsh build, and report distinct
  generate/upgrade/optimize/extract progress. Keep Coarse/Normal/Fine sizes and
  custom min/max controls shared with Tet4; expose element order as the
  `tet4`/`tet10` choice rather than raw Gmsh options.
- [ ] **Make quality metadata element-aware.** Extend the quality contract with
  the named Gmsh metric, minimum/p05/median, poor count, characteristic-size
  range, edge/aspect indicator, and Jacobian status. Tet10 validity samples the
  isoparametric Jacobian at a named fixed sample set containing the four
  stiffness quadrature points that Task 13 will share; a negative/inverted or
  near-zero sample is a hard no-mesh/no-solve failure, while poor but valid
  quality remains a warning.
- [ ] **Keep visualization consumers linear and stable.** Update
  `web/js/mesh/mesh-display.js`, `web/js/analysis/solver-input.js`,
  `web/js/render/analysis-glyphs.js`, and `web/js/render/viewport-controller.js`
  so display, picking, and glyph sampling use display triangles, while solver
  input preserves Tri6 connectivity. Remeshing must retain CAD `FaceId`
  selection and replace—not accumulate—GPU resources.
- [ ] **Add the authoring choice without prematurely changing the production
  default.** Add Tet10 to the Mesh editor and summaries, invalidate mesh/results
  when element type changes, and visibly explain that Tet10 mesh inspection is
  available while Tet10 Solve remains disabled until Task 13. Keep a fresh
  document on Tet4 during this transition.
- [ ] **Regenerate worker wrappers and update documentation.** Run
  `python3 tools/build-local-runtime.py`; update `README.md` with the temporary
  Tet10-mesh/Tet4-solve boundary and document the finalized mesh fields near
  their validators.

## Verification

- Extend `tests/browser/tet4-mesh-tests.js` or add
  `tests/browser/tet10-mesh-tests.{html,js}` to mesh the STEP, IGES, and BREP
  cube plus the curved fixtures at both orders. Assert connectivity arity,
  mid-edge placement, Tri6/display boundary coverage, stable `FaceId` ranges,
  positive sampled Jacobians, quality summaries, and increasing preset density.
- Extend `tests/browser/analysis-authoring-tests.js` and
  `tests/browser/worker-runtime-tests.js` for element-type invalidation,
  transferable buffers, unsupported/mixed blocks, structured failures, and the
  temporary solve gate.
- Run `python3 -m unittest discover -s tests`, all browser mesh/selection/
  authoring harnesses from their documented modes, and direct-local startup.
  Record Gmsh version and any quality-option choice in the test/fixture notes.

## Done when

Tet10 meshes can be generated, inspected, selected, and projected into a
solver-ready contract without losing quadratic boundary information; invalid
quadratic elements cannot reach Solve; and the existing Tet4 vertical slice
still passes unchanged.
