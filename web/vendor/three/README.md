# Vendored Three.js

`three.min.js` is the pinned Three.js `0.149.0` classic/global browser build.
It exposes `globalThis.THREE` and is intentionally loaded with a normal script
tag so the local `file://` runtime does not require native ES modules or an
import map. Its provenance, checksum, and license are recorded in
[`THIRD_PARTY.md`](../../../THIRD_PARTY.md).

To reproduce this artifact, extract the upstream `three-0.149.0.tgz` source
package recorded in `docs/release/artifact-manifest.json` and copy
`package/build/three.min.js` here without modifications. Its readable sources
are in `package/src/`; preserve `package/LICENSE` as
`web/licenses/three/LICENSE`. No package manager or frontend build is required.
