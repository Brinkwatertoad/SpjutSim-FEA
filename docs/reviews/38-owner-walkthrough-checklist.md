# Plans 21–38 owner walkthrough

Status: **Ready for your walkthrough; acceptance is pending.**
Allow about 60 minutes for the core sequence and 20–30 minutes for advanced/failure
checks. Start with a fresh browser tab. Record anything confusing before reading
the implementation reviews; the interface should explain the workflow itself.

Open [the application](../../web/index.html) directly in desktop Chromium, or run
`python3 tools/serve.py` and open `http://127.0.0.1:8000/web/`. Repeat the short
open/solve/save/report path over HTTP and in Firefox. Use Settings → Units → SI
for the expected values below. The four projects contain CAD and setup only;
opening one should lead naturally to **Mesh and solve**.

## Prepared projects

Download/open through File → Open (the browser may download these links first).
These are numerical review fixtures with E = 1 GPa and ν = 0.25.

| Project | Purpose | Expected result with its saved Tet10 mesh settings |
| --- | --- | --- |
| [Bearing hole](fixtures/36-38/bearing-hole.spjutsim-fea) | Complete cylindrical hole; 100 N along global +X | Max displacement ≈0.000704 mm; reaction ≈−100 N in X; strain energy ≈3.0466e−5 J |
| [Torsion shaft](fixtures/36-38/torsion-shaft.spjutsim-fea) | Radius 0.5 m, length 1 m; bottom fixed; +100 N·m about Z | Max displacement ≈0.0012735 mm; essentially zero net force; reaction moment ≈−100 N·m about Z |
| [Offset cantilever](fixtures/36-38/offset-cantilever.spjutsim-fea) | 4 × 0.25 × 0.5 m beam; −1000 N in Z at [5, 0.125, 0.25] m | Max displacement ≈11.363 mm; reaction ≈+1000 N in Z; load moment +1000 N·m in Y about the entered tip reference; global moment +3000 N·m in Y about the reported bounding-box center |
| [Asymmetric bracket](fixtures/36-38/asymmetric-bracket.spjutsim-fea) | Rotated boss/bracket; CAD-local offset force; custom mesh and yield strength | Volume ≈0.24226195 m³; mass ≈242.26195 kg; max displacement ≈0.188667 mm; global force [0, 0, −100] N; moment [−17.5829, 41.4227, 0] N·m about its reference |

Small lateral bearing resultants reflect boundary discretization: the declared
limit is 0.5% of the entered force, with a similarly scaled band-center moment.
Force and global moment equilibrium residuals should both be below 1e−6.
Peak stress near supports/load edges is mesh sensitive; it is not an acceptance
value in this table. [Exact recorded values and provenance](fixtures/36-38/expected-values.json).

## Ordinary workflow and result interpretation

- [x] Use Examples → Cantilever first (owner completed 2026-10-03). Complete mesh → checks → solve without
  opening advanced options. The guidance and enabled buttons make the next step clear.
- [ ] Open the bearing project. Model, Material, Support, Load and Mesh summaries
  are visible and understandable together. Expand only the row you need.
- [ ] Open Model: confirm dimensions, volume and source format. Open Material:
  confirm E/ν, edit a property, and distinguish a custom material from a sourced
  catalog material. Density changes mass without silently enabling gravity.
- [ ] Click an assignment row and identify its faces in the viewport. Add/edit a
  face, then close the editor. Valid changes commit; a blank/invalid number keeps
  the last valid definition and explains how to finish the edit.
- [ ] Generate a mesh and inspect Model/Mesh. Checks show element type, node/DOF
  counts, quality, constraint rank, memory estimate and any warnings before solving.
- [ ] Solve. Results lead with displacement, unaveraged stress and yield FoS when
  supplied. Find the difference between raw peak and smoothed surface stress;
  locate the peak and identify the reported displacement location.
- [ ] Switch Stress/Deformation, scalar/component fields, Auto/true/custom
  deformation scale and animation. Stress returns to undeformed geometry.
  Units change labels/values while preserving the solved engineering data.
- [ ] Use Check with a finer mesh. Distinguish stable displacement/energy from
  unresolved peak stress; read the convergence chart, thresholds, locations and
  selected-level explanation without needing help.
- [ ] Change a load/material after solving. Results clear with persistent feedback
  and a useful next action. Undo/Redo restores engineering inputs with the same
  invalidation rules; a rename or display-unit change keeps valid results.

