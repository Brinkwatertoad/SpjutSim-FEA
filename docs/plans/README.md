# Development plans

**Status:** v1 is unreleased. The original static-analysis workflow and Plans
21–35 are implemented. M21–M27 have recorded owner acceptance; Plans 28–34 have
implementation verification and remain part of final integrated review.
The owner approved the planning scope and implementation through Plan 34 on
2026-09-22. Plan 35 was implemented on 2026-09-23 at the owner’s request; Plans 36 onward remain planned. Automated verification does not imply
owner acceptance. [Batch evidence](../reviews/30-34-verification.md).

**Pre-v1 order:** **30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 20**.

**Post-v1:** Plans **39–46**, with dependencies stated per plan. Advanced studies
and additional physics do not gate v1. Static single-solid CAD analysis remains
the current supported product; STL is archived.

## Pre-v1 delivery

| Plan | Status | Deliverable |
| --- | --- | --- |
| [28 — Material/load units/reports](28-material-units-and-report.md) | Implemented; [verification](../reviews/28-material-units-and-report.md) | Sourced bulk material strengths, inline load units, dimensions, ZIP reports |
| [29 — DOCX and preferred units](29-document-report-and-unit-preferences.md) | Implemented; [verification](../reviews/29-document-report-and-unit-preferences.md) | Editable DOCX, SI/USCS/custom preferences, Settings sizing |
| [30 — Portable projects](30-portable-projects.md) | Implemented; [verification](../reviews/30-portable-projects.md) | CAD + complete setup by default, opt-in mesh/results, safe transactional open |
| [31 — Local recovery](31-local-recovery.md) | Implemented; [verification](../reviews/31-local-recovery.md) | Automatic reopen, prompt committed setup recovery, source deduplication, File → New |
| [32 — Contextual workflow](32-contextual-workflow.md) | Implemented; [verification](../reviews/32-contextual-workflow.md) | Direct mesh options, View-menu removal, contextual guide, prepared example, explicit Mesh and solve, duplicate/suppress assignments |
| [33 — Model information/selection](33-model-information-and-selection.md) | Implemented; [verification](../reviews/33-model-information-and-selection.md) | Volume/mass without solving, small/obscured-face access, hide/isolate |
| [34 — Report options](34-report-options.md) | Implemented; [verification](../reviews/34-report-options.md) | Complete defaults plus optional notes and selected/current views |
| [35 — Local directions/supports](35-local-directions-and-supports.md) | Implemented; [verification](../reviews/35-local-directions-and-supports.md), owner walkthrough pending | Local frames and physically correct planar sliding/symmetry constraints |
| [36 — Bearing loads](36-bearing-loads.md) | Planned | Validated transverse loading on supported cylindrical bands |
| [37 — Moments/offset forces](37-moments-and-offset-forces.md) | Planned | Declared surface distribution, force/moment balance and offset load reference |
| [38 — Final usability](38-integrated-usability-and-pre-release-regression.md) | Planned | Integrated workflow, resource/compatibility regression, owner acceptance |
| [20 — Exact candidate](20-v1-release-candidate.md) | Pending prerequisites | Bind complete evidence to the final artifact and obtain release authorization |

The basic interface remains one workspace with contextual advanced/options
controls. Options icons need accessible names, focus/hover explanations and
descriptive menu contents. Active settings stay visible in compact summaries.
Keep the toolbar arrangement and current Stress/Deformation interaction.
Remove the duplicate top View menu while preserving its accessible commands.
No long CAD-face list is planned; existing assignment rows locate assignments.

Every pre-v1 feature includes its own usability, failure and performance checks.
The former integrated Plan 30 no longer carries all first-use/resize/keyboard/
cancel/retry work until the end: Plans 30–34 own it for their workflows, and
35–37 own new numerical/authoring validation. Plan 38 tests the combination.

## Post-v1 continuation

