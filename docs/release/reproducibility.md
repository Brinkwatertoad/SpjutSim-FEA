# Task 19 reproducibility and candidate checks

Verified 2026-09-07 on Linux/WSL using Emscripten 3.1.74, CMake 3.28.3,
Python 3, and Chromium 152.0.7977.75. Operator tools were installed under ignored
`build/` paths; they are not application dependencies. Owner licensing approval
was received on 2026-09-06; final policy/artifact approval was received on 2026-09-07.

## Runtime reproduction

`tools/build-wasm.sh` reproduced the checked-in FEM runtime byte for byte:

- `web/wasm/fem/fem.js`: `539a7f06dbfb97f136ba0f01b560fdd0186fdd413ade65b959fc98cfd4140625`
- FEM source wrapper: `243fec59431d7afe7b6341b9dc4800955481c3b1dd98465c0a97f4b9777ea5da`
- Both first-party worker source wrappers also matched the existing artifacts.

An initial Gmsh rebuild from the original pinned inputs exposed previously
unrecorded build-environment metadata. Its API descriptor and JavaScript wrapper
(with embedded WASM removed for comparison) matched the old build. Embedded
diagnostic paths, build date, and hostname differed inside WASM; resulting data
layout offsets also changed. This was not merely a JavaScript comment change.

The recipe now uses the pinned Gmsh commit's epoch (`1784116593`) with UTC,
stable host/packager labels, and `-ffile-prefix-map` for Gmsh and OCCT. No
upstream source files were edited. The resulting artifact intentionally replaces
the older payload; nothing was restored by hand after the rebuild.

Two executions of the normalized recipe produced identical hashes for all
Gmsh split files, the Gmsh metadata file, and both worker wrappers. The second
execution reused the compiled static-library build cache and reran linking and
packaging. The first execution recompiled Gmsh and OCCT with the normalized
flags. A second clean build on another OS has not been performed.

| Measured input/output | SHA-256 |
| --- | --- |
| Gmsh core loader, including embedded WASM | `b9d58d14f9b74c5f87bf09a6c0470ec6c8bfd3247637979a142fda610b626de8` |
| Original GMSH-JS marshaller input | `1b8f9edaf63f1440d6d1d0e048c382488faae96dd886ce7e60b09e68a5a12a06` |
| Generated API descriptor | `1ea248880aad854f410756808c83a4ee66fdc1fd35029f712487b5b64d91f6db` |
| Combined normalized Gmsh runtime source | `85cf9d1160de66b60fcd378eb2735644ddf2c0991dd0aaae87cd58e210a80603` |
| Decoded normalized Gmsh WASM | `2590e7bcf10bbfb218e109c065000f33a35ea5fc1298e8f7cc9c6d0732d5973d` |
| OCCT source archive | `7321af48c34dc253bf8aae3f0430e8cb10976961d534d8509e72516978aa82f5` |
| Extracted OCCT source manifest | `8a8c83a681b95d7741e70d429d9427072cf75c599ef663614772c97c67cef9af` |

The OCCT archive and extracted-tree hashes were verified by the build script.
The Gmsh and GMSH-JS Git revisions matched their pins, with clean tracked
source trees. The exact upstream source archives and all split-file hashes are
recorded in `artifact-manifest.json`. The decoded candidate WASM contains the
normalized `/spjutsim-build/` diagnostic prefix rather than the original
operator-specific checkout paths.

## Tests and browser checks

- `python3 -m unittest discover -s tests`: 77 tests passed.
- Native CMake build and `ctest --test-dir build/task19-native`: 8 tests passed.
- Headless Chromium, network disabled, `file://`: application startup reached
  `Local runtime ready`; worker-protocol, Tet10 mesh, and analytical cube
  import/mesh/solve tests each reported `Passed`.
- The local Licenses link opened successfully; all linked license assets
  existed locally. The corresponding-source link is supplied by packaging.
- Optional isolated HTTP using `tools/serve.py`'s handler: application startup
  and analytical cube import/mesh/solve passed, with requests confined to the
  local server. No page errors or external runtime requests were observed.

Use the browser harnesses named in README to repeat these checks. These focused
checks verify the rebuilt runtime; they do not replace Task 20's full candidate
acceptance matrix or claim new cross-platform numerical validation.

## Source-accompanied stage

`tools/package-distribution.py` creates the candidate under
`build/distribution/web`. `tools/audit-distribution.py --release-root
build/distribution/web` verifies application-source contents, all source archive
hashes, upstream notice contents, and exact deployed web assets. The generated
`sources/manifest.json` binds those materials to the artifact manifest. No source
archive is held in memory in full during validation.

The staged audit also passes with `--require-approved`, using the owner's
2026-09-07 final approval. Task 20's full v1.0 candidate acceptance remains open.
