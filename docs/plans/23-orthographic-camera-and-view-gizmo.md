# Task 23: Orthographic camera and interactive view gizmo implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M23 before Task 24.

**Execution status (2026-09-07):** Implementation and automated verification
complete on `work/plans-21-23`; owner acceptance was recorded on 2026-09-08 in the
[combined M21–M23 review](../reviews/21-23-review.md). The owner's batching and
subagent authorization supersedes the stop/no-subagent note above for 21–23.

**Goal:** Provide orthographic isometric viewing and reliable one-click signed orthogonal views.

**Architecture:** Camera pose/projection remain presentation state in the navigation/viewport layer. Gizmo hit testing has its own screen-space targets and never dispatches geometry picks. Actual geometry orientation retains the existing engineering commands.

**Tech Stack:** Vendored Three.js, classic JavaScript, UI Kit controls/tooltips, browser tests.

**Spec:** `spec.md` Sections 6, 15.5–15.7.1, 15.11, and 18.

## Dependencies and constraints

- Requires accepted M22 and Task 21 overlay bounds.
- Default projection is orthographic; default orientation is isometric. Perspective remains available.
- View actions never modify geometry coordinates, supports/loads, analysis revision, mesh, preflight, or results.
- Preserve configurable mouse bindings, drag thresholds, pointer cancellation, keyboard exclusions, fit/reset, and file-safe operation.

## Implementation

### 1. Extend camera math and preferences

**Modify:** `web/js/render/viewport-navigation.js`, `web/js/render/viewport-controller.js`, `web/js/ui/ui-controller.js`.
**Tests:** `tests/browser/viewport-navigation-tests.js`, `tests/browser/preview-selection-tests.js`.

- [x] Add failing tests for parallel projection, projection-switch apparent size, six signed view directions, equal-angle isometric pose, pole-safe up vectors, fit at wide/tall aspect ratios, and both projection types at extreme model scales.
- [x] Implement separate projection (`orthographic`/`perspective`) and orientation commands (`isometric`, `+x`, `-x`, `+y`, `-y`, `+z`, `-z`). Share target/pose while calculating appropriate frustum, clipping planes, pan units, and zoom bounds for each camera.
- [x] Preserve visible scale on projection switches: for perspective distance d and vertical FOV f, initialize orthographic visible height to `2 * d * Math.tan(f / 2)`. Account for orthographic zoom on the inverse switch.
- [x] Version and validate projection preferences. Migrating existing navigation preferences preserves bindings/sensitivities. Repeated solve/remesh events must not reset a user-adjusted view.

### 2. Make the gizmo operable by pointer and keyboard

**Modify:** `web/index.html`, `web/css/app.css`, `web/js/render/viewport-controller.js`, `web/js/ui/ui-controller.js`.

- [x] Test gizmo clicks separately from face selection/probing; ensure a drag, pointer cancellation, or projection switch cannot produce a stray pick.
- [x] Provide signed-axis hit targets with hover/focus highlight and text such as “View from +X · YZ plane”. When endpoints overlap, retain an unambiguous accessible menu path for every direction.
- [x] Add matching View menu commands and an Isometric action. Exact principal views must remain possible despite the free-orbit polar clamp; choose stable up vectors and deterministic transition to free orbit.
- [x] Animate view transitions briefly, respect reduced-motion, and cancel animation immediately on user navigation. Dispose listeners/animation resources with the viewport.
- [x] Update spec/README and complete focused plus applicable Python/browser suites, including direct-local startup, 2× DPI, and keyboard interactions with open menus/settings.

## Manual review M23 — navigation, about 15 minutes

- [x] Owner inspects an asymmetric part in all six views and Isometric, using both gizmo and menu; hover text must resolve viewing-direction ambiguity.
- [x] Switch perspective/orthographic, pan/zoom, fit/reset, rotate out of a principal view, and repeat while results exist.
- [x] Confirm the model's engineering orientation and assigned faces never change; review hit-target comfort with mouse and trackpad.
- [x] Record acceptance before Task 24.

## Done when

All camera paths work without changing analysis state, the exact orthogonal views are stable, and M23 is accepted.

## Approved review revisions — 2026-09-08

Reveal circles and negative labels on general gizmo hover/focus, with no-hover
fallback. Depth-test actual labels against arrows. Add a Perspective switch in
3D display; replace visible Iso/Isometric actions with a graphical Reset view
control. Reset animates angle, target, and zoom over 180 ms, respects reduced
motion, and cancels on navigation.

Implemented and covered by the revised combined review packet; owner acceptance
of the revised UI was recorded on 2026-09-08. These revisions supersede conflicting
original checklist wording above.

Final owner check passed on 2026-09-08. Follow-up: restore Solve accent styling
and place menus next to the title with status at the right edge; commit and push
authorized.
