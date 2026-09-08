# Task 21: Responsive workspace and overlay layout implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at the manual review gate before starting Task 22.

**Execution status (2026-09-07):** Implementation and automated verification
complete on `work/plans-21-23`; owner acceptance was recorded on 2026-09-08 in the
[combined M21–M23 review](../reviews/21-23-review.md). The owner's batching and
subagent authorization supersedes the stop/no-subagent note above for 21–23.

**Goal:** Keep the model, controls, gizmo, and legend inside the visible workspace while resizing.

**Architecture:** An app-owned workspace controller owns pane sizing and preferences. CSS owns available space; the renderer measures the resulting canvas. Adapt UI Kit 0.7.1 shell mechanics without putting FEA state into generic helpers.

**Tech Stack:** Classic JavaScript, CSS Grid, copied UI Kit, Three.js, static browser harnesses.

**Spec:** `spec.md` Sections 15.1, 15.7.1, 15.11, 18, and 26.

## Dependencies and constraints

- First package in the revised pre-v1 sequence; see the execution/review rules in `README.md` in this directory.
- Preserve direct `file://`, dependency-free scripts, analysis revisions, and numerical results.
- No runtime UI Kit dependency or new browser tooling dependency.
- Keep the current horizontal legend usable until Task 24 adds orientation preferences.

## Implementation

### 1. Correct canvas sizing and reserve overlay locations

**Modify:** `web/css/app.css`, `web/index.html`, `web/js/render/viewport-controller.js`.
**Create tests:** `tests/browser/workspace-layout-tests.html`, `tests/browser/workspace-layout-tests.js`.

- [x] Reproduce resize sequence 500×400 → 1440×500 → 1440×900 with a real initialized viewport. At 1440×500 the review measured an 820px canvas with only 458px available. Assert canvas bounds stay inside the workspace after every resize, including 2× device pixel ratio.
- [x] Make grid children shrink vertically and horizontally; remove narrow-layout minimum-row combinations that force page overflow. Start with `.fea-canvas { min-height: 0; }`, then verify the whole ancestor sizing chain instead of relying on overflow clipping to hide the bug.
- [x] Reserve lower-left space for the gizmo, right-side space for the legend, and a bounded probe area. Define shared CSS layout values and pass measured available bounds to the renderer; do not maintain unrelated hard-coded legend/gizmo offsets.
- [x] Constrain short-window controls and help without obscuring navigation or field information. Verify menus can still escape their appropriate overlay layer.

### 2. Add usable pane controls and UI Kit shell consistency

**Create:** `web/js/ui/workspace-layout.js`.
**Modify:** `web/js/ui/ui-controller.js`, `web/index.html`, `web/css/app.css`, `UI_FOUNDATION.md` if provenance/adaptation notes change.

- [x] Add failing browser cases for keyboard-operated splitters, collapse/reopen, malformed preferences, unavailable storage, and focus return when a pane collapses.
- [x] Add visible Setup/Results toggles and adjustable pane widths. Keep minimum usable viewport space; fall back to one active pane/drawer at narrow desktop widths rather than squeezing all three columns.
- [x] Start with Results collapsed when there are no results, checks, or diagnostics to show. Explicit output actions may open it; routine redraws must not override a user's pane choice. Expose an app-owned `showOutputPanel(panelId)` command for Task 26.
- [x] Persist validated pane preferences independently of analysis state. Apply shared tokens, action feedback, focus rings, and tooltip conventions; retain the 0.7.1 pin unless source actually changes.
- [x] Update spec/README descriptions and run focused tests, then the complete applicable Python/browser suites from the repository README. Check direct-local startup after adding the script.

## Manual review M21 — layout, about 10 minutes

- [x] Provide the working app path/URL, a solved fixture, before/after screenshots, and automated results using the record template in the plan index.
- [x] Owner resizes at 1440×900, 1000×700, 850×600, and 1440×500; tries browser zoom at 125%/200%; collapses, resizes, and reopens both panes.
- [x] Owner confirms gizmo/legend/probe do not overlap or leave the viewport, and the model retains usable space. Test the compact fallback at 500×400 as a robustness check, not a mobile-support claim.
- [x] Record owner acceptance or requested corrections. Fix and re-review rejected behavior before Task 22.

## Done when

The resize regression and pane interactions pass, direct-local startup works, and M21 is explicitly accepted. No release status changes.

## Approved review revisions — 2026-09-08

Separate action bar below menus: Tools left, disabled Undo/Redo/Save/Export,
Solve just left of Results on the right. Truss disclosure triangles inside both
panels. Solve automatically runs an available preflight and continues only
after a valid check, preserving cancellation and memory safeguards.

Implemented and covered by the revised combined review packet; owner acceptance
of the revised UI was recorded on 2026-09-08. These revisions supersede conflicting
original checklist wording above.

Final owner check passed on 2026-09-08. Follow-up: restore Solve accent styling
and place menus next to the title with status at the right edge; commit and push
authorized.
