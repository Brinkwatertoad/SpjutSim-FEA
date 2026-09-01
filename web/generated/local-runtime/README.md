# Generated local runtime

`*-worker-source.js` files package the readable sources in `/workers` as JavaScript
strings. `gmsh-runtime-source-part-*.js` packages the pinned serial
Gmsh/OpenCASCADE loader, embedded WASM, generated API descriptor, and marshaller;
`gmsh-runtime-source.js` records the part count and provenance. The application
passes the ordered Gmsh parts and mesher string directly into a Blob URL so the
worker can start when `web/index.html` is opened through `file://` without a
second full-payload string allocation. Each generated file stays below static
hosting's 25 MiB per-asset limit.

Regenerate after changing a worker source:

```sh
python3 tools/build-local-runtime.py
```

This command updates the small worker wrappers and leaves the Gmsh artifact
unchanged. Rebuild that artifact only for a pinned dependency or build-flag update:

```sh
tools/build-gmsh-local-runtime.sh
```

The generator verifies the worker protocol version, rejects pthread-enabled Gmsh
cores, and records source checksums. Generated files are checked in so normal
browser-source work and downloaded distributions do not require a build step.
