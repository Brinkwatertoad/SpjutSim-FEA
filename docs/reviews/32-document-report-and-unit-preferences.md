# Plan 32 verification

Scope: SpjutSim-FEA only, on `feat/material-load-units-report`. No dependencies, vendor/generated changes, worktrees, merges, or deployments.

## Result

- Native DOCX export is the default report choice; text/PNG ZIP remains available. Both share the tab-delimited report content and existing clean Reset View/Fit Model captures. DOCX includes editable tables, embedded PNGs, headings, descriptive image text and preserved image proportions.
- Settings prefers 840 × 720 px and caps to the viewport. Its active panel scrolls internally. Desktop and 600 × 500 screenshots were inspected headlessly.
- SI defaults and requested USCS roles are centralized. Inputs, setup summaries, coordinate probes, result tables, convergence, STL review dimensions, migration descriptions, assignment previews and reports consume those units. Source-file interpretation remains explicitly separate.
- Named-set behavior follows SpjutMath Milestone-4 `3733a6027f722f602e3102bc5f650cad3d1b215f`: save a copy, save/rename through the name field, update active saved sets, and delete to Custom while preserving values.
- Preference changes preserve uncommitted numeric values, SI analysis data, revision, mesh and solved results. Inline dropdowns and fresh application loads share the same persisted preferences. Invalid conversions are rejected before any fields change.
- Removed the separate load-unit persistence path and duplicate conversion logic. Draft previews show a placeholder for incomplete forces instead of throwing during conversion.

## Evidence

- Python: **79/79**, **2.062 s** (`python3 -m unittest discover -s tests`).
- Native solver: **8/8**, **0.39 s** (existing repository-local CMake/CTest; system CMake is unavailable).
- Direct-file headless Chromium: **33/33 harnesses**, **81.684 s**. Includes DOCX/prefs, authored loads, live drafts, material strengths, history, result formatting/presentation/ranges, solve orchestration, navigation, workspace sizing, FoS, convergence, workers, WASM, Tet4/Tet10, STEP, grouped authoring, selection and STL solve/review/repair workflows.
- High-DPI (2×): **4/4 harnesses**, **28.492 s** (unit preferences, load entry/reload, solved report workflow, workspace layout). Browser total: **37/37**, **110.176 s**.
- Independent standard-library DOCX validation: **2/2 packages**, **0.004 s**. Checks CRCs, XML, package relationships, result/parameter tables, five embedded captures, image proportions and page bounds; validates both API-generated and button-downloaded files.
- Final diff review covered SI boundaries, persistence validation, conversion atomicity, invalid drafts, package paths, XML escaping, accessibility, field/probe synchronization, and dependency/script ordering. `git diff --check` passed.

The solved browser workflow tests the actual application and download, including complete view restoration and stale-export rejection. Word and Google Docs were not available for an interactive rendering check; package structure and embedded content were validated locally. No Office library or runtime service is required by the exporter.
