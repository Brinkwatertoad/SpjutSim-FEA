# Compact Setup Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered material/support/load authoring surface with a compact, sticky setup inspector that summarizes ordinary setup without page scrolling and edits the selected item in place.

**Architecture:** Add a pure row-summary module, then render one stable inspector tree from `AnalysisDocument`. Reparent the existing material/support/load/gravity form nodes into one active row editor so the controller commands and form drafts remain single-source. Keep inspector selection and focus-return state in `AnalysisAuthoringUI`, not engineering state.

**Tech Stack:** Plain classic-script JavaScript, semantic HTML, CSS, existing `AppController`/`AnalysisAuthoringUI`, direct `file://` browser tests, Python structural tests.

**Spec:** `docs/superpowers/specs/2026-09-01-priority-release-features-design.md`

## Global Constraints

- The compact setup inspector is the highest-priority release feature.
- A typical model/material plus a few supports and simple loads must be visible together without page scrolling in the normal tools-pane viewport.
- There is one rendered source for each editable value and one controller command path; do not duplicate form drafts.
- Keep simulation/application state outside `/web/ui`; inspector-open state is UI-only.
- Preserve direct `file://` execution, plain classic scripts, accessibility, and the dependency-free browser stack.
- Do not add backward-compatibility paths for alpha-only internal contracts.

---

### Task 1: Pure setup-row summaries

**Files:**
- Create: `web/js/ui/setup-inspector-summary.js`
- Modify: `tests/browser/analysis-authoring-tests.html`
- Modify: `tests/browser/analysis-authoring-tests.js`
- Modify: `web/index.html`

**Interfaces:**
- Consumes: current `AnalysisDocument` fields `geometry`, `material`, `boundaryConditions`, `loads`, and `gravity`.
- Produces: `SpjutsimFEA.buildSetupInspectorRows(documentState) -> SetupInspectorRow[]`, where each row is `{ kind, itemId, primaryText, secondaryText, metaText, ariaLabel }`.

- [ ] **Step 1: Write failing row-summary tests**

Add a `testSetupInspectorSummaries()` test that constructs a document with a STEP model, A36 material, two supports, pressure, total force, and gravity, then asserts:

```js
var rows = api.buildSetupInspectorRows(state);
assert(rows.map(function (row) { return row.kind + ':' + row.itemId; }).join('|') ===
  'model:model|support:support-1|support:support-2|load:load-1|load:load-2|gravity:gravity',
  'setup rows were not emitted in stable document order');
assert(rows[0].secondaryText.indexOf('Steel A36') !== -1, 'model row omitted material');
assert(rows[1].metaText.indexOf('2 faces') !== -1, 'support row omitted face count');
assert(rows[3].secondaryText.indexOf('MPa') !== -1, 'pressure row omitted display units');
assert(rows[4].secondaryText.indexOf('N') !== -1, 'force row omitted display units');
```

- [ ] **Step 2: Run the browser harness and verify RED**

Open `tests/browser/analysis-authoring-tests.html` directly in Chromium.

Expected: FAIL with `api.buildSetupInspectorRows is not a function`.

- [ ] **Step 3: Implement the pure summary module**

Define frozen row-building behavior in a classic IIFE:

```js
(function (root) {
  'use strict';
  function buildSetupInspectorRows(documentState) {
    var rows = [summarizeModelRow(documentState)];
    documentState.boundaryConditions.forEach(function (item) { rows.push(summarizeSupportRow(item)); });
    documentState.loads.forEach(function (item) { rows.push(summarizeLoadRow(item)); });
    if (documentState.gravity && documentState.gravity.enabled) { rows.push(summarizeGravityRow(documentState.gravity)); }
    return rows;
  }
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.buildSetupInspectorRows = buildSetupInspectorRows;
}(globalThis));
```

Use current display-unit helpers for pressure and displacement, include force vectors in N, include face counts, and avoid reading DOM state.

- [ ] **Step 4: Load the module before authoring UI**

Add `js/ui/setup-inspector-summary.js` before `analysis-authoring-ui.js` in `web/index.html`, and the corresponding relative script in the browser harness.

- [ ] **Step 5: Run focused verification and verify GREEN**

Open `tests/browser/analysis-authoring-tests.html` directly in Chromium.

Expected: title and status report `Analysis authoring tests: Passed` / `Passed`.

- [ ] **Step 6: Run structural tests**

