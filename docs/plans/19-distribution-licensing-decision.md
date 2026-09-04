# Task 19: Distribution Licensing and Artifact Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select and document a legally authorized distribution path for the combined application and make release artifacts mechanically match that decision.

**Architecture:** Treat the copyright holder's decision and any legal review as an external input, then encode the approved path in one release-policy document and a machine-audited artifact manifest. The mesher remains behind its existing contract; replacing it is a separate architectural project if neither Gmsh distribution path is approved.

**Tech Stack:** Repository licenses/notices, SHA-256 manifests, Python standard library compliance audit, existing reproducible Gmsh/OpenCASCADE/Emscripten build scripts.

**Spec:** `spec.md` Sections 4.8, 7.6, 17 Milestone 4, 18.2, 22–23, and Section 26.

## Global constraints

- This plan records an authorized decision; it does not provide legal advice or infer permission from technical feasibility.
- Do not publicly distribute the current combined Gmsh artifact under the repository's present all-rights-reserved posture.
- Preserve upstream copyright/license texts, source provenance, build inputs, local modifications, and artifact hashes exactly.
- Do not claim a commercial Gmsh right without retained evidence that covers the shipped artifact/version and intended distribution.
- A backend replacement must preserve the mesher worker contract and gets its own design/spec/implementation plans before Task 20 proceeds.

---

## Starting point

`THIRD_PARTY.md` identifies Three.js, GMSH-JS, Gmsh, OpenCASCADE, and Emscripten
versions, sources, hashes, modifications, and licenses. Gmsh/GMSH-JS is GPL-
2.0-or-later, the root grants no compatible redistribution permission, and the
release audit correctly marks public distribution blocked.

## Implementation

- [ ] **Obtain the owner decision and review.** Present two release-ready paths
  to the copyright holder: approve a GPL-compatible source distribution for the
  combined work, or provide a commercial Gmsh license covering the pinned
  browser artifact. Record the selected path, scope, approver, date, and legal-
  review reference in `docs/release/distribution-policy.md`. If neither is
  approved, keep public release blocked and open a separate mesher-replacement
  design; do not reinterpret that outcome as completion of the v1 release gate.
- [ ] **Implement the approved root-license posture.** For the compatible-source
  path, install the owner-approved root license and source/build offer covering
  the exact distributed corresponding source. For the commercial path, retain
  non-public entitlement evidence outside the public repository and add the
  permitted public notice plus a documented release verification procedure.
  Do not alter copyright terms beyond the recorded approval.
- [ ] **Create the distributable manifest.** Add
  `docs/release/artifact-manifest.json` listing every generated/vendor payload,
  upstream project/version/license, source location, build recipe, local
  modification, notice path, and SHA-256. Include split Gmsh source strings,
  FEM WASM/runtime wrappers, Three.js, and UI foundation provenance.
- [ ] **Automate compliance checks.** Add `tools/audit-distribution.py` and
  `tests/test_distribution.py` to reject missing notices/sources, hash drift,
  unlisted generated/vendor files, absent build instructions, forbidden remote
  URLs, or a release policy inconsistent with the artifact manifest. The audit
  must fail closed when the owner-decision record is absent or says blocked.
- [ ] **Verify reproducibility.** Rebuild the FEM and Gmsh local runtimes from
  their pinned inputs, compare embedded payload and source-manifest hashes, and
  document any nondeterministic wrapper metadata. Confirm the distributed app
  uses only the audited local assets from `file://` and optional HTTP mode.
- [ ] **Update user-facing distribution documentation.** Reconcile `README.md`,
  `THIRD_PARTY.md`, the root license/notice, `docs/release/v1-readiness.md`, and
  the acceptance audit so they state the same approved rights and obligations.
  Remove the release blocker only after the compliance audit succeeds.

## Verification

- Run `python3 -m unittest discover -s tests` and
  `python3 tools/audit-distribution.py` against the exact candidate tree.
- Rebuild generated runtimes using the documented pinned commands and compare
  their manifest entries before restoring no files by hand.
- Start the candidate from `file://` with network disabled and inspect requests
  to confirm all runtime code and license assets are repository-local.
- Have the copyright holder or delegated reviewer sign off on the final policy
  wording and artifact list before marking the licensing row Pass.

## Done when

An authorized GPL-compatible or commercial-license path is documented, every
distributed third-party/generated artifact is reproducible and covered by the
matching notices/source obligations, the automated audit passes on the exact
candidate, and the Gmsh distribution row can truthfully change to Pass. If the
owner declines both paths, the plan ends with a documented blocker and Task 20
must wait for an approved mesher-replacement project.
