# Near-term development plans

Before resuming the numbered roadmap, complete the
[priority authoring remediation](00-priority-authoring-remediation.md) for
selection clearing, support/load entry, and the material catalog.

The current release priority is now [Task 11: Complete priority release
features](11-priority-release-features.md). Its compact setup inspector is the
first deliverable and supersedes the scattered authoring layout assumed by the
older plans. Follow the approved design and package plans linked from Task 11
before returning to deferred solver breadth.

Execute these plans in order. Tasks 01–05 establish the portable geometry and
meshing path. Tasks 06–10 complete the first trusted Tet4 browser vertical
slice, including viewport interaction and initial result visualization.

1. [x] [Complete the portable runtime foundation](01-portable-runtime-foundation.md)
2. [x] [Prove the Gmsh local-runtime path](02-gmsh-local-runtime-spike.md)
3. [x] [Implement STEP import and the geometry contract](03-step-import-and-geometry.md)
4. [x] [Render geometry and select CAD faces](04-preview-rendering-and-face-selection.md)
5. [x] [Generate and extract a Tet4 mesh](05-tet4-mesh-extraction.md)
6. [Complete viewport navigation and settings](06-viewport-navigation-and-settings.md)
7. [Validate and render CAD and mesh surfaces](07-surface-and-mesh-visualization.md)
8. [Author material, supports, and loads](08-material-support-and-load-authoring.md)
9. [Implement the trusted Tet4 solver and preflight model](09-trusted-tet4-solver-and-preflight.md)
10. [Integrate WASM solve and first result views](10-wasm-solve-and-result-views.md)

Each task should leave the repository usable from both `file://` and the
optional HTTP server.

These plans stop at the validated Tet4 vertical slice. Tet10 production
analysis, calibrated resource limits, complete factor-of-safety/reporting, and
the convergence/trust workflow remain later work required for v1.0.

The plans defer choices that `spec.md` explicitly leaves benchmark-dependent,
including production meshing options, quality thresholds, and threaded WASM.
