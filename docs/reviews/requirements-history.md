# Historical specification amendments

Archived on 2026-09-22 during thematic consolidation of `spec.md`. This record preserves the evolution of requirements, including superseded wording and former plan numbers. It is not the current specification or an additional acceptance record. Current behavior and planned changes are defined in [the specification](../../spec.md); actual owner acceptance remains in the dated review records.

The successive M24–M27 notes below were ultimately accepted in [the grouped follow-up](24-27-followup.md). Former Plans 31/32 are now Plans 28/29. The former STL Plans 28/29 remain archived on `features/stl-import` and are unrelated to the newly assigned numbers.

### Plans 24–27 implementation notes (owner review pending)

The owner requested a combined manual review after all four implementations on
2026-09-08. Intermediate M24–M27 acceptance gates remain unchecked until that review.

Plan 24: presentation normalizes `lines` to `shaded-edges`; `shaded` and
`wireframe` are explicit alternatives. Result part outlines follow CAD face
boundaries separately from element overlay lines. Result colors use an unlit
material with sRGB-to-linear vertex conversion to match the legend.
`viewportPresentation.colorRange` holds `{mode, field, locked, minimum?, maximum?}`
in SI units, separate from numerical result ranges. Manual bounds are finite and
strictly ordered; an automatic locked uniform range may have equal endpoints.
Limits reset on incompatible field changes and survive compatible unit changes.
`legendOrientation` defaults to vertical, with two to seven height-aware labels;
horizontal labels only endpoints. FoS cap reads `10+`. Units are Pa/kPa/MPa or
m/mm. Only validated compact style and orientation preferences persist.

Plan 25: `assignmentDraft` is the sole transient support/load transaction, with
`kind`, optional `itemId`, `faceIds`, SI `definition`, `baseAnalysisRevision`,
geometry identity, dirty state, and validation feedback. Controller commands
`beginAssignmentDraft(kind, itemId?, definition?)`, `updateAssignmentDraft(patch)`,
`toggleDraftFace(faceId)`, `commitAssignmentDraft()`, and `cancelAssignmentDraft()`
separate previews from committed engineering state. Validation rejects stale
revisions, malformed values/faces, and conflicting prescribed components on the
same face. Existing mesh/native checks remain authoritative for shared-node
conflicts across different faces. Apply uses one existing invalidation boundary;
unchanged Save and Cancel preserve revision, mesh, preflight, and results.
Plain draft clicks toggle faces; background preserves the set. Escape cancels
before ordinary selection clearing. Opening another editor requires explicit
Apply/Cancel for a dirty draft. Results enter a selectable view for authoring,
and Cancel restores the prior available presentation. Face samples are cached
per geometry/mesh with bounded per-face samples; the viewport reuses unchanged
glyph resources and application updates coalesce to one animation frame.

Plan 26: `solveReadiness(document)` centralizes canCheck/canSolve, status, and
action guidance. Both controller gates and the UI use it. `lastSolveCheck` retains
only compact preflight diagnostics and revision so a stale report remains
inspectable without authorizing a solve. Reports prioritize actionable setup links,
constraint readiness, and estimated memory; detailed topology/runtime figures
are expandable. Completed/failed/cancelled solve workers require an explicit
new check before retrying. Assignment names are trimmed nonempty text.
`renameAssignment(kind,id,name)` and name-only assignment replacement are metadata
edits; they retain numerical revision/results/preflight. Automatic name sequences
still advance independently and monotonically.

