# Plan 32: Contextual controls, editing language and guided workflow

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. This document records implementation scope and does not authorize publication.

**Status:** Implemented — automated verification recorded; owner walkthrough pending. See [review](../reviews/32-contextual-workflow.md).

**Goal:** Keep everyday setup simple while making optional controls discoverable and messages actionable.

**Architecture:** One existing state model and one set of controls serve compact and expanded views. Presentation preferences only control disclosure; controller readiness/orchestration remains authoritative.

**Tech stack:** Existing plain JavaScript/HTML/CSS, browser workers and typed arrays, Python/CMake/CTest, and first-party C++/WASM where named. No new application dependencies.

**Spec:** `spec.md` Sections 3, 4.4–4.5, 15, 18 and 20.1.

## Dependencies and boundaries

- Follows Plans 30–31. Does not introduce load cases or advanced physics.
- Preserve toolbar arrangement and current Stress/Deformation interaction.
- Remove the top View menu only after its full command/keyboard paths are verified elsewhere.
- No separate Simple/Advanced application or duplicate forms.
- Pull feature-local accessibility, resize, cancel/retry and novice walkthrough checks forward from former Plan 30.

The shared execution, evidence, performance, and review rules in [the plan index](README.md#execution-and-review-rules) apply. Preserve direct `file://` and optional HTTP execution. Keep UI disclosure preferences separate from engineering state.

## Files and responsibilities

- Modify `web/index.html`, `web/css/app.css`, `web/js/ui/ui-controller.js`, `analysis-authoring-ui.js`, `setup-inspector-summary.js` and `workspace-layout.js`.
- Modify `web/js/analysis/solve-readiness.js` and `web/js/app.js` for explicitly requested Mesh and solve sequencing; extract an operation coordinator only if its independent lifecycle warrants it.
- Modify `web/js/render/viewport-controller.js` only for command accessibility, not unrelated rendering changes.
- Add small local example definitions/assets under `web/examples` using reproducible first-party CAD fixtures.
- Extend workspace, navigation, authoring, draft, solve-workflow and report browser harnesses; create `tests/browser/contextual-workflow-tests.html/js`.

## Work

### 1. Add contextual options without changing active setup

- [x] Use consistent options/disclosure icons with accessible names, focus/hover help and adequate hit areas. Keep menu contents descriptive and active advanced settings summarized.
- [x] Put formulation options behind an always-visible Mesh-row icon, retain Tet10 by default, and summarize nondefault choices. No separate enabling preference.
- [x] Remove View from the top menu; verify signed views, Fit, Reset and Perspective remain keyboard-accessible at the viewport.
- [x] Test expansion/collapse, theme and keyboard behavior without numerical revision or DOM form duplication.

### 2. Make editing and feedback consistent

- [x] Use Apply for setup commits, Save project for files and Save to material library for catalog persistence. Preserve existing transactions, unique-name validation and focus return.
- [x] Place field errors beside controls and assignment errors within the editor; focus the first invalid field on failed Apply. Coalesce announcements and avoid validation noise during incomplete typing.
- [x] Use a dismissible viewport guide pointing at the next control, with remembered dismissal and Help reenable; lead Results with displacement/stress/available FoS/convergence and retain visible warnings.
- [x] Add Duplicate and explicitly named Suppress/Include controls for assignments in contextual options, with model-owned enabled state, history, persistence, rank/preflight and report updates. Keep Show/hide presentation distinct. Suppressed definitions remain visible and do not enter numerical inputs. Add regression tests before extending this public contract.

### 3. Improve starting and running a check

- [x] Offer Import CAD… and Open Cube Example directly in an empty viewport without a placeholder solid. Apply the cube's recommended setup before displaying Mesh and solve guidance. Guide dismissal is remembered; recovered projects stay quiet. Loading an example never silently solves.
- [x] Offer explicit Mesh and solve when setup is valid but no current mesh exists. Reuse generation → checks → solve with stage progress, cancellation, late-reply guards, worker disposal and unchanged memory confirmations.
- [x] Retain independent Generate mesh and Run checks only. Test cancellation at every stage, setup edits blocked appropriately, failed-stage retry and no automatic continuation after a cancelled request.

### 4. Complete the local usability/performance pass

- [ ] Use an asymmetric/curved part for small-pane, 125%/200% zoom, 2× DPI, keyboard, reduced-motion and theme checks.
- [ ] Check that a beginner can import, apply material/support/load and run without opening advanced controls.
- [ ] Remove redundant status formatting/event paths in touched modules without broad rewrites; verify bounded DOM/overlay updates.

## Verification and acceptance

Extend meaningful contract and workflow tests for suppression/duplication, dirty tracking, history and serialization, project controls, View-menu command preservation, and cancel/retry identity. Run complete applicable suites and direct-local startup after script/asset changes. Measure ordinary edits/disclosure toggles and confirm they do not rebuild meshes or traverse result arrays.

Implementation and automated checks are complete. Any unchecked composite task retains
its measurement/manual-review portion; see the review for exact evidence and limits.

## Owner walkthrough

Complete one example and one own-model setup with advanced controls collapsed. Discover Tet4/options by icon, then reopen a project that uses an advanced setting. Find all former View commands, duplicate/suppress a load, correct a nearby error, and cancel Mesh and solve mid-operation.

Record actual implementation evidence and the owner's response in `docs/reviews/32-contextual-workflow.md`. Do not prefill acceptance or reuse historical passes for changed inputs.
