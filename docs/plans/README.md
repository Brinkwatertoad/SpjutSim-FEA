# Near-term development plans

Tasks 01–10 established the portable geometry path and the first trusted Tet4
browser vertical slice. Task 11 then consolidated the priority authoring and
presentation work. Its feature packages and compact-Mesh/delete-mesh regression
follow-up are complete.

Task 12 and Task 13's implementation make Tet10 the production mesh/solve path.
Task 14 and Task 15 provide the implemented Milestone 4 trust and convergence
workflow. The original feature path is complete through Task 15. Tasks 16–19
supplied
validation, corpus, resource, and distribution evidence. **v1.0 remains
unreleased:** the owner approved the interface/result/STL improvement sequence
on 2026-09-07. Tasks 21–30 and their manual reviews now precede Task 20
candidate acceptance; passing older gates does not waive this work.

1. [x] [Complete the portable runtime foundation](01-portable-runtime-foundation.md)
2. [x] [Prove the Gmsh local-runtime path](02-gmsh-local-runtime-spike.md)
3. [x] [Implement STEP import and the geometry contract](03-step-import-and-geometry.md)
4. [x] [Render geometry and select CAD faces](04-preview-rendering-and-face-selection.md)
5. [x] [Generate and extract a Tet4 mesh](05-tet4-mesh-extraction.md)
6. [x] [Complete viewport navigation and settings](06-viewport-navigation-and-settings.md)
7. [x] [Validate and render CAD and mesh surfaces](07-surface-and-mesh-visualization.md)
8. [x] [Author material, supports, and loads](08-material-support-and-load-authoring.md)
9. [x] [Implement the trusted Tet4 solver and preflight model](09-trusted-tet4-solver-and-preflight.md)
10. [x] [Integrate WASM solve and first result views](10-wasm-solve-and-result-views.md)
11. [x] [Complete priority release features](11-priority-release-features.md)
12. [x] [Generate production Tet10 meshes](12-production-tet10-meshing.md)
13. [x] [Solve Tet10 models and calibrate resource use](13-tet10-solver-and-resource-calibration.md) — completed; Task 18 records the calibrated browser evidence
14. [x] [Complete factor-of-safety and result trust views](14-factor-of-safety-and-result-trust.md)
15. [ ] [Deliver convergence, validation, and the v1.0 release gate](15-convergence-validation-and-v1-release.md) — workflow, validation, corpus, resources, and distribution complete; Tasks 21–30 improvements/manual reviews and Task 20 candidate acceptance remain open (see `../release/v1-acceptance-audit.md`)
16. [x] [Complete the reference validation matrix](16-reference-validation-matrix.md)
17. [x] [Establish the release CAD regression corpus](17-cad-regression-corpus.md)
18. [x] [Calibrate browser resources and production solver settings](18-browser-resource-calibration.md)
19. [x] [Resolve distribution licensing and artifact compliance](19-distribution-licensing-decision.md) — GPL path and final policy/artifact list approved; staged audit passes
20. [ ] [Audit and produce the v1.0 release candidate](20-v1-release-candidate.md) — final audit after accepted Task 30; preliminary checks may be reused only within their documented scope

Each task should leave the repository usable from both `file://` and the
optional HTTP server.

Do not mark Task 15 or Task 20 complete merely because features exist. Tasks
16–19 own the remaining evidence that closes Task 13/15 carry-forward items.
Benchmark-dependent choices—quality warning thresholds, memory safety factor,
solver/preconditioner tuning, browser support, and any threaded WASM build—are
resolved only from the measurements named in Tasks 16–18. Task 19 requires an
explicit copyright-holder distribution decision; Task 20 consumes all four
records and must remain blocked while any Section 26 gate is unchecked.

## Approved pre-v1 implementation sequence

Execute in the current agent, following repository AGENTS.md. These are plans,
not completed features. Each package includes nontrivial regression tests,
documentation, one complete-diff review, the complete applicable suites from the
repository README, and the manual checkpoint below. Do not create tests that
merely mirror implementation or turn each mechanical step into an approval gate.

21. [x] [Responsive workspace and overlays](21-responsive-workspace-and-overlays.md) — implemented and M21 accepted 2026-09-08
22. [x] [Stress extrema and result clarity](22-stress-extrema-and-result-clarity.md) — implemented and M22 accepted 2026-09-08
23. [x] [Orthographic camera and interactive gizmo](23-orthographic-camera-and-view-gizmo.md) — implemented and M23 accepted 2026-09-08
24. [ ] [Contextual display controls and stress legend](24-display-controls-and-stress-legend.md)
25. [ ] [Support/load preview authoring](25-support-and-load-preview-authoring.md)
26. [ ] [Setup workflow and solve checks](26-setup-workflow-and-solve-checks.md)
27. [ ] [Engineering edit undo/redo](27-engineering-edit-undo-and-redo.md)
28. [ ] [STL feasibility and surface patch contract](28-stl-feasibility-and-surface-patch-contract.md)
29. [ ] [STL import, meshing, and validation](29-stl-import-meshing-and-validation.md)
30. [ ] [Integrated usability and pre-release regression](30-integrated-usability-and-pre-release-regression.md)

