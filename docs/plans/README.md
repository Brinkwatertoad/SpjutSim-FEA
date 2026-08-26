# Near-term development plans

Execute these plans in order. They complete Milestone 0 and then deliver the
geometry/meshing portion of the first vertical slice from `spec.md`.

1. [x] [Complete the portable runtime foundation](01-portable-runtime-foundation.md)
2. [x] [Prove the Gmsh local-runtime path](02-gmsh-local-runtime-spike.md)
3. [x] [Implement STEP import and the geometry contract](03-step-import-and-geometry.md)
4. [x] [Render geometry and select CAD faces](04-preview-rendering-and-face-selection.md)
5. [x] [Generate and extract a Tet4 mesh](05-tet4-mesh-extraction.md)

Each task should leave the repository usable from both `file://` and the
optional HTTP server. Do not begin solver UI or FEM work while these plans are
in progress; the resulting geometry and mesh contracts are inputs to that work.

The plans defer choices that `spec.md` explicitly leaves benchmark-dependent,
including production meshing options, quality thresholds, and threaded WASM.
