# FEM WebAssembly output

`fem.js` is the checked-in, single-threaded Emscripten `SINGLE_FILE` build of the
trusted Tet4 core and versioned C ABI under `native/fem`, plus the narrow browser
accessors in `native/wasm/fem_c_api.cpp`. It is generated reproducibly by
`tools/build-wasm.sh`, requires no runtime network fetch, and is embedded into
the Blob-worker source by `tools/build-local-runtime.py`. Do not edit it by hand.
