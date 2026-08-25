# Gmsh local runtime

The distributed Gmsh/OpenCASCADE runtime is
`web/generated/local-runtime/gmsh-runtime-source.js`. It is a generated classic
script containing a serial Emscripten loader, embedded WASM, API descriptor, and
marshaller. The main page never initializes Gmsh; it copies the source into a
disposable Blob-backed mesher worker.

The `serial-local` build deliberately disables OpenMP and pthreads. It does not
use `SharedArrayBuffer`, native modules, or runtime `fetch()`, so the same artifact
runs from `file://`, portable HTTP, and cross-origin-isolated HTTP. A future
`threaded-hosted` artifact is optional and must remain a separate feature-detected
path.

## Rebuild

The checked-in artifact is ready to run. Rebuilding is only necessary when the
pinned dependency, generated bindings, or Emscripten flags change. The build
requires Git, CMake, curl, a network connection, several GiB of temporary disk,
and substantial compilation time:

```sh
tools/build-gmsh-local-runtime.sh
```

The script downloads pinned sources and Emscripten into
`build/gmsh-local-runtime/`, builds serial OCCT and Gmsh static libraries, links
an Emscripten `SINGLE_FILE` core, and regenerates the checked-in wrapper. Re-run
the same command to resume an interrupted incremental build. Set `JOBS` to limit
parallel compilation or `SPJUTSIM_GMSH_BUILD_ROOT` to use another build volume.

The exact revisions, build flags, licenses, and artifact checksums are recorded
in `THIRD_PARTY.md`.

## Troubleshooting

- `Unexpected ... revision`: the build directory contains a different checkout;
  use a new `SPJUTSIM_GMSH_BUILD_ROOT` or remove that specific ignored build tree.
- `Checksum mismatch` or `Source-tree checksum mismatch`: the downloaded OCCT
  archive or extracted source does not match the pinned release. Use a new build
  root; do not package the mismatched source under the recorded version.
- `Missing required OCCT toolkit`: inspect the preceding OCCT build/install error
  and rerun after correcting it; the build is incremental.
- `OpenMP unexpectedly enabled`: do not bypass the check. The resulting shared
  memory module would break the direct-local execution contract.
- `GMSH_RUNTIME_SOURCE_MISSING`: rebuild the artifact and confirm
  `gmsh-runtime-source.js` is loaded before the worker wrappers in `web/index.html`.
- `MESHER_INITIALIZATION_FAILED`: use its developer message for loader details;
  the user-facing message intentionally does not expose raw Gmsh/Emscripten text.
