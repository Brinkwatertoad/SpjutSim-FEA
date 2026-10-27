# SpjutSim UI Kit consumer reference

## Current local runtime candidate — authorized 2026-10-25

FEA loads selected canonical UI Kit controllers from `web/ui/runtime`. This is an **unpublished 0.8.0 development candidate**, with the exact source snapshot and artifact/file hashes in [ui-kit.lock.json](../web/ui/runtime/ui-kit.lock.json). It is not a new published release pin. The app needs no sibling checkout, Node or network service to run.

Icons, dropdown, Settings navigation, overflow menus and tooltips. The 3D viewport, orientation controls, camera and all engineering state remain local.

The owner explicitly approved A02: above 640px, the app title is 22px bold and menu labels are 13px semibold. This is a local typography adapter; narrow layouts, palette and all 3D controls are unchanged. Circuits proposal A01 was declined. App adapters still own values, persistence, history and domain behavior. The current shell comparison is [the sibling audit gallery](../../SpjutSim-UI-Kit/artifacts/visual-audit/statics-alignment/index.html); automated comparisons do not record owner visual approval.

Edit canonical controllers in UI Kit, build one artifact and use its `scripts/update-consumer.mjs` updater. Never hand-edit this generated directory. Validate local bytes with `node web/ui/runtime/scripts/runtime.cjs`, then run the app's applicable native checks. Installed files do not by themselves imply execution; the kit registry records actual `runtimeComponents` and local exceptions separately. See [adoption details](../../SpjutSim-UI-Kit/docs/consumer-adoption.md).

## Historical reference provenance

The reference pins and prepared merges below describe earlier integration evidence. Preserve their exact commits; current runtime files are identified by the lock above. Remaining unpromoted references keep their existing reference-merge boundary.


## Menu and transient-surface checkpoint — 2026-10-25

Matching menu and tooltip mechanics now execute from the canonical candidate, preserving app styling, command trees and state ownership. See [actual per-app ownership](../../SpjutSim-UI-Kit/docs/menu-transient-runtime.md) and the [open-menu visual comparisons](../../SpjutSim-UI-Kit/artifacts/visual-audit/menus/index.html). Native gates and remaining release blockers are recorded in the sibling kit integration progress; this is not a new published pin or deployment.

## Palette adoption checkpoint — 2026-10-26

The palette library and editor now execute from `web/ui/runtime/reference/`. Duplicate `web/ui/color-schemes.js` and `web/ui/color-scheme-editor.js` are removed. `web/js/ui/fea-color-schemes.js` owns the existing FEA control/hover/selection derivation, brightness contrast threshold, final override precedence and full-canvas validation through `resolveColorPalette` and `completeColorScheme`; the editor preview uses the same adapter as the real application. Factories, persistence, portable version-3 import/export, FEA extensions, CSS publication and 3D materials remain app-owned.

The existing committed runtime artifact and generated files are unchanged. Appearance preservation is verified against factory themes, edited palettes and narrow layouts; see the batch evidence before applying. This is an ownership change, not a new theme or layout.

## Shared panes — 2026-10-26

Pane pointer/keyboard handling, snapshot rollback, focus/drawer helpers and divider/gutter CSS now execute from the generated UI Kit runtime. B18/B20 intentionally use 8px desktop strips, 20px coarse-pointer strips and slim closed desktop edges. Semantic colors, pane contents, storage keys, document/history ownership and editing transactions remain local.

The sibling UI Kit docs/panes.md records host profiles and adapter policies. Use its canonical source and mechanical pinned updater for shared fixes; place an explicit app-local exception outside generated assets. Historical published reference pins remain historical evidence; the runtime lock records the actual source. The implementation before/after gallery covers desktop, tablet, phone and coarse-pointer geometry.