Run: `python3 -m unittest discover -s tests`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/js/ui/setup-inspector-summary.js web/index.html tests/browser/analysis-authoring-tests.html tests/browser/analysis-authoring-tests.js
git commit -m "feat: add compact setup summaries"
```

### Task 2: Inspector shell and single form stash

**Files:**
- Modify: `web/index.html`
- Modify: `web/css/app.css`
- Modify: `tests/browser/analysis-authoring-tests.html`
- Modify: `tests/browser/analysis-authoring-tests.js`
- Modify: `tests/test_framework.py`

**Interfaces:**
- Consumes: existing form IDs used by `AnalysisAuthoringUI`.
- Produces: one `#setup-inspector`, three group lists, add actions, live status, editor hosts, and a hidden `#setup-inspector-form-stash` owning the form nodes when closed.

- [ ] **Step 1: Write failing markup-contract tests**

Assert the application and browser harness contain:

```js
['setup-inspector', 'setup-inspector-status', 'setup-inspector-model-list',
 'setup-inspector-support-list', 'setup-inspector-load-list',
 'setup-inspector-form-stash', 'setup-add-support-button',
 'setup-add-load-button'].forEach(function (id) {
  assert(document.getElementById(id), 'missing inspector node #' + id);
});
assert(document.querySelectorAll('#material-form').length === 1, 'material form was duplicated');
assert(document.querySelectorAll('#support-form').length === 1, 'support form was duplicated');
assert(document.querySelectorAll('#load-form').length === 1, 'load form was duplicated');
```

Add a Python source-contract assertion that top-level `#material-tool`, `#supports-tool`, and `#loads-tool` sections no longer exist as competing visible sections.

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m unittest discover -s tests`

Expected: FAIL on missing `setup-inspector` contract.

Open `tests/browser/analysis-authoring-tests.html`.

Expected: FAIL on missing inspector node.

- [ ] **Step 3: Restructure the tools-pane markup**

Place the inspector immediately below the Analysis heading:

```html
<section id="setup-inspector" class="fea-setup-inspector" aria-labelledby="setup-inspector-title">
  <div class="fea-setup-heading"><h2 id="setup-inspector-title">Setup</h2></div>
  <p id="setup-inspector-status" class="fea-visually-hidden" role="status" aria-live="polite"></p>
  <div class="fea-setup-group"><h3>Model</h3><ul id="setup-inspector-model-list" class="fea-setup-list"></ul></div>
  <div class="fea-setup-group"><h3>Supports</h3><button id="setup-add-support-button" type="button">Add</button><ul id="setup-inspector-support-list" class="fea-setup-list"></ul></div>
  <div class="fea-setup-group"><h3>Loads</h3><button id="setup-add-load-button" type="button">Add</button><ul id="setup-inspector-load-list" class="fea-setup-list"></ul></div>
  <div id="setup-inspector-form-stash" hidden></div>
</section>
```

Move, rather than copy, the existing forms and feedback nodes into the stash in source markup. Remove the superseded visible section wrappers.

- [ ] **Step 4: Add compact sticky styling**

Implement `.fea-setup-inspector`, `.fea-setup-group`, `.fea-setup-list`, `.fea-setup-row`, `.fea-setup-row-button`, `.fea-setup-row-summary`, `.fea-setup-row-meta`, `.fea-setup-editor`, and `.fea-setup-actions`. Keep row summaries to two compact lines plus metadata, use the pane background, and add `position: sticky; top: 0; z-index: 2` without covering focused controls.

- [ ] **Step 5: Run focused verification and verify GREEN**

Run `python3 -m unittest discover -s tests`, then open `tests/browser/analysis-authoring-tests.html`.

Expected: all Python tests and the browser harness pass.

- [ ] **Step 6: Commit**

```bash
git add web/index.html web/css/app.css tests/browser/analysis-authoring-tests.html tests/browser/analysis-authoring-tests.js tests/test_framework.py
git commit -m "feat: add setup inspector shell"
```

### Task 3: Render selectable compact rows

**Files:**
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `tests/browser/analysis-authoring-tests.js`

**Interfaces:**
- Consumes: `buildSetupInspectorRows(documentState)` and existing controller selection commands.
- Produces: `AnalysisAuthoringUI.prototype.renderSetupInspector(documentState)` and stable row DOM attributes.

- [ ] **Step 1: Write failing row-render tests**

Assert rendered row triggers have:

```js
var supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
assert(supportTrigger, 'support inspector row was not rendered');
assert(supportTrigger.getAttribute('aria-expanded') === 'false', 'closed row did not expose collapsed state');
supportTrigger.click();
assert(state.selectedFaceIds.join('|') === state.boundaryConditions[0].faceIds.join('|'),
  'support row did not highlight its faces');
