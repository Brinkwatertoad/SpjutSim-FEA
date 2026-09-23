# Plan 41: Manual local mesh refinement and quality inspection

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1

**Goal:** Refine selected CAD regions while retaining a coarser global mesh and inspecting where poor elements occur.

**Architecture:** Small CAD-region sizing definitions extend the mesher request; Gmsh-specific size fields stay inside the backend. The controller owns mesh invalidation, and display quality fields consume explicit mesh metadata.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 2.2, 5.4, 7, 10, 13, 15.3, 19–20; extend the manual-local-sizing contract before implementation.

## Dependencies and boundaries

- Post-v1, after Plan 40 so local quantities can be tracked meaningfully; compatible with case/shared-mesh ownership.
- First delivery: target size on selected faces and a bounded transition to global sizing. No adaptive error estimator, automatic singularity refinement, or unrestricted Gmsh option editor.
- Local controls are an advanced Mesh option; active refinements remain summarized.
- Tiny features cannot bypass memory preflight or the WASM cap.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/analysis/mesh-refinements.js` for face/size/transition definitions and validation.
- Extend `workers/mesher-worker.js`, mesher client/protocol, `web/js/mesh/volume-mesh.js` and quality metadata.
- Modify mesh authoring, glyph/region preview, history, project/replacement mapping and case mesh fingerprints.
- Extend `convergence-runner.js` to record actual combined sizing definitions.
- Create `tests/browser/local-mesh-tests.html/js` and native/geometry-independent metadata validation tests as appropriate.

## Work

### 1. Specify and test sizing behavior

- [ ] Define SI local target size and transition distance on CAD faces, deterministic overlap resolution using the finer applicable target, and global minimum/maximum bounds.
- [ ] Choose supported Gmsh sizing APIs against the pinned runtime and record resulting field/options explicitly; no new mesher dependency.
- [ ] Add tests for invalid/missing faces, competing regions, transformed geometry, suppressed/deleted refinement, project restore and shared-case invalidation.

### 2. Generate and inspect local meshes

- [ ] Show selected refinement regions and estimated implications without promising exact node counts. Run meshing in disposable workers and retain existing quality/memory checks.
- [ ] Verify positive Tet4/Tet10 Jacobians, preserved curved boundaries, stable face assignments, deterministic settings and finer actual sizes near selected regions.
- [ ] Add a mesh-quality display/locate action from cached quality metadata, naming the metric and indicating sampled limitations.
- [ ] Integrate cancellation and failures without replacing a valid setup with partial mesh data.

### 3. Connect convergence and evidence

- [ ] Define how global refinement scales both global and local targets and transitions, recording each level's settings for reproducibility.
- [ ] Compare global-only and local-refined meshes on a nonsingular hole/fillet benchmark using pinned measurements and numerical acceptance criteria.
- [ ] Show unresolved stress/singularity status even when local refinement increases a peak; refinement is not an automatic fix.
- [ ] Measure mesher/renderer/solver memory and preserve sequential worker heaps. Update resource evidence for highly concentrated meshes.

## Verification and acceptance

Run real pinned-Gmsh tests on planar and curved CAD, size-distribution/quality tests, analytical or matched-reference convergence, and all affected worker/project/case/history suites. Include synthetic cap rejection before large allocations and file-mode packaging. Run complete applicable suites with recorded resource comparisons.

## Owner walkthrough

Refine a hole/fillet from Mesh options, inspect its region/quality, compare displacement and local stress across levels, reopen the project and find the active refinement with advanced controls collapsed.

Record actual implementation evidence and the owner's response in `docs/reviews/41-local-mesh-controls.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
