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

- Runtime artifacts: `web/generated/local-runtime/gmsh-runtime-source.js` and
  `web/generated/local-runtime/gmsh-runtime-source-part-*.js`
- Runtime mode: `serial-local` (classic worker script with embedded WASM)
- Embedded payload SHA-256:
  `49e61f1b64e86d1bcdbb15bef03bf4077c2c4530d55a943a87a9fb5212b8f0de`
- GMSH-JS: tag `v0.3.0`, commit
  `3fdabeeb1dac2417446cefb9f75ecb6645315cd6`, from
  <https://github.com/loumalouomega/GMSH-JS>
- Gmsh: descriptor version `5.0.0`, commit
  `29726e7237db13ff77ef3f2db2d7fb9499c4e65c`, from
  <https://gitlab.onelab.info/gmsh/gmsh>
- OpenCASCADE Technology: `7.8.1`, tag `V7_8_1`, from
  <https://github.com/Open-Cascade-SAS/OCCT>. The GitHub source archive SHA-256
  is `7321af48c34dc253bf8aae3f0430e8cb10976961d534d8509e72516978aa82f5`;
  the deterministic extracted-source manifest SHA-256 is
  `8a8c83a681b95d7741e70d429d9427072cf75c599ef663614772c97c67cef9af`.
- Emscripten SDK: `3.1.74`, emsdk commit
  `3d6d8ee910466516a53e665b86458faa81dae9ba`
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
  API, and splits the combined source into checked-in strings small enough for
  static hosting. The browser passes those strings directly to one Blob-backed
  worker without joining a second full-size copy in memory.
- License: the GMSH-JS package and generated artifact are
  GPL-2.0-or-later; Gmsh is GPL-2.0-or-later with its stated linking exception;
  OCCT is LGPL-2.1 with its additional exception. Exact notices are checked in
  under `web/wasm/gmsh/licenses/`.

Distribution of this artifact carries GPL obligations unless Gmsh is separately
licensed. The v1 decision is therefore **do not publicly distribute the combined
artifact under the current all-rights-reserved root license**. Public release
requires either a compatible project license approved by the copyright holder
or a suitable commercial Gmsh license; the release gate remains closed until
one of those paths is documented.
