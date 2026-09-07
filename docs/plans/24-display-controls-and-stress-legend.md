# Task 24: Contextual display controls and stress legend implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at M24 before Task 25.

**Goal:** Make display changes discoverable and provide a vertical, informative stress key by default.

**Architecture:** The analysis controller owns a normalized presentation contract; app-owned controls consume it. Separate result-field ranges from user color-range preferences. Keep legend layout, number formatting, and colormap mapping consistent with the renderer.

**Tech Stack:** Classic JavaScript, CSS, Three.js, copied UI Kit segmented/select/tooltip primitives.

**Spec:** `spec.md` Sections 11.4–11.6, 12.3, 15.5, 15.8, 15.11, and 18.

## Dependencies and constraints

- Requires accepted M23; consumes Task 21 overlay bounds, Task 22 boundary ranges/formatting, and Task 23 camera controls.
- No UI state duplicates the native select value or engineering result model.
- Legend orientation defaults to vertical; horizontal shows only minimum and maximum.
- Presentation changes cannot invalidate a valid solve or change numerical extrema.

## Implementation

### 1. Separate view selection, appearance, and deformation controls

**Modify:** `web/index.html`, `web/css/app.css`, `web/js/ui/ui-controller.js`, `web/js/analysis/analysis-document.js`, `web/js/analysis/app-controller.js`, `web/js/render/viewport-controller.js`.
**Create tests:** `tests/browser/result-presentation-tests.{html,js}`; extend `tests/browser/wasm-solve-result-tests.js`.

- [ ] Add failing tests for Model/Mesh/Stress/Deformation availability and independent part-edge versus mesh-edge visibility. Specifically, unchecking Mesh overlay must remove mesh lines in shaded result views.
- [ ] Use a compact segmented main view control and a contextual field/deformation row. Move infrequent appearance settings into a bounded Display popover; keep camera commands easily reachable.
- [ ] Normalize display styles as `shaded`, `shaded-edges`, and `wireframe`, migrating current `lines` values intentionally. Shaded part edges use CAD/patch feature boundaries; mesh overlay uses element edges. Mesh mode still exposes its element topology explicitly.
- [ ] Default results to a clean contour with subtle part outlines and mesh overlay off. Add fixtures ensuring no surface triangulation is mistaken for part edges. Preserve visible deformation scale and Play/Stop behavior.
- [ ] Reduce lighting-induced color washout in result materials while preserving useful shape cues; verify a known scalar palette against the legend and retain theme-independent numerical colors.

### 2. Add legend orientation, ticks, and range controls

**Create:** `web/js/ui/result-legend.js`.
**Modify:** UI/controller/presentation files above; use Task 22 `result-formatting.js`.

- [ ] Test vertical tick positions, horizontal two-label behavior, short-height tick reduction, uniform fields, negative/signed fields, unit changes, and narrow-container bounds.
- [ ] Put the vertical key along the viewport right edge with approximately five to seven labels when space permits, highest value at top. Use minimum/maximum only horizontally; preserve an explicit orientation preference across sessions.
- [ ] Add Automatic/Manual range and range lock controls. Require finite ordered bounds, explain clipping, and keep locked ranges specific to compatible field/units; changing field must not reuse incompatible limits. Handle a uniform field without division by zero.
- [ ] Display capped FoS as `10+` at its cap and keep true FoS/peaks in summaries. Legend title/status identifies units, smoothing, and clipping without repeating unnecessary technical detail.
- [ ] Store only compact validated presentation preferences; do not persist result buffers. Update spec/README and run focused plus complete applicable Python/browser tests and direct-local startup.

## Manual review M24 — choosing and reading a display, about 15 minutes

- [ ] Owner switches among all four views, finds principal stress/displacement/FoS, removes mesh lines, and adjusts deformation without hunting through unrelated controls.
- [ ] Try vertical/horizontal legends, short-window layouts, range lock across two results, manual clipping, and a constant field.
- [ ] Compare known contour colors to the key in light/dark themes; confirm field/units and the sample-peak versus surface-key distinction remain clear.
- [ ] Record acceptance before Task 25.

## Done when

Display controls are contextual, mesh visibility is independent, legends reflect the chosen mapping, numerical outputs are unchanged, and M24 is accepted.
