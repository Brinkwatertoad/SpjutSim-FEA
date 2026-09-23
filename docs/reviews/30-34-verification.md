# Plans 30–34 implementation verification

Date: 2026-09-22. Branch: `features/project-workflow-30-34`, based on `23a1f1e`.
Evidence applies to the working tree, not a committed release artifact. Existing
owner documentation changes (plan renumbering and post-v1 plans) were preserved.
No release, merge or publication is authorized by this record.

## Scope and result

Portable CAD/setup files and opt-in caches, local recovery, contextual advanced
controls/editing/onboarding, volume/mass and viewport face access, and optional
report customization are implemented. The single workspace, toolbar arrangement,
Tet10 default, Stress/Deformation interaction and plain offline browser stack are
preserved. Practical load/support extensions remain Plans 35–37; advanced studies
remain Plans 39–46. Owner acceptance of this batch is **pending**.

## Automated evidence

Environment: Linux, Google Chrome for Testing 151.0.7922.34, headless Playwright
installed only under ignored build tooling. No runtime application dependency was
added. First-party native kernels, vendored assets and worker/WASM packaging were
not changed.

- All 41 applicable browser harnesses pass using direct `file://` access. Coverage
  includes the eight new project/recovery/contextual/info/face harnesses plus
  existing CAD import, drafts/history, units, workspace, worker, Tet4/Tet10,
  solver, convergence, result, report and numerical benchmark regressions.
- Focused HTTP checks at 2× device pixel ratio cover project codec, actual CAD,
  interface, recovery, face access, solved report workflow and workspace layout.
- Python unittest suite: 77 tests passed. Native CMake/CTest: 8 tests passed.
- Independent Python project inspection validates stored ZIP/CRC, source SHA-256
  and typed-array lengths/hashes. The actual solved cube package contains 33
  binary arrays, totaling 3,379,508 bytes, plus 3,023 source bytes. Independent DOCX
  inspection passes with five default scene captures.
- Four themes × three effective CSS viewport sizes (100%/125%/200% equivalents),
  at 2× DPI with reduced motion: 12 cases without page overflow. These are
  viewport equivalents, not physical browser zoom or manual assistive testing.

Reproducible browser entry points and build commands are listed in README. Local
run records are `build/plans30-34-browser-final.json`,
`build/plans30-34-browser-final.log`, `build/plans30-34-http.log`,
`build/plans30-34-visual.json`, `build/plans30-34-python.log` and
`build/plans30-34-native.log`. Memory samples are in
`build/plans30-34-memory.json`. They are ignored artifacts, not required source.

The full 50-model CAD corpus and broad resource/platform benchmark were not
repeated: importer/solver kernels and packaged workers are unchanged. Actual
STEP/IGES/BREP project round trips, cylinder and through-hole fixtures, the
analytical post-reopen solve and ordinary validation benchmark were run. Full
cross-platform/resource and exact-artifact acceptance remain Plans 38/20.

## Performance and allocation evidence

A measured file-mode run saved setup-only STEP/IGES/BREP cube files in 1.2/1.0/0.7 ms;
source sizes were 3,023/12,394/2,516 bytes, packages 5,191/14,721/4,840 bytes.
These small-fixture timings are observations, not large-model performance claims.
Cylinder (5,944 triangles) and through-hole (7,128 triangles) previews each ran
100 distinct-face ray picks in 25.6/28.7 ms in that run. No full geometry copies
are made per pointer event. Visibility changes update existing material groups.

Real IndexedDB tests retain four records sharing one source, coalesce an edit
burst into one write, reject stale ownership generations, and roll back an
injected failure after queuing a source write. Numerical buffers are absent from
recovery snapshots. Small synthetic source bytes prove transaction/dedup behavior;
large-source storage throughput has not been benchmarked.

The bounded project reader slices Blobs, validates aggregate array allocations,
and disposes the CAD worker before cache decoding. Shared ZIP writing retains
Blob/image parts rather than redundant pixel byte arrays. The old project remains
resident until atomic replacement. Allocation bounds and browser-copy caveats are
in [the format document](../project-format.md). Fresh browser processes were sampled every 100 ms during two complete cube
workflows (1500×1000 CSS viewport, 1× DPI). Summed RSS across the browser and all
its descendants peaked at 1,611,423,744 bytes for setup save/open (791,887,872-byte
blank-page baseline) and 1,674,768,384 bytes for the solved/default-and-customized
report plus optional-cache workflow (796,196,864-byte baseline). These include
browser, GPU, renderer, CAD/solver work and shared-page double counting; they are
not isolated codec heap measurements. Sampling can miss short-lived peaks.
Process peak memory at maximum archive/cache limits remains unmeasured; Plan 38
must retain large-model stress checks. No maximum-size memory pass is claimed.

## Review and remaining owner checks

Complete changed-source review includes persistence/worker boundaries, assignment
invalidation, recovery transactions, optional-cache compatibility, keyboard/dialog
handling and report restoration. Concrete review fixes have regression coverage:
editing suppressed definitions preserves suppression; prescribed-displacement-only
setups can request Mesh and solve; incompatible cached result/mesh pairs are
rejected; export cancellation restores presentation.