Plan 27: controller-owned `EngineeringHistory` retains at most 50 commands and
2 MiB of UTF-8 serialized definitions, evicting oldest entries deterministically.
An individual oversized command clears incompatible history. Commands contain
small before/after definitions, labels, geometry identity, and assignment order;
rigid orientation uses rotation matrices and operation metadata. Source bytes,
mesh/result typed arrays, worker objects, and WASM contexts are excluded. Undo
and redo use ordinary validation/invalidation, retain assignment IDs, and never
rewind name/ID allocators or analysis revisions. A new edit discards redo;
no-op Save and cancelled drafts add nothing. Metadata-only rename replay keeps
results and preflight. Import/replacement/removal clear history after validation.
Undo/Redo is disabled during any assignment draft or worker execution. Edit-menu
and toolbar labels identify the command; status explains recheck/remesh needs.
Platform shortcuts exclude editable fields, composition, modals, and Settings,
and leave browser commands untouched when no app history action is available.
Assignment drafts also block convergence startup before disposing a ready solver.


### M24–M27 manual-review corrections (acceptance pending)

The owner requested these changes after the first combined review. They supersede
Task 26's originally explicit separate check-then-Solve interaction. Solve checks
and then runs; cap/failure/draft/busy gates and large-memory confirmation remain.
Cancelled or disposed workers are rechecked on retry. Import, mesh completion,
opening a report, and presentation changes do not start checks by themselves.
Checks explain concrete repairs with editor links and named free rigid motions.

Deformation defaults to Auto on entry. Editing minimum/maximum chooses Manual;
input widths match Display selects. Legends are movable/resizable by pointer or
keyboard, with bounds clamped to the central viewport and compact validated
per-orientation placement preferences. Horizontal defaults wider. The color bar
fills available width/height as the legend resizes. Tools/Results use accent and
selection-text tokens when engaged, including light themes.

Planar glyph samples use a regular surface grid; curved or trimmed surfaces use
bounded area-stratified candidates and farthest-point spacing. Samples retain
local normals and are cached per surface. Glyphs are qualitative direction cues.
Apply/Save clears selected faces. Force defaults to normal magnitude 1 N with
Push/Pull; component defaults are [0,1,0] N and pressure defaults to 1 MPa. Gravity
has its own Loads editor, directional components/presets, Apply/Save, Cancel edit,
Remove gravity, and independent presentation visibility. Enabling gravity restores its arrow;
disabled gravity never draws arrows. Top-right status and activity icon report
worker progress and short outcomes; routine history prose beneath Setup is hidden.
Transfer uses almost the full viewport with original, mapped, and current preview
glyphs in the respective model views. M24–M27 remain pending another owner check.

### M24–M27 second manual-review corrections (acceptance pending)

A new solve preserves the previously selected viewport mode, result field,
deformation mode, and user scale through engineering edits, assignment drafts,
and remeshing. The first solve defaults to von Mises stress. Color limits reset
to Automatic and unlocked after each solve; Auto deformation recomputes its scale
from the new result. Convergence result updates follow the same rule.

Gravity uses the assignment transaction with no face selection: its live preview
changes neither calculation nor history; Apply enables calculation directly,
Save changes edits it, Cancel restores the prior state, and Remove gravity disables
it. Existing draft/busy/validation/history gates apply. Arrow visibility stays a
presentation choice. Display independently controls support, load, and gravity
arrows; valid active assignment previews remain visible while editing.

Surface glyphs use at least six samples per nondegenerate CAD face, with target
spacing one quarter of the model's largest extent. Area and face span both set
density so thin surfaces also receive coverage. Planar grids constrain both axis
spacings; curved/trimmed sampling adds points until the bounded candidate coverage
meets the target. A 128-sample per-face cap bounds pathological surfaces; at this
cap the spacing target may be exceeded. Samples stay deterministic and cached.

Viewport controls are centered, with result/deformation controls below the primary
row. Perspective is in Display. Rotate and pan bindings each allow left, middle,
or right mouse buttons; assigning an occupied button swaps the other binding,
and the navigation hint follows the selected buttons. Preferences remain local.

Settings is in File, and Help → About provides application information and license
notices. Model summaries show format and face count without orientation status.
Material summaries put E in GPa at the left of the second line; Poisson's ratio
remains editable in the material form. Empty Supports/Loads offer Add support… /
Add load… rows. The CAD editor has no face-selection status or Clear selection
button; viewport selection and background/Escape deselection remain available.

