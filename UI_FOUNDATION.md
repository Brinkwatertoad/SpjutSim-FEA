# UI foundation provenance

The files under `web/ui/` were copied from SpjutSim-UI-Kit as first-party project source, following its reference-merge model.

- Source: https://github.com/Brinkwatertoad/SpjutSim-UI-Kit
- Version: 0.7.1
- Peeled commit: `541c607c4b48520ed0e14b93106ec54ad3852461`
- Imported: 2026-08-25

On 2026-09-06 the copyright holder approved GPL-2.0-or-later for these copies
as part of SpjutSim FEA. See `LICENSE` and `docs/release/distribution-policy.md`.
This grant does not change the separate UI Kit repository's license. The
release manifest hashes the current FEA-owned copies; later FEA adaptations
are included in the corresponding application source.

The application owns all FEA state, commands, persistence, viewport rendering, and results. Generic UI helpers remain presentation/interaction-only.

Plans 21–23 retain the 0.7.1 source pin. `web/js/ui/workspace-layout.js`
adapts its separate presentation preferences, collapse controls, and bounded
split concepts for two FEA side panes. It owns no analysis data and uses the
copied tokens, menu controller, and focus conventions. No files in `web/ui/`
were changed or fetched at runtime.

## Stable pane gutter reference merge

The 2026-09-13 correction selectively adopts the verified scrollbar contract from
UI Kit commit `24719fc`, proved in Circuits commit `bc29fd4` and confirmed by the
owner on macOS. The base 0.7.1 pin above remains unchanged.

- `web/ui/shell-behaviors.js` owns the portable stable-gutter measurement helper.
- `web/ui/ui-tokens.css` owns the 17px total inset and 2px minimum-margin tokens.
- `web/css/app.css` applies stable gutters and subtracts measured native width
  from padding in both FEA side panes. Other FEA spacing remains app-owned.
- `FEAColorSchemes.applyActive()` measures after publishing the document palette,
  including initial startup and later changes. Scoped previews do not remeasure
  or mutate document-wide scrollbar metrics.

The previous FEA panes had 14px padding and no stable gutter. Their content width
could change when native scrollbars appeared. The workspace browser regression
now checks equal content widths across native, thin, and zero-lane modes, stable
width through fit/overflow/fit transitions, and clearance before a conservative
15px overlay region. It failed on the missing startup measurement before the
change. Zero-lane geometry tests do not emulate native macOS thumb painting.

## Shared action icons

On 2026-09-22, report and mesh options adopted the UI Kit Settings drawing and
shared action geometry (20px SVG, 30px minimum desktop target, 44px coarse-pointer
target). `web/ui/action-icons.js` is the unmodified generated catalog from UI Kit
commit `6f440685602bf91713a3dfd984dfbff29112385c`, catalog SHA-256
`6bd2c34de167e14bc394738b1ad14f0d94e98963c0831b150a18ed896116438c`.
This is a selective reference merge; the base shell pin remains unchanged.

Reproduce/check the catalog from that UI Kit checkout:

```sh
node ../SpjutSim-UI-Kit/scripts/build-icons.js --output "$PWD/web/ui/action-icons.js"
node ../SpjutSim-UI-Kit/scripts/build-icons.js --check --output "$PWD/web/ui/action-icons.js"
```

The catalog is local at runtime. Application buttons own accessible names,
callbacks and availability. No sibling checkout or icon build is needed to run FEA.