Use each Plan 30–34 owner walkthrough with an actual bracket/curved part. Remaining
manual checks include natural discovery of options, novice first use, real browser
zoom and keyboard/screen-reader behavior, larger CAD responsiveness, and visual
inspection of editable DOCX in the owner's Office viewer. Automated screenshots
and XML inspection do not substitute for those responses. No owner response has
been recorded for this implementation.


## Owner-requested workflow revision, 2026-09-22

The owner approved automatic reopen, File → New without a shortcut, Ctrl/Cmd+O/S,
no unload warning, a remembered dismissible guide, a prepared cube example and
shared options icons. This supersedes the original explicit-recovery picker and
global advanced-control disclosure design. Approval is of the design; a final
visual owner walkthrough is still pending.

- `project-resume-tests.html` drives the real app through the prepared example,
  verifies 1 kPa axial stress (±0.2 Pa) and −1,000 N reaction (±0.001 N), exercises
  shortcuts and direct mesh options, dismisses the guide, reloads automatically,
  verifies record reuse, reenables the guide through Help, and checks New followed
  by another reload remains empty. It also checks the placeholder cube is absent,
  the mesh icon is contained by its row, and New closes the File menu.
- Recovery tests cover active-tab Web Lock conflicts, closed-session adoption,
  remembered empty state, bounded retirement of inactive copies, and rollback
  that retains all old snapshots when the replacement transaction fails.
- Current verification: 42 applicable direct-file browser harnesses, 77 Python
  tests and 8 native tests pass. Focused HTTP/2× DPI checks cover the revised flow,
  recovery, projects, real CAD and reports. Records: `build/revision-browser.json`,
  `build/revision-http.log`, `build/revision-python.log`, `build/revision-native.log`.
- The shared UI Kit icon catalog is now selectively adopted and pinned in
  `UI_FOUNDATION.md` and the artifact manifest. Its generator check passes. This
  supersedes the earlier statement that no UI foundation assets changed; native
  kernels and packaged workers remain unchanged. No release audit is claimed.

Recovery persists committed state promptly, but cannot guarantee the last edit
survives a crash during a write or unavailable/cleared browser storage. No unload
prompt is used. Mesh/results and unapplied drafts remain outside automatic recovery.

## Follow-up: stable guide and compact editor headers

The owner requested explicit mesh instruction, stable guide anchors, compact
Apply/Cancel/Remove actions and reports beside Solve/Results. After reviewing the
first compact layout, the owner approved sharing the expanded assignment header
with its name and moving explanations beside their fields.

- The opening panel and explicit Help guide no longer compete. Guide stages use
  stable section headings and explicit navigation; Apply on Supports/Loads keeps
  the stage and position. The prepared example starts at Generate mesh, followed
  by inspection in Mesh view and a separate Solve step.
- Material, support, load and gravity headers use accessible checkmark Apply,
  × Cancel and shared UI Kit trash Remove. Remove is hidden for new items. Material
  cancellation restores committed properties. Field hints follow pressure,
  surface-normal or component inputs; report controls stay together beside Results.
- Regression checks cover starting guidance, support/load Apply, header geometry,
  contextual hints, material Cancel and explicit mesh → inspect → solve progression.
  The solved example retains the 1 kPa stress and −1,000 N reaction checks above.
- Visual checks cover dark/light palettes and 280/220-pixel Setup widths. At the
  minimum width, header names truncate while the Name field retains the full value.
  Evidence: `build/guide-header-load.png`, `build/guide-header-narrow.png`,
  `build/guide-header-light.png`, and `build/guide-empty.png`.

- Final verification: all 42 applicable direct-file browser harnesses pass, plus
  five HTTP/2× DPI harnesses (project resume/interface, grouped authoring, workspace
  layout and report workflow), 77 Python tests and eight native tests. Shared icon
  generation check and whitespace validation pass. Browser records:
  `build/guide-actions-browser.json` and `build/guide-actions-http.json`.

Design approval does not replace the remaining owner walkthrough of the final UI.

## Follow-up: action row and guidance to clickable controls

The owner replaced the previous header-action arrangement and section-heading
anchors with an action row below each expanded header and guidance to the actual
next control. This supersedes those layout details in the preceding review.

- ✓ Apply includes visible text and sits beside icon-only × Cancel on the left;
  red shared trash Remove sits on the right for existing items. Headers regain
  their full width. New-row summaries no longer wrap into a one-character column.
- Guidance highlights the Model/Material/Mesh opener, Add support/load, Apply,
  Generate mesh, Mesh view, Solve or Results as appropriate. It does not open
  editors or click controls automatically. Apply/Cancel return the support/load
  target to Add, with Next available when setup permits it. Ordinary rerenders
  keep the target and scroll position; explicit guide navigation may reveal an
  offscreen target.
- `project-resume-tests.html` covers these target transitions, visible Apply text,
  left/right action placement, Cancel, compact new headers, stable rerenders and
  explicit mesh inspection, followed by the existing analytical cube solve.
- Visual evidence: `build/click-guide-add.png`, `build/click-guide-apply.png`, and
  `build/guide-row-narrow.png` (220-pixel Setup). The latter confirms that the
  action row fits without truncating the assignment header to make room for icons.

