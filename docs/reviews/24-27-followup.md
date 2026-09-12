# M24–M27 corrections — accepted owner review

Status: **Accepted by the owner on 2026-09-10**. The owner approved the group with
final adjustments for imperial result units, Truss icons, animated Fit model,
Setup naming, the material placeholder, and Edit-menu hotkey labels. Those changes
are implemented in `0ed6e31`; the earlier follow-ups are `c7a1de5` and `cc8212e`.
The approved `work/plans-24-27` group is merged into main. The checklists below
remain as review reference, not outstanding acceptance gates.

The final changes preserve SI storage while displaying psi/ksi/inch in legends,
manual limits, point displacement values, and Results summaries. Fit model moves
to the lower-left of the gizmo and uses the cancellable camera transition with
reduced-motion support. Setup replaces Tools and the duplicate pane title is gone.
Undo/Redo/Save/Export use Truss icons; Setup/Results keep icons plus labels.
Ctrl+Z and Ctrl+Y remain visible beside dynamic Edit-menu descriptions.

Open `web/index.html` directly or use `python3 tools/serve.py`. The shared cube
and material in the first packet remain useful. This time, press **Solve**:
Checks opens first, then Results when the check passes. Run checks only is
available inside Checks. Cancel remains beside Solve; the existing large-memory
confirmation and hard memory cap still apply.

## Suggested recheck

- [ ] Deformation opens with **Auto**. Edit either color limit without changing
  the mode first: it becomes Manual, and both inputs match the dropdown width.
- [ ] Switch vertical/horizontal legend. Drag its title to another location and
  resize with the bottom-right handle. The bar grows in both dimensions and
  labels remain readable. Resize the window, change views, and reload: placement
  and size persist per orientation and stay inside the central viewport.
  Arrow keys on the title/handle offer the same controls; Shift uses larger steps.
- [ ] Toggle Tools and Results in Light and Dark themes. Engaged buttons use
  accent with readable text.
- [ ] Click a result point: check the dot and nearby coordinates/values. Orbit
  and try Deformation; the surface point follows the deformed surface. Locate peak
  replaces it with the labeled internal sample without moving the camera.
  Background-click or Escape clears either selection; Locate peak also toggles off.
- [ ] Preview pressure and force on planar and curved faces. Arrows should cover
  the selected area evenly without clustering. Pressure starts at 1 MPa; force
  starts at 1 N, Surface normal. Try Push/Pull, then Components (0,1,0 N).
  Multiple selected normals distribute the magnitude by area and may cancel in
  the net force. Apply/Save clears face highlighting; Cancel still restores state.
- [ ] Open **Gravity…** in Loads. Choose a direction or components and Apply. Confirm its Loads row and directional arrow. Hide/show its arrow
  independently in Display. Reopen to Save changes, Cancel edit, or Remove gravity.
  Cancel keeps the existing calculation; Remove drops the row and arrow. Applying again shows the arrow. Density is required to enable calculation.
- [ ] Press Solve with an incomplete setup. Read concrete repair instructions,
  follow their editor buttons, fix the model, and press Solve again. Checks is
  before Results. Try cancellation while checking/solving, then retry. Routine
  history text below Setup is gone; top-right progress includes an activity icon.
- [ ] Replace the CAD model. The transfer dialog should use nearly the whole
  window. Current assignments, the active replacement preview, and previously
  mapped assignments should remain visible in the respective model views.
  Plain clicks toggle replacement faces. Map, go Back, Drop, and Cancel once.

## Latest corrections to recheck

- [ ] Select Stress → Maximum principal stress, change a load, then Solve again:
  keep the same view/field with Auto color limits. Repeat with Deformation → Uy,
  first Auto and then a user scale. Auto should adapt to the new displacement.
- [ ] Check arrow coverage on a small face, a long thin face, and a curved face.
  Each face has at least six arrows; larger faces gain arrows to meet spacing.
  Show support arrows, Show load arrows, and Show gravity arrow are independent.
- [ ] Top viewport controls stay centered; additional field/shape controls occupy
  the row below. Perspective is inside Display.
- [ ] File → Settings → Controls: try middle-button rotate and middle-button pan.
  Assigning an occupied button swaps the other binding; the viewport hint updates.
- [ ] Help → About opens and closes by keyboard, including Escape. Licenses are
  available there. Settings is under File.
- [ ] Model shows format/face count without orientation status. Material shows
  “E: … GPa” at the left of its second line. Empty Supports/Loads provide clickable
  Add rows. The CAD editor has no face-selection message or Clear button.

## Verification

The final acceptance delta also passes the 23 browser harnesses, 77 Python tests,
8 native tests, distribution audit, and direct-file/HTTP workflows. Added coverage
checks psi/ksi/inch conversion, SI range preservation, imperial point details,
menu shortcut retention, animated fit and reduced-motion behavior. Toolbar/gizmo
placement and narrow layouts were visually checked in Chromium.

- 23 browser harnesses pass: the previous 22 plus `review-contract-tests.html`.
  `grouped-authoring-tests.html` now exercises the revised workflow, including
  a real normal-force Tet10 solve compared with its component-force equivalent,
  retained stress/deformation settings, locked-range reset, gravity transactions,
  support visibility, empty Add rows, and Help/About modal keyboard isolation.
- 77 Python tests and 8 native tests pass. The distribution checksum audit passes.
- Direct-file startup/workflow and HTTP startup/grouped workflow pass. Pointer
  drag/resize, keyboard legend controls, Light/Dark captures, point-label bounds,
  and 500×400 through 1440×900 workspace bounds were checked in Chromium.
- New normal-force area normalization runs in the solver worker. It uses the
  native three-point Tri6 quadrature, tested against an independently derived
  curved-surface area and a flat-surface result. The native pressure kernel and
  WASM binary are unchanged. The worker wrapper was regenerated reproducibly
  with `tools/build-local-runtime.py`; its manifest hashes were refreshed.
- The diff review covered numerical sign/normalization, invalidation and history,
  worker cancellation/identity, bounded sample/cache/legend state, accessibility,
  and direct-local loading. No dependency or vendor changes.

Owner decision: **Approved with the final adjustments, now implemented and verified.**
