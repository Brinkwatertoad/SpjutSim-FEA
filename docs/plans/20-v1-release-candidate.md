# Task 20: v1.0 Release Candidate Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Final candidate execution follows accepted Task 30.

**Goal:** Turn the completed feature set and Tasks 16–19 evidence into one reproducible, fully audited v1.0 candidate without overstating unsupported behavior.

**Architecture:** A dependency-free release audit consumes committed validation, CAD-corpus, resource, browser, and distribution records and maps each `spec.md` Section 26 item to evidence. The exact static artifact is then smoke-tested in direct-local and optional HTTP modes, hashed, and documented; release status changes only after every required gate passes.

**Tech Stack:** Python standard library, CMake/CTest, static browser harnesses, existing WASM/runtime build scripts, JSON/Markdown release records.

**Spec:** All of `spec.md`, especially Sections 2.1–2.3, 3, 15–17, 20–23, 26, and 28.

## Global constraints

- Tasks 16–19 and the approved Tasks 21–30 sequence, including owner manual reviews M21–M30, are hard prerequisites. A pending feature, usability, evidence, or rights gate keeps the candidate unreleased.
- Tasks 28–29 explicitly add bounded single-solid STL before v1. Do not expand that into OBJ, general mesh repair, multi-body analysis, or other deferred Onshape, anisotropy, nonlinear, cloud, GPU, or mobile scope.
- Test the exact checked-in/generated artifact intended for distribution; rebuilding after acceptance invalidates its hashes and requires rerunning affected checks.
- Direct-local Chromium desktop is the baseline. Optional HTTP mode and declared secondary browsers are reported precisely, without implying unavailable threaded acceleration.
- Every checked Section 26 item links to a reproducible test, record, manual procedure, or approved distribution document.

---

## Starting point

The original Tet10 workflow and Tasks 16–19 evidence are implemented. On
2026-09-07 the owner required interface/result improvements, bounded STL work,
and manual usability reviews before v1. Tasks 21–30 now precede this final
candidate audit. The plan index schedules every owner checkpoint.

Preliminary checks from this plan may run earlier and retain their original
commit/artifact scope. They do not authorize freezing a candidate, closing v1
status, or skipping new manual reviews. Re-run affected checks after changes.

## Implementation

- [ ] **Freeze the candidate inputs.** Record the commit, dirty-tree status,
  toolchain/browser versions, Gmsh/FEM payload hashes, and release version in
  `docs/release/v1.0.0-rc1.md`. Require a clean tree and successful Tasks 16–19
  audits plus accepted M21–M30 records before assigning the candidate identifier.
- [ ] **Automate Section 26 evidence mapping.** Add `tools/audit-v1-release.py`
  plus Python tests. Parse a machine-readable evidence map under
  `docs/release/v1-evidence.json`, require one owned artifact per checklist
  item, reject missing/hash-mismatched/stale records, and produce the Markdown
  table in `docs/release/v1-acceptance-audit.md`. Keep `spec.md` as the
  requirements source rather than duplicating requirement text in code.
- [ ] **Run the complete deterministic suites.** Execute the Python suite,
  clean native configure/build/CTest, validation-record audit, CAD-corpus audit,
  resource-record audit, distribution audit, worker regeneration checks, and
  every pure browser harness. Preserve command output and tool versions in the
  candidate record; any failure returns the corresponding gate to Pending.
- [ ] **Exercise complete user workflows.** In current non-headless Chromium,
  run `file://` import -> material -> component support/load -> Tet10 mesh ->
  explicit Check model -> Solve -> probes/FoS -> two-level convergence for STEP,
  plus import/mesh coverage for IGES and BREP and the accepted binary/ASCII STL
  units/patch/mesh/solve workflow. Include draft cancellation, undo/redo, resize,
  projection/gizmo, boundary-only contour ranges, and both legend orientations.
  Repeat the production STEP workflow in
  optional cross-origin-isolated HTTP mode and run the declared Firefox
  secondary checks from Task 18.
- [ ] **Verify failure, recovery, privacy, and accessibility.** Manually follow
  committed scripts for invalid/multi-solid import, underconstraint, poor mesh,
  solver nonconvergence, cap rejection, synthetic >= 8 GiB confirmation,
  cancellation at mesh/solve/convergence, and edit-after-failure recovery.
  Confirm keyboard/focus/screen-reader labels, network-off operation, no CAD or
  analysis upload, and buffer/worker release on replacement.
- [ ] **Inspect the final artifact.** Review the complete diff and manifest for
  unintended vendor/generated changes, remote dependencies, source-map leaks,
  stale protocol versions, missing notices, peak-memory overlap, silent solver
  actions, and unsupported marketing claims. Re-run any gate affected by a fix.
- [ ] **Close authoritative status.** Once every generated audit row passes,
  check the remaining Section 26 boxes, change the `spec.md` status from active
  implementation to v1.0, update README's current boundary/support matrix, and
  replace `docs/release/v1-readiness.md` with the exact candidate evidence and
  known limitations. If any row is Pending, retain the not-ready status.
- [ ] **Tag only the accepted tree.** Confirm the recorded commit and artifact
  hashes still match, then create the annotated `v1.0.0` tag with the acceptance
  summary. Tagging/publishing requires explicit repository-owner authorization
  and the distribution path approved in Task 19.

## Verification

- Run every command documented in README plus all four new audit scripts from a
  clean checkout with the pinned generated artifacts.
- Open all browser harnesses in their documented modes and retain the dated
  browser/platform result matrix in the candidate record.
- Run `git diff --check`, verify the evidence map has exactly one Section 26
  entry per checklist line, and confirm every Pass target exists and hashes.
- Re-open the packaged `web/index.html` from its final location with networking
  disabled and complete the production workflow once more.

## Done when

Tasks 21–30 and M21–M30 are accepted, every v1 acceptance item passes with
reproducible evidence, the numerical and
resource limits remain within `spec.md`, distribution is authorized, the exact
candidate works through `file://`, and the owner has an auditable tree ready to
tag as `v1.0.0`. Otherwise the release remains explicitly blocked on the named
Pending row.