```

Also assert model is first, gravity is absent when disabled, empty groups show concise empty states, and every trigger's accessible name contains its summary.

- [ ] **Step 2: Run the harness and verify RED**

Open `tests/browser/analysis-authoring-tests.html`.

Expected: FAIL because inspector rows are empty.

- [ ] **Step 3: Add UI-local inspector state**

Initialize:

```js
this.activeInspectorKind = null;
this.activeInspectorItemId = null;
this.activeInspectorFocusReturn = null;
```

Implement `renderSetupInspector(documentState)` using buttons and text nodes, not `innerHTML` interpolation. Use `data-setup-kind`, `data-item-id`, `data-setup-row`, `data-setup-row-trigger`, and `data-setup-editor-host`.

- [ ] **Step 4: Connect row selection**

Model selection leaves face selection unchanged. Support/load selection calls `selectBoundaryCondition(id)` / `selectLoad(id)` before opening. Gravity opens without changing selected faces.

- [ ] **Step 5: Verify GREEN**

Open `tests/browser/analysis-authoring-tests.html`.

Expected: Passed.

- [ ] **Step 6: Commit**

```bash
git add web/js/ui/analysis-authoring-ui.js tests/browser/analysis-authoring-tests.js
git commit -m "feat: render selectable setup inspector"
```

### Task 4: Mount one inline editor and preserve draft behavior

**Files:**
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `tests/browser/analysis-authoring-tests.js`

**Interfaces:**
- Produces: `openInspectorRow(kind, itemId, opener)`, `closeInspectorRow(options)`, and `mountInlineEditor(kind, itemId)`.
- Preserves: `saveMaterial`, `beginSupportEdit`, `beginLoadEdit`, `saveGravity`, remembered authoring types, and all existing controller commands.

- [ ] **Step 1: Write failing inline-editor tests**

Cover these behaviors individually:

```js
supportTrigger.click();
assert(supportTrigger.getAttribute('aria-expanded') === 'true', 'selected row was not expanded');
assert(document.getElementById('support-form').closest('[data-setup-editor-host]'), 'support form was not mounted inline');
document.getElementById('setup-add-load-button').click();
assert(document.getElementById('load-form').closest('[data-setup-editor-host]'), 'load add form was not mounted inline');
assert(!document.getElementById('support-form').closest('[data-setup-editor-host]'), 'two inline editors stayed open');
```

Add separate assertions that save/cancel/delete update row summaries, close the editor, retain `lastSupportType`/`lastLoadType`, and return focus to the logical trigger/add button.

- [ ] **Step 2: Run the harness and verify RED**

Open `tests/browser/analysis-authoring-tests.html`.

Expected: FAIL because forms remain in the stash.

- [ ] **Step 3: Implement form reparenting**

Move the existing form and its related feedback/details nodes into only the active row host. Before rerendering the list, return active nodes to `#setup-inspector-form-stash`; after rerendering, remount them without resetting field values.

- [ ] **Step 4: Unify open/save/cancel/delete lifecycle**

On open, populate the existing editor. On save or delete, close and rerender. On cancel, restore remembered add-mode type and close. Never clone forms or maintain a parallel draft object.

- [ ] **Step 5: Verify GREEN and regress existing authoring**

Open `tests/browser/analysis-authoring-tests.html`.

