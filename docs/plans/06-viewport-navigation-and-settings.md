# Task 6: Complete viewport navigation and settings

## Outcome

Turn the existing left-drag orbit and wheel zoom into a complete, predictable
camera interaction system. Add pan, pinch and keyboard rotation, fit/reset
actions, and a SpjutSim-style Settings dialog where navigation preferences can
be changed without affecting analysis data.

## Implementation

- Extract camera/navigation state from rendering concerns enough to test orbit,
  pan, zoom bounds, fit, and reset deterministically. Preserve the current view
  target across redraws and mesh/result presentation changes.
- Keep the default bindings explicit: left-button drag rotates, right-button
  drag pans in the camera plane, wheel and two-pointer pinch zoom, and arrow
  keys rotate in fixed increments. Prevent the context menu only for a viewport
  gesture and distinguish a click from a drag so face selection still works.
- Make pointer handling robust across capture loss, pointer cancellation,
  resize, multiple touch contacts, poles, very small/large models, and disposal.
  Do not add a runtime dependency on Three.js add-on controls.
- Give the canvas an accessible interaction target and concise control help.
  Arrow keys rotate application-wide unless an editable control, menu, modal,
  or arrow-navigated widget owns the event; camera input must never change face
  selection.
- Adapt the checked-in SpjutSim settings dialog/hub into `web/index.html` with a
  Controls category. Open it from the application menu and with `Control+,` or
  `Command+,`; trap/restore focus and support Escape/Close.
- Store validated UI preferences outside engineering inputs. Allow users to
  swap non-conflicting rotate/pan mouse buttons, reverse zoom, adjust
  rotate/pan/zoom sensitivity and arrow step, and reset controls to defaults.
  Persist preferences locally with a versioned schema and recover safely from
  corrupt or obsolete values.
- Add visible Fit model and Reset view commands in the viewport or View menu.
  Reframing after a new import is allowed; remeshing or solving must not
  unexpectedly reset a user-adjusted camera.

## Verification

- Unit-test camera math, binding validation, preference migration/fallback,
  drag thresholds, pan direction, zoom clamping, pinch distance, and shortcut
  filtering for editable/modal targets.
- Extend browser coverage for left-drag orbit, right-drag pan, wheel and pinch
  zoom, arrow rotation, fit/reset, changed bindings, focus restoration, and
  pointer cancellation. Verify click/Shift-click face selection after each.
- Exercise mouse, trackpad, touch emulation, high-DPI resize, `file://`, and HTTP;
  check that repeated controller creation/disposal leaves no listeners behind.

## Done when

The documented defaults work consistently, every camera action has an
accessible path, settings can change and reset the mappings safely, and camera
navigation never causes an accidental face pick or analysis-state change.
