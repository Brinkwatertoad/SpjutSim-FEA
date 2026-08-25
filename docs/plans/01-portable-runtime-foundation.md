# Task 1: Complete the portable runtime foundation

## Outcome

Finish the missing Milestone 0 pieces: a real repository-local Three.js
viewport and a reusable way to launch hand-authored workers through Blob URLs.
This task must not add geometry or meshing behavior yet.

## Implementation

- Pin a browser-consumable Three.js release under `web/vendor/three/`. It must
  work as a classic script from `file://`; generate a global build at dependency
  update time if upstream does not ship one. Record version, source, license,
  checksum, and any generation step in `THIRD_PARTY.md`.
- Upgrade `ViewportController` to own the renderer, scene, camera, lights,
  resize handling, a basic empty-state/reference object, and disposal. Keep all
  Three.js details below the rendering boundary.
- Replace the probe-only worker helper with a small reproducible generator that
  embeds the readable sources in `workers/` into files under
  `web/generated/local-runtime/`. The browser launcher should create Blob URLs,
  revoke them only after the worker has loaded, and report startup errors in a
  structured form.
- Keep the mesher and solver workers separate. Their current
  `*_NOT_IMPLEMENTED` response is acceptable, but startup must exercise those
  actual sources rather than an unrelated inline probe.
- Document generated-file provenance and regeneration commands. Do not add an
  application bundler, Node dependency, native modules, or network fetches.

Likely files: `web/index.html`, `web/js/render/viewport-controller.js`,
`web/js/workers/local-worker-bootstrap.js`, `workers/*.js`, a Python generator
under `tools/`, `THIRD_PARTY.md`, and framework tests.

## Verification

- Add tests that regenerate the local-runtime files into a temporary directory
  and compare or validate their contents; reject stale protocol versions.
- Run the Python and native test commands from `README.md`.
- Open `web/index.html` directly in the primary Chromium browser: the viewport
  renders, both real workers respond, embedded WASM initializes, and there are
  no network requests or console errors.
- Repeat through `python3 tools/serve.py`; confirm the app reports isolated HTTP
  mode and the same smoke checks pass.

## Done when

The Milestone 0 definition in `spec.md` is true, placeholders no longer claim
that Three.js is missing, and generated runtime artifacts can be reproduced
from readable checked-in source.