These are prepared plans, not shipping capabilities or new v1 release gates.
Execution follows v1 acceptance. Shared numerical/runtime changes must preserve
the validated static workflow. Dependencies permit later reordering if explicitly
chosen; this table is a readable continuation, not permission to run agents in
parallel.

| Plan | First deliverable | Key dependency/limit |
| --- | --- | --- |
| [39 — Load cases/comparison](39-load-cases-and-comparison.md) | Named static cases/material alternatives and compact comparison | Shared compatible meshes; bounded full-result retention |
| [40 — Persistent measurements](40-persistent-measurements.md) | Pinned physical locations, relative displacement, support resultants | Stable source anchors, explicit stress interpolation and overlap attribution |
| [41 — Local mesh controls](41-local-mesh-controls.md) | Manual face refinement/transition and quality inspection | Pinned metrics for convergence; no automatic error-based adaptation |
| [42 — Interior inspection](42-interior-result-inspection.md) | One result section plane with validated interior sampling | Explicit topology retention/interpolation; presentation only |
| [43 — Shell analysis](43-shell-analysis.md) | Explicit midsurface/thickness with a validated static shell formulation | Formulation/rank/locking decision before production integration |
| [44 — Orthotropic materials](44-orthotropic-materials.md) | Homogeneous directional solid elasticity and material axes | Independent of shell delivery; no guessed print allowables or isotropic FoS |
| [45 — Modal analysis](45-modal-analysis.md) | Constrained isotropic solid frequencies/mode shapes | Mass/eigensolver evidence; no damping, prestress or transient response |
| [46 — Thermal expansion](46-thermal-expansion.md) | Uniform prescribed-temperature isotropic static response | Explicit reference temperature/units; no heat-transfer solve |

Plans 43–46 contain concrete formulation/contract decisions as their first work,
then implementation and validation tasks. An unvalidated algorithm is not
silently selected to make a plan appear complete. Acceptance of one physics/domain
does not validate combinations such as orthotropic shells or prestressed modes.

Onshape integration, elastic supports, broader bearing distributions, calibrated
print profiles, automatic geometry simplification and full contact/nonlinear
physics remain future candidates outside this committed sequence. Revisit them
through explicit scoped planning if the owner requests them.

## Execution and review rules

- Follow repository AGENTS.md and execute in the current agent. No subagents or
  new dependencies without the applicable explicit authorization.
- Read the plan and relevant specification sections together. The spec owns
  requirements/contracts; the index owns sequence/status; reviews own evidence.
- Use TDD for changed nontrivial behavior, numerical methods, persistence,
  invalidation and worker protocols. Do not write trivial implementation-mirroring
  tests or require a review gate for each mechanical step.
- Each task is an independently useful deliverable. Record meaningful file/
  interface changes, keep diffs focused, preserve unrelated work, and commit
  coherent chunks only when execution instructions authorize commits.
- Preserve SI engineering state, exact face/reference ownership, validated
  Tet4/Tet10 behavior, diagnostics, deterministic tolerances, coarse versioned
  workers, separate mesher/solver lifetimes and preflight memory limits.
- Preserve dependency-free classic browser scripts and direct `file://` startup.
  Build/package worker/WASM changes reproducibly; never hand-edit generated or
  vendored assets. Follow README for build/test commands.
- Measure affected paths against representative baselines. Avoid repeated
  serialization, full-mesh passes, DOM updates, duplicate bulk arrays and retained
  workers/GPU resources. Record peak memory as well as elapsed time.
- Keep first-party source readable and cohesive; consolidate actual duplicate
  ownership where touched. Do not turn feature delivery into an unrelated rewrite.
- Run focused tests during work, then the complete applicable suites and one final
  complete-diff review. Broaden/repeat checks for new changes or concrete failures.
- Each plan includes an owner walkthrough with fresh implementation evidence.
  Supply a runnable packet and record the actual response; do not equate automated
  tests with manual acceptance. The owner may explicitly group checkpoints.
