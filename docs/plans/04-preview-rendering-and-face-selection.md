# Task 4: Render geometry and select CAD faces

## Outcome

Display the imported preview and let the user pick CAD faces reliably. Store
selection in application state so it survives viewport redraws and later
remeshing.

## Implementation

- Extend `ViewportController` to consume only the preview contract: create
  Three.js buffer geometry, frame the camera, render opaque geometry and edges,
  and dispose replaced GPU resources.
- Preserve face identity during rendering. Use grouped draw ranges, a compact
  triangle-to-face lookup, or an equivalent data-oriented representation; do
  not create one JavaScript object per triangle.
- Implement pointer picking with canvas-coordinate normalization, current pixel
  ratio, and camera transforms. Return only a `FaceId` to the controller.
- Add controller-owned selection state and explicit commands to replace, toggle,
  and clear selected faces. Define selection as a UI/application concern, not a
  boundary condition by itself.
- Render selected faces with the existing semantic selection colors and expose
  selected-face count plus clear-selection action in the tools pane. Include
  keyboard-accessible clearing and do not make hover necessary to understand
  the state.
- Clear selection and render resources when geometry changes. Camera/view
  changes must not alter selection.

## Verification

- Unit-test selection commands, unknown `FaceId` rejection, invalidation on new
  geometry, and pointer-to-canvas coordinate calculations where practical.
- Use the STEP cube fixture to select each of six faces at multiple canvas sizes
  and device pixel ratios. Verify empty-space clicks, toggle behavior, resize,
  camera movement, and geometry replacement.
- Exercise direct-local and HTTP modes and inspect repeated imports for leaked
  scenes, event listeners, and GPU resources.

## Done when

Every visible cube face can be selected as its expected opaque `FaceId`, the UI
and viewport consistently reflect controller state, and selections remain valid
across redraws without coupling rendering code to Gmsh entity tags.

