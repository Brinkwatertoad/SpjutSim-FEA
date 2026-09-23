# Plan 35: Local directions and planar sliding/symmetry supports

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Implementation of this plan does not authorize publication.

**Status:** Implemented — pending owner walkthrough ([evidence](../reviews/35-local-directions-and-supports.md))

**Goal:** Let users express loads and restraints relative to a part or planar face with physically correct local constraints.

**Architecture:** Validated local frames are application contracts. Directional loads transform to global vectors; native constraint processing handles independent local translation conditions through a symmetric transformation/elimination and recovers global reactions.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 5.7, 6.5, 8.6–8.8, 9, 14.3, 16, 19–20 and 26.

## Dependencies and boundaries

- Requires Plans 30–33 for persistence, UI and geometry interaction.
- Supports remain linear displacement conditions; no contact, friction, cylindrical sliding, springs or rigid connectors.
- First deliverable includes a user-defined rectangular frame and a reliably identified planar-face normal. Curved faces cannot silently become planar restraints.
- Preserve existing global support/force definitions and behavior; the optional frame choice is local to an editor.
- Initial frame ownership is explicit: global/manual frames stay global; CAD-attached frames follow defined geometry orientation and require replacement review.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/geometry/local-frame.js`: SI origin/orthonormal basis validation, transforms and geometry-reference ownership.
- Extend `geometry-model.js` and `workers/mesher-worker.js` for validated planar descriptors, with protocol/client validation.
- Modify `web/js/analysis/analysis-contracts.js`, `solver-input.js`, `constraint-stability.js`, `assignment-draft.js`, `app-controller.js` and `project-document.js`.
- Modify `web/js/ui/analysis-authoring-ui.js`, summaries, reports and `web/js/render/analysis-glyphs.js`.
- Create `native/fem/include/spjutsim/constraint_basis.hpp` and `native/fem/src/constraint_basis.cpp` if the basis/consistency subsystem warrants independent ownership; integrate with existing assembly/constraint/reaction paths and C ABI/WASM bridge.
- Create `tests/browser/local-frame-tests.html/js` and `local-support-workflow-tests.html/js`; add native local-constraint benchmarks.

## Work

### 1. Define frames and authoring semantics

- [x] Add tests for orthonormal/right-handed bases, invalid axes, normal sign, unit conversion and global/CAD-attached orientation rules.
- [x] Define a versioned frame reference plus local force/support components; show both entered local components and a compact global direction preview.
- [x] Add planar sliding/symmetry presets constraining normal motion with tangential freedom. Explain symmetry assumptions without scaling user loads automatically.
- [x] Extend history, suppression, persistence, remeshing and replacement mapping to all new references before enabling the UI.

### 2. Implement exact local constraints

- [x] Add failing native tests for rotated prescribed displacement, local/global overlap, dependent equal constraints and incompatible constraints on shared nodes.
- [x] Build a rank-revealing independent constraint basis per affected node; use an orthogonal congruence or equivalent verified elimination preserving symmetry and PCG's SPD assumptions. Do not use a penalty constant or round to a global axis.
- [x] Transform loads/displacements consistently and recover reactions in global coordinates. Update rigid-mode checks using actual local directions.
- [x] Validate the C ABI/worker schema, exact topology/memory preflight and stale-reply behavior; rebuild WASM and local worker wrappers reproducibly.

### 3. Verify rotational equivalence and usability

- [x] Solve a rotated axial cube/bar with corresponding local constraints/force and compare with its global-axis equivalent using existing Section 16 displacement/stress/equilibrium criteria.
- [x] Compare a valid symmetry half-model against the full-model solution with explicitly scaled geometry/loading; test a tangential free mode remains underconstrained.
- [x] Verify Tet4/Tet10, nonzero prescribed values, conflicting intersecting faces, cancel/undo/reopen and load-arrow orientation on all signed axes.
- [x] Benchmark per-node basis storage/work and confirm existing global-only cases avoid unnecessary transforms.

## Verification and acceptance

Run native patch/rotation/conflict tests before browser integration, then real WASM local-support and existing authoring/constraint/solver/project/report suites. A transformed symmetric system, correctly diagnosed rank and global reaction equilibrium are required; visual glyph tests alone are insufficient. Update Section 16 benchmark records for new acceptance cases and run complete applicable suites.

## Owner walkthrough

Apply a normal sliding support to an inclined plane, inspect free directions, apply a force in a local frame, and solve. Rotate/reopen the model and verify the declared ownership rules. Try a curved face and conflicting supports to check actionable rejection.

Record actual implementation evidence and the owner's response in `docs/reviews/35-local-directions-and-supports.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
