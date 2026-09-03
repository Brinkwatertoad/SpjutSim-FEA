# Near-term development plans

Tasks 01–10 established the portable geometry path and the first trusted Tet4
browser vertical slice. Task 11 then consolidated the priority authoring and
presentation work. Its feature packages are implemented; a final compact-Mesh
row/delete-mesh regression follow-up is still in progress and remains the gate
before the production-element roadmap begins.

Execute the remaining plans in order. Tasks 12–13 complete Milestone 3 by
making Tet10 the production mesh/solve path and calibrating its resource model.
Tasks 14–15 complete the remaining Milestone 4 trust layer and v1.0 release
evidence.

1. [x] [Complete the portable runtime foundation](01-portable-runtime-foundation.md)
2. [x] [Prove the Gmsh local-runtime path](02-gmsh-local-runtime-spike.md)
3. [x] [Implement STEP import and the geometry contract](03-step-import-and-geometry.md)
4. [x] [Render geometry and select CAD faces](04-preview-rendering-and-face-selection.md)
5. [x] [Generate and extract a Tet4 mesh](05-tet4-mesh-extraction.md)
6. [x] [Complete viewport navigation and settings](06-viewport-navigation-and-settings.md)
7. [x] [Validate and render CAD and mesh surfaces](07-surface-and-mesh-visualization.md)
8. [x] [Author material, supports, and loads](08-material-support-and-load-authoring.md)
9. [x] [Implement the trusted Tet4 solver and preflight model](09-trusted-tet4-solver-and-preflight.md)
10. [x] [Integrate WASM solve and first result views](10-wasm-solve-and-result-views.md)
11. [x] [Complete priority release features](11-priority-release-features.md)
12. [x] [Generate production Tet10 meshes](12-production-tet10-meshing.md)
13. [x] [Solve Tet10 models and calibrate resource use](13-tet10-solver-and-resource-calibration.md)
14. [x] [Complete factor-of-safety and result trust views](14-factor-of-safety-and-result-trust.md)
15. [ ] [Deliver convergence, validation, and the v1.0 release gate](15-convergence-validation-and-v1-release.md) — workflow complete; independent reference, broader CAD/browser-resource, and redistribution gates remain open (see `../release/v1-acceptance-audit.md`)

Each task should leave the repository usable from both `file://` and the
optional HTTP server.

Do not mark Task 15 complete merely because features exist. Its analytical,
reference-solver, CAD-corpus, browser-resource, licensing, and direct-local
acceptance evidence must all pass. Benchmark-dependent choices—quality warning
thresholds, memory safety factor, solver/preconditioner tuning, and any threaded
WASM build—are resolved only from the measurements named in Tasks 12–15.