- Final Plan 38 acceptance is followed by Task 20's exact-candidate audit.
  Tagging/deployment/publication still require explicit authorization.

## Review packet

Create review records when implementing the relevant plan, not during planning.
Each new plan supplies its future `docs/reviews/NN-name.md` location.

```markdown
# Plan NN review

- Status: Pending owner review / Changes requested / Accepted
- Implementation commit or exact working-tree description:
- Browser/platform and app path/URL:
- Fixtures and starting setup:
- Automated checks, numerical/resource evidence and their scope:
- Short owner walkthrough and expected values/behavior:
- Before/after images where useful:
- Known limitations and open issues:
- Owner response/date (record only when received):
- Follow-up fixes, recheck evidence and final decision:
```

## Established foundation and historical evidence

| Plans | Status/evidence |
| --- | --- |
| [01](01-portable-runtime-foundation.md), [02](02-gmsh-local-runtime-spike.md), [03](03-step-import-and-geometry.md), [04](04-preview-rendering-and-face-selection.md), [05](05-tet4-mesh-extraction.md) | Portable runtime, CAD import/picking and Tet4 meshing implemented |
| [06](06-viewport-navigation-and-settings.md), [07](07-surface-and-mesh-visualization.md), [08](08-material-support-and-load-authoring.md), [09](09-trusted-tet4-solver-and-preflight.md), [10](10-wasm-solve-and-result-views.md), [11](11-priority-release-features.md) | Navigation, authoring, native/WASM workflow and priority fixes implemented |
| [12](12-production-tet10-meshing.md), [13](13-tet10-solver-and-resource-calibration.md), [14](14-factor-of-safety-and-result-trust.md) | Production Tet10, calibrated resources and result trust implemented |
| [15](15-convergence-validation-and-v1-release.md) | Convergence/validation implemented; its overall v1 release gate remains open |
| [16](16-reference-validation-matrix.md), [17](17-cad-regression-corpus.md), [18](18-browser-resource-calibration.md), [19](19-distribution-licensing-decision.md) | Numerical/CAD/resource/distribution evidence recorded; changed inputs require revalidation |
| [21](21-responsive-workspace-and-overlays.md), [22](22-stress-extrema-and-result-clarity.md), [23](23-orthographic-camera-and-view-gizmo.md) | Implemented and owner accepted 2026-09-08; [combined review](../reviews/21-23-review.md) |
| [24](24-display-controls-and-stress-legend.md), [25](25-support-and-load-preview-authoring.md), [26](26-setup-workflow-and-solve-checks.md), [27](27-engineering-edit-undo-and-redo.md) | Implemented and owner accepted 2026-09-10; [follow-up review](../reviews/24-27-followup.md) |

Historical owner instructions authorized grouped 21–23 and 24–27 review. They
do not authorize parallel execution or automatic acceptance of the new sequence.
Task 19's GPL/source-accompaniment approval and historical staged checks remain
evidence within their recorded scope; the final artifact still needs Task 20.

## Numbering and history

On 2026-09-22 the owner requested this reorganization:

| Former identity | Current identity |
| --- | --- |
| 31 — Material/load units/report | 28, including its linked review record |
| 32 — DOCX/preferred units | 29, including its linked review record |
| 30 — Integrated usability | 38, expanded to cover the new pre-v1 sequence |
| 28–29 — STL work | Archived branch only; these historical IDs are not current Plans 28/29 |

STL was removed from main/v1 on 2026-09-20. Its
[archive guide](https://github.com/Brinkwatertoad/SpjutSim-FEA/blob/features/stl-import/docs/STL-DEVELOPMENT.md)
and branch retain the original development/problem history. Historical
`build/plan31-*` paths, commit hashes and test counts in verification records
are preserved, not relabeled as new runs. The chronological spec amendments are
in [requirements history](../reviews/requirements-history.md); current thematic
requirements are in [spec.md](../../spec.md).