- Verification: 42 applicable direct-file browser harnesses, 77 Python tests and
  eight native tests passed. The final new-header correction was rechecked in
  project resume, grouped authoring and workspace layout locally, plus those
  harnesses and project interface over HTTP at 2× DPI. Records:
  `build/click-guide-browser.json`, `build/click-guide-layout.json`, and
  `build/click-guide-http.json`. Whitespace validation passes.

The owner approved this design; final visual acceptance remains separate.


## Follow-up: Cancel text, material progression and view selector

- Cancel now retains its × icon and adds a visible label. Apply/Cancel sizing was
  checked with Remove at the minimum 220-pixel Setup width.
- Successful material Apply emits a UI completion event after closing the editor;
  the guide advances immediately to Supports. Failed validation stays on Material,
  and a dismissed guide remains dismissed. Mesh guidance explains density and
  refinement without naming Tet10.
- The view selector no longer draws divider seams beside the selected segment.
  Keyboard focus uses an underline instead of an inset box, retaining an explicit
  focus indicator without extra vertical bars. Shared vendored styles are unchanged.
- Regression coverage checks valid/invalid material Apply, visible Cancel text,
  beginner mesh copy and both selected-segment edges. Visual inspection covers
  keyboard focus and the narrow action row.
- Verification: all 42 applicable direct-file browser harnesses pass, with project
  resume and workspace layout also passing at 2× DPI. Records:
  `build/guide-polish-browser.json` and `build/guide-polish-2x.json`. Whitespace
  validation passes.


## Follow-up: face-selection guidance and an unclipped highlight

- Empty support/load drafts now point into the model with a face-selection prompt.
  Selecting faces changes the target to Apply; removing the last face restores
  the selection prompt. Existing assignments with faces and gravity skip picking.
- The guide ring now renders as a noninteractive document-level overlay, so the
  Model/Mesh selector cannot clip its top and bottom edges. It follows resize and
  pane scrolling and disappears with hidden targets or guide dismissal.
- The preceding selector-divider and keyboard-underline changes were reverted.
  The visual defect was the guide outline being clipped, not the selector's
  normal dividers or keyboard-focus styling.
- Regression coverage includes both assignment kinds, deselection, gravity,
  overlay geometry/click-through and dismissal. Actual viewport clicks were also
  exercised, followed by mesh generation, inspection and resize tracking. Visual
  evidence: `build/guide-face-picking.png`, `build/guide-face-picked.png`, and
  `build/guide-selector-ring.png`.
- Verification: all 42 applicable direct-file browser harnesses pass; focused
  guide, grouped-authoring and workspace-layout checks also pass at 2× DPI. The
  final guide regression additionally checks hiding/restoring the overlay when its
  target scrolls out of/back into view. Records: `build/guide-faces-browser.json`
  and `build/guide-faces-2x.json` (final guide run). Whitespace validation passes.

## Pre-merge review fixes, 2026-09-23

- Cached results omit derived factor-of-safety arrays, ranges and extrema, then
  recalculate them from validated stresses/material on open. A real WASM Tet4
  rigid-translation regression produces exactly zero stress and infinite FoS,
  round-trips the cache and selected FoS view, preserves the installed results,
  and still rejects nonfinite physical result metadata. Snapshot preparation
  shares the original solver arrays. The solved report-workflow cube now saves
  29 arrays / 3,196,152 binary bytes instead of 33 / 3,379,508.
- CAD preview curves carry validated adjacent-face IDs through worker transfer
  and model rotation. Hide/isolate retains edges belonging to any visible face,
  including in Model/Wireframe. Filtering reuses the existing line index buffer
  only on visibility changes, with one CAD-edge draw call and no added triangle
  diagonals. Tests cover exact cube outlines, restoration, repeated isolation,
  malformed ownership and real STEP/IGES/BREP edge extraction. The local worker
  wrapper and distribution hashes were regenerated from the changed source.
- Current-view report capture runs synchronously with its camera/visibility
  metadata before the first PNG encode yields. The finished report still places
  it after the preset images. The regression changes navigation and hidden faces
  during encoding and verifies snapshot consistency and retention of those later
  user changes; existing cancellation/failure restoration checks still pass.

The four focused harnesses failed on the original implementation for the expected
reasons and pass with the fixes. Fresh verification passed all 42 applicable
`file://` browser harnesses, the complete 50-case CAD corpus, 77 Python tests and
8 native tests. Independent project/DOCX inspection, the distribution artifact
audit and whitespace checks also pass. Local records are
`build/review-fixes-red.json`, `build/review-fixes-focused.json`,
`build/review-fixes-full.json` and `build/review-fixes-corpus.json`.

All ten focused HTTP harnesses also pass at 2× DPI: WASM results, face access,
STEP/IGES/BREP import, project codec/CAD/recovery/interface/resume, report workflow
and workspace layout (`build/review-fixes-http.json`). The complete fix diff was
reviewed for buffer ownership, invalidation, geometry-boundary validation,
cancellation/restoration and reproducible worker packaging before integration.