Expected: all existing material catalog, generated-name, authoring-memory, projection, and new inspector tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/js/ui/analysis-authoring-ui.js tests/browser/analysis-authoring-tests.js
git commit -m "feat: edit setup items inline"
```

### Task 5: Escape priority and focus integration

**Files:**
- Modify: `web/js/ui/analysis-authoring-ui.js`
- Modify: `web/js/ui/ui-controller.js`
- Modify: `tests/browser/analysis-authoring-tests.js`
- Modify: `tests/browser/worker-runtime-tests.js`

**Interfaces:**
- Produces: `AnalysisAuthoringUI.prototype.handleDocumentKeyDown(event) -> boolean`.
- Changes: `UIController` consumes inspector Escape before clearing face selection.

- [ ] **Step 1: Write failing keyboard tests**

Assert one Escape closes the active inline editor and preserves selected faces; a second unconsumed Escape clears faces. Assert an already-cancelled event and menu/modal dismissal still take priority.

- [ ] **Step 2: Run both harnesses and verify RED**

Open `tests/browser/analysis-authoring-tests.html` and `tests/browser/worker-runtime-tests.html`.

Expected: the new Escape-priority assertion fails.

- [ ] **Step 3: Implement delegated Escape handling**

```js
AnalysisAuthoringUI.prototype.handleDocumentKeyDown = function (event) {
  if (event.key !== 'Escape' || event.defaultPrevented || !this.activeInspectorKind) { return false; }
  this.closeInspectorRow({ restoreFocus: true, cancelEdit: true });
  event.preventDefault();
  return true;
};
```

Call it in `UIController` after modal/menu ownership checks and before `clearSelectedFaces()`.

- [ ] **Step 4: Verify GREEN**

Open both harnesses.

Expected: Passed in both.

- [ ] **Step 5: Commit**

```bash
git add web/js/ui/analysis-authoring-ui.js web/js/ui/ui-controller.js tests/browser/analysis-authoring-tests.js tests/browser/worker-runtime-tests.js
git commit -m "fix: prioritize setup editor keyboard handling"
```

### Task 6: Layout, viewport-selection integration, and documentation

**Files:**
- Modify: `tests/browser/analysis-authoring-tests.html`
- Modify: `tests/browser/analysis-authoring-tests.js`
- Modify: `tests/browser/preview-selection-tests.js`
- Modify: `README.md`
- Modify: `spec.md`
- Modify: `docs/plans/README.md`
- Create: `docs/plans/11-priority-release-features.md`

**Interfaces:**
- Verifies: a representative inspector fits its available tools-pane viewport and row selection continues to highlight CAD faces.
- Documents: the inspector-first release sequence and the remaining approved packages.

- [ ] **Step 1: Write failing layout and integration checks**

Make the authoring harness render at a fixed representative tools-pane size with one model/material, two supports, pressure, total force, and gravity. Assert:

```js
var inspector = document.getElementById('setup-inspector');
assert(inspector.scrollHeight <= inspector.parentElement.clientHeight,
  'ordinary setup did not fit without tools-pane page scrolling');
```

In preview-selection coverage, click an inspector support/load row and assert both controller `selectedFaceIds` and viewport selection material update.

- [ ] **Step 2: Run focused browser tests and verify RED**

Open `tests/browser/analysis-authoring-tests.html` and `tests/browser/preview-selection-tests.html`.

Expected: FAIL until layout sizing and inspector/viewport hookup are complete.

- [ ] **Step 3: Tune compact layout without hiding information**

Adjust row spacing, typography, group headings, and editor overflow. Do not truncate away values, units, component summaries, material name, or face counts. Only the expanded editor may scroll internally when necessary.

- [ ] **Step 4: Update source-of-truth documentation**

Update `spec.md` sections 3, 4.4, 15.1, 15.2, and 15.6 to make the sticky compact inspector and in-place editing required. Add `docs/plans/11-priority-release-features.md` as the release roadmap linking the approved design and package plans, with the inspector marked first. Update `docs/plans/README.md` and `README.md` browser-test guidance.

- [ ] **Step 5: Run complete inspector verification**

Run:

```bash
python3 -m unittest discover -s tests
cmake -S native/fem -B build/native-fem
cmake --build build/native-fem
ctest --test-dir build/native-fem
```

Open directly in Chromium:

- `tests/browser/analysis-authoring-tests.html`
- `tests/browser/worker-runtime-tests.html`
- `tests/browser/viewport-navigation-tests.html`
- `web/index.html`

Open through the documented HTTP/local-file-enabled path:

- `tests/browser/preview-selection-tests.html`

Expected: all automated suites pass; the real app shows ordinary setup together without tools-pane scrolling and preserves face highlighting/editing.

- [ ] **Step 6: Review the complete inspector diff**

Check for duplicate forms/drafts, DOM-reparenting value loss, focus loss, stale row summaries, Escape conflicts, hidden information, broken `file://` script order, unrelated changes, and accessibility regressions.

- [ ] **Step 7: Commit**

```bash
git add README.md spec.md docs/plans/README.md docs/plans/11-priority-release-features.md tests/browser/analysis-authoring-tests.html tests/browser/analysis-authoring-tests.js tests/browser/preview-selection-tests.js web/css/app.css
git commit -m "docs: establish inspector-first release roadmap"
```