The execution order is **21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 20**.
Plan 28 produces the concrete STL contract used by Plan 29. Its experiments must
use the pinned runtime first. A runtime/dependency change or a change to the
supported subset requires the owner's M28 decision. Bounded single-solid STL
support is planned before v1; infeasibility does not silently defer it or waive
the release gate. OBJ, general STL repair, and multi-body analysis stay deferred.
Duplicate/suppress assignment controls and additional unapproved features are
not required by this sequence.

## Manual review schedule

The owner's 2026-09-07 instruction to accomplish a few plans before a manual
check authorizes one implementation batch for **21–23**, including parallel
assistance. This overrides those plans' per-package stop/no-subagent notes for
this batch only. [The combined review packet](../reviews/21-23-review.md) records the owner’s 2026-09-08 acceptance of M21, M22, and M23. Task 24 is next. The later review schedule and all release gates remain unchanged.

This is a milestone schedule, not calendar appointments or automated reminders.
M21–M23 are **Accepted**; later reviews remain **Pending**. Reserve review time when the preceding implementation
is ready, not before a runnable result exists. At each checkpoint the agent must
stop, provide the review packet, and wait for the owner's explicit acceptance
before starting the next plan. Automated checks are necessary but cannot approve
usability on the owner's behalf. Corrections and focused rechecks belong to the
same checkpoint. Silence is not acceptance.

| Gate | Scheduled after | Owner exercise | Suggested time | Record to create at execution |
| --- | --- | --- | --- | --- |
| M21 | Plan 21 | Resize/zoom, split/collapse panes, overlay visibility | 10 min | `docs/reviews/21-workspace.md` |
| M22 | Plan 22 | Read peaks/FoS, explain smoothing, locate peak | 15 min | `docs/reviews/22-result-clarity.md` |
| M23 | Plan 23 | Six views, animated reset, projection switching, picking | 15 min | `docs/reviews/23-camera.md` |
| M24 | Plan 24 | View/field/shape controls, mesh toggle, legend ranges | 15 min | `docs/reviews/24-display.md` |
| M25 | Plan 25 | Add/edit/toggle/preview/Apply/Cancel assignments | 20 min | `docs/reviews/25-assignment-drafts.md` |
| M26 | Plan 26 | Setup → explicit checks → solve, errors and recovery | 20 min | `docs/reviews/26-setup-checks.md` |
| M27 | Plan 27 | Undo/redo with text fields, drafts, and stale results | 10 min | `docs/reviews/27-history.md` |
| M28 | Plan 28 | STL units/patch demo and feasibility/scope decision | 20 min | `docs/reviews/28-stl-contract.md` |
| M29 | Plan 29 | STL import → patch assignments → mesh → solve | 20 min | `docs/reviews/29-stl-workflow.md` |
| M30 | Plan 30 | Combined workflow and final usability acceptance | 30–45 min | `docs/reviews/30-integrated-usability.md` |

### Review packet and record template

Create the record only when implementing the package. Do not prefill acceptance,
fabricate review dates, or mark the plan complete before the owner's response.
The implementer supplies the reproducible starting point and expected behavior;
the owner supplies the usability decision.

```markdown
# Mxx: Package review

- Status: Pending owner review / Changes requested / Accepted
- Implementation commit or exact working-tree description:
- Browser/platform and app path/URL:
- Fixtures and starting setup:
- Automated checks run, results, and evidence paths:
- Short walkthrough (use the plan's named review steps):
- Expected engineering values/behavior:
- Before/after images where useful:
- Known limitations and open issues:
- Owner response and date (leave unrecorded until received):
- Follow-up fixes, recheck evidence, and final decision:
```

## Reusing Plan 20 checks

Run useful Plan 20 checks during these packages, including direct-local startup,
keyboard/focus, cancellation, worker disposal, numerical regression, resource,
and distribution checks. Record their commit/browser/artifact scope. Prior
records remain historical evidence; changes to their inputs invalidate the
corresponding candidate claim. Plan 30 repeats integrated acceptance, and Plan
20 finally binds the complete audit to the exact accepted artifact. No early
version-status change, v1 tag, or publication follows from a partial pass.
