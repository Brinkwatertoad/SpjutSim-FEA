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

Pane pointer/keyboard handling, snapshot rollback, focus/drawer helpers and divider/gutter CSS now execute from the generated UI Kit runtime. B18/B20 intentionally use 8px strips for both fine and coarse pointers and slim closed desktop edges. Semantic colors, pane contents, storage keys, document/history ownership and editing transactions remain local.

The sibling UI Kit docs/panes.md records host profiles and adapter policies. Use its canonical source and mechanical pinned updater for shared fixes; place an explicit app-local exception outside generated assets. Historical published reference pins remain historical evidence; the runtime lock records the actual source. The implementation before/after gallery covers desktop, tablet, phone and coarse-pointer geometry.

## Remaining pane rollout review — 2026-10-27

Reconciled against remote main 685680439bb6a1958aa5d1abe07a4517e3efe385. The prepared pane lifecycle is retained. This review also corrects the outdated 20px touch-strip description and lets the action row reserve its actual height when controls wrap, preventing the viewport from covering the pane toggle. Roomy layouts retain their direct actions. The current runtime uses 8px dividers. Application contents, existing dimensions, rendering, transactions and document state retain their app owners. Shared pane lifecycle does not introduce a shared 3D camera or viewport policy.

Fresh before/after evidence and native-check results are recorded in the originating Truss checkout at tests/.artifacts/remaining-pane-rollout/index.html. Publication, merge and deployment are not included in this review batch. CAD platform-specific gates retain their separate browser/native availability requirements.

## Inspector overlap revision — 2026-10-28

Owner feedback requires the tablet and short-landscape inspector to preserve access to the centered viewport actions. At widths 680–999px FEA now reserves a side column for one active inspector, retaining at least a 320px viewport; only widths below 680px use temporary overlay drawers. Docked inspectors do not close when the canvas is clicked. Desktop layout, pane preferences, camera/rendering and the pinned generated Kit artifact are unchanged. The native workspace regression checks both inspectors at 820×900 and 844×490, including View/Display pointer access. The revised gallery is tests/.artifacts/remaining-pane-rollout/fea-revision/index.html in the originating Truss checkout. The owner explicitly approved these revised views and publication/merge on 2026-10-28 after all 56 browser harnesses passed. Deployment and release tags remain separate.

## Consistent drag-close — 2026-10-28

Side-pane resize callbacks now use the pinned canonical PortableUIPanes.snapSize contract: hold the host minimum, close below half-minimum, preserve the gesture-start preferred width, and restore width/visibility on Escape or pointer cancellation. A captured drag may reopen before release. Native keyboard limits, existing width preferences/caps, responsive layout, pane contents and domain transactions remain app-owned. This fixes an omitted adapter binding without changing generated Kit files or their pin.
