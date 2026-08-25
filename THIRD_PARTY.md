# Third-party runtime dependencies

## Three.js

- Version: `0.149.0`
- Artifact: `web/vendor/three/three.min.js`
- Source: <https://unpkg.com/three@0.149.0/build/three.min.js>
- Upstream project: <https://github.com/mrdoob/three.js>
- License: MIT (`SPDX-License-Identifier: MIT`; preserved in the artifact header)
- SHA-256: `8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271`
- Local modifications: none
- Generation: none. This is the upstream classic/global browser build, pinned
  because it can be loaded by a normal `<script>` tag from `file://` without an
  import map or application bundler.

## Gmsh/OpenCASCADE

No Gmsh/OpenCASCADE runtime artifact is committed yet. Its future pin, license,
checksum, source, and local-file packaging flags will be recorded here.
Distribution of Gmsh carries GPL-2.0-or-later obligations unless separately
licensed; the project must settle its distribution posture before public v1.0
distribution.
