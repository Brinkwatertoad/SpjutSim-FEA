# Near-term development plans

Tasks 01–10 established the portable geometry path and the first trusted Tet4
browser vertical slice. Task 11 then consolidated the priority authoring and
presentation work. Its feature packages and compact-Mesh/delete-mesh regression
follow-up are complete.

Task 12 and Task 13's implementation make Tet10 the production mesh/solve path.
Task 14 and Task 15 provide the implemented Milestone 4 trust and convergence
workflow. The feature path is therefore complete through Task 15, but v1.0 is
not release-ready: Tasks 16–20 split the outstanding evidence, calibration,
corpus, distribution, and final acceptance gates into auditable chunks.

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
13. [ ] [Solve Tet10 models and calibrate resource use](13-tet10-solver-and-resource-calibration.md) — Tet10 solve path complete; representative peak-memory and PCG calibration evidence remains open
14. [x] [Complete factor-of-safety and result trust views](14-factor-of-safety-and-result-trust.md)
15. [ ] [Deliver convergence, validation, and the v1.0 release gate](15-convergence-validation-and-v1-release.md) — workflow complete; independent reference, broader CAD/browser-resource, and redistribution gates remain open (see `../release/v1-acceptance-audit.md`)
16. [ ] [Complete the reference validation matrix](16-reference-validation-matrix.md)
17. [ ] [Establish the release CAD regression corpus](17-cad-regression-corpus.md)
18. [ ] [Calibrate browser resources and production solver settings](18-browser-resource-calibration.md)
19. [ ] [Resolve distribution licensing and artifact compliance](19-distribution-licensing-decision.md)
20. [ ] [Audit and produce the v1.0 release candidate](20-v1-release-candidate.md)

Each task should leave the repository usable from both `file://` and the
optional HTTP server.

Do not mark Task 15 or Task 20 complete merely because features exist. Tasks
16–19 own the remaining evidence that closes Task 13/15 carry-forward items.
Benchmark-dependent choices—quality warning thresholds, memory safety factor,
solver/preconditioner tuning, browser support, and any threaded WASM build—are
resolved only from the measurements named in Tasks 16–18. Task 19 requires an
explicit copyright-holder distribution decision; Task 20 consumes all four
records and must remain blocked while any Section 26 gate is unchecked.
