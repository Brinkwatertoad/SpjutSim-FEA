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

- Runtime artifact: `web/generated/local-runtime/gmsh-runtime-source.js`
- Runtime mode: `serial-local` (classic worker script with embedded WASM)
- Artifact size: `59,054,731` bytes
- Artifact SHA-256: `0c84578c3be1e51064fb6f74c68661e32d5e33286797c3dacb2e85ff3700d7c6`
- GMSH-JS: tag `v0.3.0`, commit
  `3fdabeeb1dac2417446cefb9f75ecb6645315cd6`, from
  <https://github.com/loumalouomega/GMSH-JS>
- Gmsh: descriptor version `5.0.0`, commit
  `29726e7237db13ff77ef3f2db2d7fb9499c4e65c`, from
  <https://gitlab.onelab.info/gmsh/gmsh>
- OpenCASCADE Technology: `7.8.1`, tag `V7_8_1`, from
  <https://github.com/Open-Cascade-SAS/OCCT>
- Emscripten SDK: `3.1.74`
- Input SHA-256 values:
  - Emscripten core: `f201b21416981573349cb42db1e07b051a89e69e4d7a2fe6262e391ebb3507ed`
  - GMSH-JS marshaller: `1b8f9edaf63f1440d6d1d0e048c382488faae96dd886ce7e60b09e68a5a12a06`
  - generated API descriptor: `1ea248880aad854f410756808c83a4ee66fdc1fd35029f712487b5b64d91f6db`
- Principal packaging flags: `ENABLE_OPENMP=OFF`, `ENABLE_MPI=OFF`,
  `ENABLE_OCC=ON`, `ENABLE_OCC_STATIC=ON`, `MODULARIZE=1`,
  `SINGLE_FILE=1`, `ALLOW_MEMORY_GROWTH=1`, and `ENVIRONMENT=worker`.
  The complete reproducible configuration is in
  `tools/build-gmsh-local-runtime.sh`.
- Local modifications: upstream source trees are unmodified. The build uses the
  generated GMSH-JS C exports, converts its single ESM `buildApi` export to a
  classic worker-local function, attaches `FS` and the Emscripten module to the
  API, and wraps the combined source as a checked-in string for Blob workers.
- License: the GMSH-JS package and generated artifact are
  GPL-2.0-or-later; Gmsh is GPL-2.0-or-later with its stated linking exception;
  OCCT is LGPL-2.1 with its additional exception. Exact notices are checked in
  under `web/wasm/gmsh/licenses/`.

Distribution of this artifact carries GPL obligations unless Gmsh is separately
licensed. In particular, the project's all-rights-reserved root license does not
grant permission to disregard the third-party terms. The public distribution
posture for the combined application must be reviewed before v1.0 release.