### M24–M27 approval adjustments (2026-09-10)

Result stress units include Pa, kPa, MPa, psi, and ksi; displacement units include
m, mm, and inch (`in`). Stored results and color limits remain SI. Conversion
uses the international pound and inch with standard gravity: 1 psi =
0.45359237 × 9.80665 / 0.0254² Pa, 1 ksi = 1000 psi, and 1 in = 0.0254 m.
Legends, manual limits, result summaries, and point displacement values follow the
selected units without invalidating analysis. Coordinate labels retain explicit m.

Fit model uses a brief, cancellable camera animation that preserves the viewing
angle and honors reduced-motion preferences. Its Truss zoom-to-fit icon is below
and left of the view gizmo, opposite Reset, with the same hover/focus styling.
Undo, Redo, Save, Export, Setup, and Results reuse the Truss action icons; Setup
and Results retain text labels, while Save remains a disabled placeholder and Export downloads the solved report.
The Setup toggle replaces the panel's duplicate title. Add material has no
“required before solving” subtitle. Edit shows Ctrl+Z and Ctrl+Y beside its dynamic
Undo/Redo descriptions.

The owner approved M24–M27 with these adjustments. Acceptance covers this grouped
workflow; plan 30 and the final release audit remain separate gates.

## Material, load-entry, and report follow-up

- [x] [former Plan 31 (now 28): material strengths, load units, and report export](../plans/28-material-units-and-report.md)
  adds documented bulk PLA tensile/compressive yield and ABS compressive yield;
  persistent inline pressure (MPa default, Pa, psi, ksi) and force (N default,
  kN, lbf, kip) unit choices that convert draft values while preserving SI;
  Force as the initial load type; undeformed part dimensions in Results; and a
  local ZIP report with all Results information and reset/fitted scene PNGs for
  assignments, mesh, stress, optional FoS, and Auto deformation.


former Plan 31 (now 28) implementation contracts:
- PLA adds 62 MPa tensile yield and 70.8 MPa compressive yield; ABS adds 46.1 MPa
  compressive yield. Existing fields retain their provenance. These are bulk
  reference inputs with explicit mixed-source limitations; see
  [material strength evidence](../material-strengths.md).
- Load unit preferences belong to the authoring UI, under browser storage key
  `spjutsim-fea.load-input-units`; analysis loads remain SI. Pressure defaults to
  MPa and force to N. Changing a unit converts all associated values atomically;
  blank inputs remain blank and invalid changes retain the previous preference.
- Results/report summary rows share `web/js/ui/result-summary.js`. Original part
  size is the undeformed geometry bounding box in study global axes, displayed
  using the result length unit. It does not include deformation exaggeration.
- `web/js/ui/report-export.js` owns report formatting, export eligibility and
  dependency-free stored ZIP packaging. Current solved results are required;
  drafts, running operations and stale revisions cannot export. `report.txt`
  includes setup parameters, material provenance where matched, assumptions,
  Results/diagnostics and the convergence table; tables use tabs between cells.
- `web/js/render/report-capture.js` owns five preset scene PNGs (four without FoS).
  Each capture applies Reset View then Fit Model and restores camera, selection,
  probe, overlays, presentation and animation multiplier in `finally`. Main-scene
  rendering omits grid/gizmo/chrome. Legends share the renderer's color function
  with explicit linear-to-sRGB conversion. Result limits are Auto; deformation is
  Auto shape with the existing scale calculation. Output uses current projection,
  result display units and viewport resolution. No PDF or project serialization
  is introduced. No new application dependencies or worker artifacts are needed.

### former Plan 32 (now 29) — document reports and unit preferences

- [x] [Document reports and preferred units](../plans/29-document-report-and-unit-preferences.md): dependency-free DOCX alongside text/PNG ZIP, stable Settings size, SI/USCS and saved custom display/input units. Engineering state remains SI; preference changes preserve entered physical values and solved results.
