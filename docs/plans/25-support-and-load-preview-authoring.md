# Task 25: Support and load preview authoring implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M25 before Task 26.

**Goal:** Let users select faces and inspect live load/support previews before one explicit Apply or Save action.

**Architecture:** One controller-owned transient draft is separate from committed engineering state. Existing validators and assignment commands remain the commit boundary. UI and glyph rendering consume the draft rather than mutating committed loads on every input event.

**Tech Stack:** JavaScript application contracts, Three.js face picking/glyphs, inline semantic forms, browser tests.

**Spec:** `spec.md` Sections 8, 15.2.2, 15.6–15.7, 15.11, 18, and 19.

## Dependencies and constraints

- Requires accepted M24. Preserve the existing pressure/total-force integration and component support contracts.
- Preview/Cancel leave analysis revision, mesh, preflight, results, and committed assignments unchanged. One successful Apply causes one engineering change/invalidation.
- Keep one support/load editor instance and one authoritative draft; do not clone forms or maintain a second UI-owned draft.
- Face picking, hover, and preview generation remain bounded/coalesced; do not rebuild the complete result mesh on each pointer move.

## Implementation

### 1. Define the transient assignment transaction

**Create:** `web/js/analysis/assignment-draft.js`.
**Modify:** `web/js/analysis/app-controller.js`, `web/js/analysis/analysis-contracts.js`, `web/js/app.js`.
**Tests:** extend `tests/browser/analysis-authoring-tests.js`; create `tests/browser/assignment-draft-tests.{html,js}`.

- [x] Test add/edit/cancel, unchanged-save no-op, invalid values, empty/unknown/duplicate faces, conflicting components, and upstream changes during a draft. Cancelling an edit must retain the original item's ID and values.
- [x] Define draft data `{kind: 'support'|'load', itemId: string|null, faceIds: string[], definition, baseAnalysisRevision}`. Expose controller commands `beginAssignmentDraft`, `updateAssignmentDraft`, `toggleDraftFace`, `commitAssignmentDraft`, and `cancelAssignmentDraft`; document arguments/validation in JSDoc and the spec.
- [x] Validate using existing engineering validators at commit. Reject stale drafts rather than applying them to changed geometry. Keep incomplete input visible with actionable inline feedback and no invalid preview geometry.
- [x] Starting from a selected set uses that set; otherwise begin empty. Editing copies the existing assignment. Starting another editor requires Apply or Cancel for a dirty draft; never silently discard it. A clean draft can close without a prompt.

### 2. Implement toggle selection and live visual feedback

**Modify:** `web/js/ui/analysis-authoring-ui.js`, `web/js/render/viewport-controller.js`, `web/js/render/analysis-glyphs.js`, `web/index.html`, `web/css/app.css`.
**Tests:** extend `tests/browser/preview-selection-tests.js` and authoring/glyph tests.

- [x] In draft mode, plain clicking toggles faces; clicking background preserves the set. Add Clear selection; Escape cancels the draft before ordinary selection clearing. Outside draft mode preserve established click/Shift-click behavior.
- [x] Opening a draft from a result view enters a selectable Model/Mesh presentation, preserving the previous presentation for Cancel. Gizmo input and camera drags never select a face. Apply must not try to restore a result view after invalidating its result.
- [x] Add bounded hover highlighting and a clear draft indicator. Render committed assignments plus the active draft, suppressing the original glyphs of the item being edited to avoid double display. Differentiate previews by styling/text as well as color.
- [x] Reuse deterministic surface samples; cache unchanged face samples and coalesce updates to one animation frame. On removal/disposal release only replaced glyph resources. Do not rebuild all committed glyphs for each keystroke.
- [x] Show selected face count, area, direction and units; explain “100 N total across selection” versus constant inward pressure. Preview arrows encode direction, not quantitative arrow-count/magnitude. Cover curved faces and nonzero prescribed components.
- [x] Provide Apply load/support, Save changes, and Cancel. No second confirmation after a valid Apply. Update spec/README and complete applicable Python, authoring, picking, glyph, WASM, cube, and direct-local checks.

## Manual review M25 — assignment usability, about 20 minutes

- [ ] Owner creates pressure, vector force, fixed support, and component support on a cube and curved part, toggling several faces without Shift.
- [ ] Change values/direction, remove a selected face, orbit, use the gizmo, clear, cancel, and edit an existing assignment. Confirm previews predict the committed result and Cancel preserves a completed solve.
- [ ] Attempt empty/invalid input and switch away from a dirty draft; inspect recovery without losing work.
- [ ] Ask the owner to explain force redistribution when adding faces. Record corrections/acceptance before Task 26.

## Done when

Draft interactions are transactional and responsive, force/support numerics are preserved, and M25 is accepted.

Implementation and automated regression checks complete. M25 remains pending
the user-requested combined M24–M27 review.

Owner-requested corrections are implemented in the
[combined follow-up](../reviews/24-27-followup.md). Its revised workflow supersedes
the original interaction details above; owner acceptance remains pending.
