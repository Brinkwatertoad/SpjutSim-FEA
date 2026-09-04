# Task 20: v1.0 Release Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed feature set and Tasks 16–19 evidence into one reproducible, fully audited v1.0 candidate without overstating unsupported behavior.

**Architecture:** A dependency-free release audit consumes committed validation, CAD-corpus, resource, browser, and distribution records and maps each `spec.md` Section 26 item to evidence. The exact static artifact is then smoke-tested in direct-local and optional HTTP modes, hashed, and documented; release status changes only after every required gate passes.

**Tech Stack:** Python standard library, CMake/CTest, static browser harnesses, existing WASM/runtime build scripts, JSON/Markdown release records.

**Spec:** All of `spec.md`, especially Sections 2.1–2.3, 3, 15–17, 20–23, 26, and 28.

## Global constraints

- Tasks 16, 17, 18, and 19 are hard prerequisites; a pending evidence or rights gate keeps the candidate unreleased.
- Do not add post-v1 Onshape, anisotropy, tessellated import, nonlinear, assembly, cloud, GPU, or mobile scope to stabilize v1.
- Test the exact checked-in/generated artifact intended for distribution; rebuilding after acceptance invalidates its hashes and requires rerunning affected checks.
- Direct-local Chromium desktop is the baseline. Optional HTTP mode and declared secondary browsers are reported precisely, without implying unavailable threaded acceleration.
- Every checked Section 26 item links to a reproducible test, record, manual procedure, or approved distribution document.

---

## Starting point

The application implements the v1 workflow through Tet10 solve, result trust,
FoS, and convergence, and the current focused evidence passes. The audit remains
open for the independent reference matrix, representative CAD corpus, calibrated
browser resources, >= 8 GiB state evidence, and distribution rights. The local
Python suite passes; CMake is required to rerun native tests in a provisioned
release environment.

## Implementation

- [ ] **Freeze the candidate inputs.** Record the commit, dirty-tree status,
  toolchain/browser versions, Gmsh/FEM payload hashes, and release version in
  `docs/release/v1.0.0-rc1.md`. Require a clean tree and successful Tasks 16–19
  audits before assigning the candidate identifier.
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
  preflight -> solve -> probes/FoS -> two-level convergence for STEP, plus
  import/mesh coverage for IGES and BREP. Repeat the production STEP workflow in
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

Every v1 acceptance item passes with reproducible evidence, the numerical and
resource limits remain within `spec.md`, distribution is authorized, the exact
candidate works through `file://`, and the owner has an auditable tree ready to
tag as `v1.0.0`. Otherwise the release remains explicitly blocked on the named
Pending row.