## Bearing force — Plan 36

- [ ] Open the bearing load. Find its global cylinder axis, radius, band length,
  entered force and compressive cosine assumption in the editor.
- [ ] Orbit into the hole: inward arrows and the colored loaded-half region agree
  with the +X force. Reverse Fx and check that the loaded half moves. Undo.
- [ ] Hide/isolate/reveal the bearing face. The highlight follows face visibility.
  Model/Mesh show the loaded region; result contours remain readable.
- [ ] Solve and expand numerical diagnostics. Compare the requested load with its
  realized force/moment and the named global moment reference. Export wording
  describes the same idealization and excludes contact/friction/preload.
- [ ] Enter an axial force [0, 0, 100] N: it is rejected clearly and the previous
  transverse force remains committed. Select a planar face instead: reject it.
- [ ] Import [the split-cylinder fixture](../../tests/fixtures/bearing/split-cylinder.step).
  Select both curved halves: a 100 N transverse bearing is valid. Select only one:
  the partial band is rejected. Select a cone or mixed-axis cylinders: reject them.
- [ ] Duplicate, suppress, undo and remove the bearing assignment. Face ownership
  and its definition survive history, save/reopen and recovery.

## Moment and offset force — Plan 37

- [ ] Open the torsion project. Confirm [0, 0, 100] N·m and global reference
  [0, 0, 1] m. The curved arrow reads as a torque with a right-handed direction.
- [ ] Change the moment unit to lbf·in: 100 N·m becomes ≈885.07458 lbf·in.
  Switch back; neither the physical moment nor valid results changes.
- [ ] Solve the shaft. Check essentially zero applied force, +100 N·m applied
  moment and −100 N·m reaction moment. Change the reference point: a pure couple
  remains the same physical load. Reverse the torque and inspect the preview.
- [ ] Open the offset cantilever. Identify reference versus application point,
  the lever arm, force arrow and the expression `(application − reference) × F`.
  All point inputs explicitly use global coordinates.
- [ ] Solve and compare the expected values above. Explain why the per-load
  +1000 N·m differs from the global +3000 N·m: their reference points differ.
- [ ] Change the reference X from 4 m to 0 m, keeping the application point and
  force unchanged. Re-solve: deflection/reactions stay the same. The moment about
  the new reference becomes +5000 N·m in Y. Undo and restore the prepared setup.
- [ ] Blank a point coordinate or enter a zero moment. The invalid edit cannot
  replace the committed load. The interface explains the required correction.
- [ ] Read the distribution explanation: the surface stays flexible; this is
  simplified traction transfer. Results and the report show entered/realized
  resultants, origin and assumptions without suggesting a rigid connector.

## Local frames, selection and advanced settings — Plans 32–35

- [ ] Open the asymmetric bracket. Confirm its 23° CAD orientation, volume/mass,
  local offset force and active custom mesh settings in compact summaries.
- [ ] Edit its rectangular frame; distinguish global/manual axes from CAD-attached
  axes. Reference/application points stay global even when vector components are local.
- [ ] On a planar face try sliding/symmetry support: normal motion is constrained,
  tangential motion remains free, and loads are not automatically scaled.
  Try a curved support face: get an actionable restriction.
- [ ] Find every former View command through its current controls: projection,
  signed/isometric views and gizmo, fit, display style, independent mesh edges,
  grid/axes/glyph visibility and legend orientation/range/color direction.
- [ ] Access a small or obscured face, cycle/select through faces, hide/isolate and
  reveal all. Selection ownership remains intact after remeshing.
- [ ] Discover the options buttons by their accessible names, hover/focus hints
  and menu descriptions. Collapse the panels: active settings stay visible.

## Projects, recovery and reports — Plans 28–34

- [ ] Save CAD/setup only, start File → New, and reopen. Material, faces, local
  frames, points, units-independent SI values and custom settings survive;
  mesh/results are regenerated when absent.
- [ ] Save again with mesh/results included. Reopen: verified caches are reused.
  An incompatible cache produces an explicit setup-only choice/warning.
- [ ] Edit a valid value and refresh/close/reopen the tab. Local recovery restores
  committed setup, never a half-typed invalid value or a large numerical cache.
  The UI distinguishes browser recovery from your downloaded project file.
- [ ] View recovery management and restore/discard intentionally. File → New
  remains empty after refresh. Discarded recovery does not leave orphan CAD data.
