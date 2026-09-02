# Replacement-model setup transfer implementation plan

**Goal:** Import a replacement CAD model without disturbing the active analysis, guide the user through remapping every face-bound support/load, and install the completed transfer atomically.

**Architecture:** A pure migration-draft module snapshots transferable setup and owns ordered map/drop decisions. A modal UI owns two temporary viewports (old reference and selectable replacement). `AppController` validates the completed payload before making one state change; cancelled, incomplete, and invalid drafts never touch the active document.

## Completed work

- [x] Restructure the whole left pane as Setup: Model, Material, Supports, Loads, Mesh, Solve Preflight.
- [x] Move CAD import/replacement and orientation into Model; keep Material as the next independent expandable row.
- [x] Snapshot transferable setup and inherit the active global model orientation without changing the active document.
- [x] Present disposable old/new viewports, highlight each old item, and require mapped replacement faces or explicit Drop.
- [x] Review mapped/dropped items and atomically validate/install the accepted replacement.
- [x] Preserve the active analysis on cancel, incomplete mapping, invalid target faces, and replacement import failure.
- [x] Run the complete release gate and commit.

### Task 1: Draft and atomic controller contract

1. Add browser tests for stable support/load order, orientation/settings transfer, valid mappings, explicit drops, and incomplete/invalid diagnostics.
2. Implement the pure draft API and completed-transfer builder.
3. Add an atomic controller replacement method that validates geometry, source, material, gravity, supports, loads, and mesh settings before mutation.

### Task 2: Side-by-side guided remapping

1. Add an accessible migration modal with old/new canvases, item details, progress, selection, map/drop/back/cancel/apply controls, and final summary.
2. Highlight each current item's old faces while the replacement viewport accepts new-face selection.
3. Keep the original document and main viewport active until Apply; dispose both temporary viewports on Apply or Cancel.
4. Route replacement imports with authored setup into the migration workflow; keep first imports direct.

### Task 3: Documentation and verification

1. Update README, `spec.md`, and master-plan progress.
2. Run Python, native, browser, and direct-file release checks; commit.
