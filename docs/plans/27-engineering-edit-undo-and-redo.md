# Task 27: Engineering edit undo and redo implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M27 before Task 28.

**Goal:** Make committed setup edits reversible without retaining large numerical snapshots or reviving stale results.

**Architecture:** The controller owns bounded command history for small engineering definitions. Draft keystrokes and native input undo remain separate. Applying, undoing, or redoing an engineering change uses the same invalidation boundary.

**Tech Stack:** Plain JavaScript, existing controller/contracts and UI Kit shortcut conventions, static browser tests.

**Spec:** `spec.md` Sections 15.2, 15.10–15.11, 18, and 20.

## Dependencies and constraints

- Requires accepted M26 and the Task 25 transaction boundary.
- Scope: support/load add/edit/delete/rename, material/gravity edits, mesh settings, and rigid orientation. Source import/replacement, mesh generation/deletion, solving, and convergence execution are not replayed commands.
- History must not clone or retain source bytes, mesh/result buffers, workers, or WASM contexts. Clear history at geometry import/replacement/removal; explain this boundary visibly.
- Undo/redo is unavailable during worker execution or an assignment draft. Native text-field undo and appearance-settings history keep their existing owners.

## Implementation

### 1. Record bounded reversible definitions

**Create:** `web/js/analysis/engineering-history.js`, `tests/browser/engineering-history-tests.{html,js}`.
**Modify:** `web/js/analysis/app-controller.js`, `web/js/geometry/rigid-orientation.js` only for compact reversible orientation data.

- [x] Write failing command-sequence tests: add → edit → undo → redo, delete → undo with original ID, rename without numerical invalidation, redo cleared after a new edit, and no-op save without a history entry.
- [x] Store before/after small definitions and labels, with a cap of 50 entries and 2 MiB of serialized definition data. Evict oldest entries deterministically. Store rigid transforms rather than duplicate geometry arrays; never include typed mesh/result buffers in entries.
- [x] Route command execution through existing validation and invalidation. Undoing a load leaves mesh usable but disposes stale results/preflight; undoing orientation invalidates mesh as normal. Never restore old analysis revisions or silently reuse cached result snapshots.
- [x] Preserve assignment IDs and monotonically allocated names across undo/redo. Clear incompatible history on imported-geometry changes and reject stale FaceIds. Cover busy state, history eviction, and mixed metadata/engineering operations.

### 2. Expose clear history actions

**Modify:** `web/index.html`, `web/js/ui/ui-controller.js`, `web/js/ui/analysis-authoring-ui.js`.

- [x] Provide menu actions with descriptive labels such as Undo “Edit load”. Bind platform-standard Undo/Redo shortcuts with editable-field, modal, draft, and Settings exclusions; do not capture a browser command when the app has no valid action.
- [x] Announce the changed setup and any required remesh/recheck. Cancelling a draft creates no history item; Apply/Save creates exactly one.
- [x] Update spec/README to explain supported history boundaries. Run history tests, full applicable Python/browser authoring/invalidation suites, cube solve, and direct-local startup.

## Manual review M27 — correcting mistakes, about 10 minutes

- [x] Owner creates, edits, deletes, renames, undoes, and redoes assignments; tries a material change and model rotation after a solve.
- [x] Confirm names/face assignments return correctly, stale results never reappear, and typing Undo in a field edits text rather than the model.
- [x] Confirm import/history-reset and disabled/busy states are understandable. Record acceptance before Task 28.

## Done when

The scoped edits are reversible through validated commands, memory retention is bounded, invalidation remains correct, and M27 is accepted.

Owner-requested corrections are implemented in the
[combined follow-up](../reviews/24-27-followup.md). Its revised workflow supersedes
the original interaction details above; the owner accepted the group on 2026-09-10, including final adjustments in `0ed6e31`.

The manual checklist above is retained as review reference. The owner’s grouped
approval completes this milestone; no further individual acceptance stop remains.