- [ ] Replace CAD and review assignment mappings before applying. Reject an
  incompatible bearing band, regenerate a CAD frame on its mapped planar face,
  and retain explicitly global offset points for review. Cancel preserves the old study.
- [ ] Export default Word and ZIP reports. Check source/material/load/mesh/settings,
  units, assumptions, raw/displayed results, locations, force/moment balance and images.
- [ ] Use report options for title/notes, selected preset images and current view.
  Mandatory numerical context remains. Cancel an export and retry; camera,
  selection, animation phase and presentation are restored on success/failure/cancel.
- [ ] Repeat open → solve → save/reopen → recover → report three times. Controls
  remain responsive, workers finish/dispose, and recovery stays within four projects
  and its CAD-byte budget. Repeated exports do not progressively slow the viewport.

## Desktop accessibility and compatibility

- [ ] Repeat the ordinary path at **125% and 200% actual browser zoom** and on a
  **2× DPI** display. Resize panes/window, including a short/narrow window; controls
  stay reachable and the viewport retains usable space. Automated tests cover
  equivalent available sizes; this item records actual zoom/display usability.
- [ ] Try FEA Classic, Light, Dark and Vivid. Faces, glyphs, selection, contours,
  menus, numbers and focus remain readable in every theme.
- [ ] Use keyboard only for menus, row/options controls, input fields, pane
  splitters and dialogs. Escape/focus restoration is consistent; collapsing a pane
  never traps focus in hidden controls.
- [ ] Enable reduced motion. Animation/interaction remains usable and matches the
  documented preference. Repeat with advanced panels collapsed and expanded.
- [ ] Repeat one prepared solve/open/report in direct-local Chromium, HTTP Chromium
  and Firefox. Record browser/version/platform. Safari has no acceptance claim.

## Bounded failure checks

These synthetic harnesses exercise actual contracts/orchestration without
allocating multi-gigabyte buffers. Open them in the same documented browser mode;
wait for **Passed**. They supplement the manual invalid-draft checks above.

| State | Runnable check | Expected behavior |
| --- | --- | --- |
| Invalid drafts/history | [Surface editors](../../tests/browser/surface-load-ui-tests.html) | Last valid moment/offset retained; unit conversion and Undo agree |
| Underconstraint | Suppress the only support in a prepared project; run Checks | Explain missing rigid-mode constraints; no accepted solve; Undo permits retry |
| Incompatible new-load cache | [Integrated cycles](../../tests/browser/integrated-review-tests.html) | Missing load diagnostics discard the cache while preserving setup |
| Denied/quota storage and corrupt recovery | [Recovery](../../tests/browser/project-recovery-tests.html) and [workspace](../../tests/browser/workspace-layout-tests.html) | Live editing/manual save remains available; retained source data stays bounded |
| Memory cap and stale preflight | [Checks UI](../../tests/browser/solve-checks-ui-tests.html) | A cap-blocked/stale result cannot authorize a solve |
| ≥8 GiB confirmation | [Solve orchestration](../../tests/browser/solve-workflow-tests.html) | Explicit confirmation is required; declining never starts a solve |
| Failed import/single-solid restriction | Import [malformed CAD](../../tests/fixtures/invalid-step-text.step) or [two solids](../../tests/fixtures/cad-corpus/two-solids.step); [CAD workflow](../../tests/browser/cad-import-workflow-tests.html) | Clear error; installed project preserved; valid retry works |
| Cancel/retry mesh/solve | Start a prepared mesh/solve and use Cancel; [orchestration](../../tests/browser/solve-workflow-tests.html) and [convergence runner](../../tests/browser/convergence-runner-tests.html) | Partial results discarded and workers terminated; editing/retry works |
| Degenerate distribution/worker inputs | [Moment workflow](../../tests/browser/moment-load-tests.html); native resultant tests | Actionable rejection, no guessed distribution or accepted partial result |

## Record your decision

For each issue, record **project, step, expected/observed behavior, browser/zoom,
severity (blocker / confusing / cosmetic)** and a screenshot if useful.

- Owner/date/browser/platform:
- Core sequence completed:
- Advanced/failure sequence completed:
- Confusing steps or defects:
- Decision: Accepted / Changes requested / Remaining checks:

Return this record when ready. Acceptance remains pending until you explicitly
provide it; release publication and Task 20 are separate later actions.
