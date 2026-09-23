# Plan 39: Load cases and material comparison

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document plans future implementation and does not authorize publication.

**Status:** Planned — post-v1

**Goal:** Compare several named operating conditions or material choices without rebuilding a part setup from scratch.

**Architecture:** A project owns shared source/orientation and compatible meshes; each case owns engineering definitions, revision/readiness, and result identity. Only one bulk result is resident by default, with compact comparison summaries retained for other cases.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 2.2, 4.4–4.5, 5.6–5.7, 15.3, 16 and 20.1; post-v1 extension requires those contracts/checklists to be updated before implementation.

## Dependencies and boundaries

- Post-v1: begin after accepted Plan 38 and Task 20 release acceptance. Depends on Plans 30–37.
- A single-case project keeps the familiar interface. Loads options offer Load cases; a persistent selector appears once multiple cases exist.
- One CAD body per project and one material per case. Geometry/orientation edits affect all dependent cases explicitly.
- Initial comparison is independent static solves. No scalar stress/FoS superposition, automatic optimization or simultaneous solver workers.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Create `web/js/analysis/analysis-cases.js`: case identity, duplication, active case and shared-resource references.
- Evolve `analysis-document.js`, `app-controller.js`, `solve-readiness.js`, history, solver input and project codecs/recovery.
- Create `web/js/ui/case-comparison.js` for named selector, actions and compact comparison table; integrate existing setup/result controls.
- Extend result/report schemas and `tests/browser/project-workflow-tests.js`; create `load-case-tests.html/js` and `case-comparison-tests.html/js`.

## Work

### 1. Migrate the single-case contract

- [ ] Define case-owned supports/loads/gravity/material/solve settings and shared source/orientation/mesh resources, with explicit mesh fingerprints when settings differ.
- [ ] Migrate a v1 project to one named case without changing any physical values or result validity. Add tests before changing controller ownership.
- [ ] Define history per case and shared-geometry invalidation; retain monotonic IDs and block unsafe case switching with dirty drafts.

### 2. Author and solve alternatives

- [ ] Add create/duplicate/rename/delete/select through the contextual entry point. Reuse the existing editor controls rather than mounting a second setup.
- [ ] Clone small definitions, not source/mesh/result arrays. Changing one case invalidates only its affected derived data; shared geometry changes invalidate all dependents.
- [ ] Solve cases sequentially with per-case checks, memory confirmation, progress/cancel and stale-worker guards. Case switching must not install another case's late result.
- [ ] Reuse assembled/prepared numerical data only after an independently verified dependency match; initial correctness may use ordinary disposable workers.

### 3. Compare and persist

- [ ] Compare displacement, raw stress/FoS, mass, reactions and convergence with matching units and explicit definitions. Retain warnings and source/case revision labels.
- [ ] Support a common display range when switching comparable fields; never compare independent auto-colored contours as equal scales.
- [ ] Default to one resident full result plus small summaries, optionally loading saved results on demand under a byte budget. Switching/closing releases unneeded buffers.
- [ ] Extend project optional-result selection, recovery, reports and invalid-schema handling. Report each case's own validity; no stale mixed-case export.

## Verification and acceptance

Independent solves of copied cases must match their standalone equivalents at existing numerical tolerances. Test material/load/support edits, shared-mesh changes, import/replacement, save migration, cancelled sequential runs and late responses. Measure retained memory while switching many cases and prove it does not grow with full-result count. Run complete applicable suites and direct-local project workflows.

## Owner walkthrough

Start with one ordinary setup, discover Load cases, duplicate it for a side load and compare results. Change material in one case, reopen the project and inspect which results remain valid. Verify compact mode still shows the selected case.

Record actual implementation evidence and the owner's response in `docs/reviews/39-load-cases-and-comparison.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
