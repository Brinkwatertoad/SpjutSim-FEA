# Task 30: Integrated usability and pre-release regression implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop for M30; resume Task 20 only after explicit acceptance.

**Goal:** Confirm that Tasks 21–29 work together and collect owner usability acceptance before freezing a release candidate.

**Architecture:** Extend existing regression/evidence tooling and keep one traceable manual-review record per package. This plan verifies product behavior; Task 20 retains ownership of exact-candidate release auditing, hashes, tagging, and publication authorization.

**Tech Stack:** Existing Python/CMake/CTest and static browser harnesses, Markdown review records, reproducible runtime/distribution tools.

**Spec:** `spec.md` Sections 15.11, 16, 18–23, and 26; all accepted Tasks 21–29 contracts.

## Dependencies and constraints

- Requires explicit acceptance of M21–M29, or an owner-approved scope amendment recorded in the index/spec. A failed STL gate cannot be silently marked deferred.
- Implementation progress, old Task 20 checks, a deployed preview, and headless test success do not substitute for owner usability acceptance.
- Reuse valid historical numerical evidence with its original commit/scope; rerun every claim affected by changed runtime, postprocessing, input paths, or state transitions.
- This plan does not authorize a v1 tag, publication, or final release-status change.

## Implementation and evidence

### 1. Audit coverage and complete the combined regression

**Create:** `docs/reviews/30-integrated-usability.md` using the plan-index template.
**Modify:** `docs/release/v1-acceptance-audit.md`, `docs/release/v1-readiness.md`, affected existing browser/Python tests, and `README.md` if commands changed.

- [ ] Map each original concern to evidence: resizing (21), confusing extrema (22), gizmo/projection (23), display/legend (24), drafts (25), setup/checks (26), reversible mistakes (27), STL (28–29), and UI Kit/accessibility throughout.
- [ ] Review the complete integrated diff for unnecessary redraws, retained buffers, ownership violations, error recovery, accessibility, and unintended vendor/generated edits. Fix concrete defects and rerun the checks those fixes affect.
- [ ] Run `python3 -m unittest discover -s tests`, native configure/build/CTest from the repository README, validation/CAD/resource audits, distribution checks, and every applicable old/new browser harness. Verify reproducible worker packaging without hand-edited generated output.
- [ ] Run the supported direct-local and HTTP browser/platform matrix. Re-measure affected resource cases, particularly live preview, result switching, repeated import/replacement, STL preprocessing, and cancellation. Record tool/browser versions and bounded memory observations.
- [ ] Repeat a combined resize/interaction sequence with imported geometry and solved results, including 125%/200% browser zoom, 2× DPI, all themes, keyboard-only controls, and reduced-motion camera transitions.

### 2. Prepare the owner walkthrough and release handoff

- [ ] Supply a runnable checkout/preview with representative STEP and STL fixtures, expected engineering values, and plain-language steps. Use a bent/asymmetric or curved part for selection/camera usability; a cube alone does not exercise enough interaction ambiguity.
- [ ] Provide reproducible synthetic underconstraint, invalid draft, stale check, cap-blocked, >=8 GiB warning, failed import, and cancel/retry states without unsafe allocations.
- [ ] List any remaining defect by severity and affected requirement. A known blocker keeps its manual gate Pending; do not bury it as a release-note limitation.
- [ ] Update the acceptance audit with new evidence and link M21–M30 records. Keep Task 20 and release status open even after M30 acceptance; next execute its full exact-candidate workflow.

## Manual review M30 — integrated workflow, about 30–45 minutes

- [ ] Owner completes import → units/material → draft supports/loads → mesh → Check model → Solve → peak/legend/probe → convergence in the working application.
- [ ] Repeat key actions on STL, resize mid-workflow, change projection, undo an edit, cancel a draft, fix a check failure, and replace geometry with explicit mapping.
- [ ] Owner confirms that the application is understandable without the implementer narrating which controls to use. Record confusing steps and correct them before accepting the affected flow.
- [ ] Record final usability acceptance and permission to proceed to candidate auditing. This acceptance is not permission to tag or publish.

## Done when

All revised requirements have current regression evidence and accepted owner reviews, remaining blockers are resolved or explicitly rescoped, and Task 20 can begin its final candidate audit. v1 remains unreleased until Task 20 completes with the required owner authorization.
