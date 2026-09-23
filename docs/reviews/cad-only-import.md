# CAD-only import — 2026-09-20

Numbering note (2026-09-22): references below to integrated M30 now correspond to Plan/M38; new Plans 30–37 also precede the final candidate. This record preserves its original CAD-only evidence.

The owner requested preservation of the STL experiment on GitHub and removal of
STL import from main. This is a scope change, not acceptance of the STL workflow.

The archive is [features/stl-import](https://github.com/Brinkwatertoad/SpjutSim-FEA/tree/features/stl-import)
at `8562b56`. It retains the complete development history, fixtures, experiments,
repair dependencies and [resume guide](https://github.com/Brinkwatertoad/SpjutSim-FEA/blob/features/stl-import/docs/STL-DEVELOPMENT.md),
including unresolved repair, face-recognition and mesh-quality limits.

Implementation: `5eb7a59`, based directly on the prior main `662fbd2`.

## Result

- Import accepts STEP/STP, IGES/IGS and OpenCASCADE BREP. Selecting a supported
  file imports the solid directly, preserving its CAD faces for loads/supports.
- Replacement opens face mapping only when supports or loads require transfer.
  Direct replacement cancels the old mesh operation; late completions and slow
  superseded file reads cannot overwrite the new part.
- Unsupported files fail before file reading or worker startup. The installed
  model and mesh remain available after rejection.
- Parsing, repair, surface reconstruction, face recognition/split/merge, diagnostic
  overlays, extra workers, corresponding tests/fixtures and obsolete plans are
  removed. Main retains a short archive pointer, with no compatibility shim.
- Runtime workers are mesher and solver only. Startup checks WebAssembly without
  starting either engine. CGAL/Boost repair source, build tooling, embedded runtime
  and distribution requirements remain exclusively on the archive branch.
- Browser assets shrink by about 1.90 MB relative to the archived branch. Gmsh,
  OpenCASCADE, Three.js and the FEM runtime remain. The prior GPL-2.0-or-later
  distribution policy applies; final exact-artifact release review remains open.

## Verification

Linux x86_64; Chromium 152.0.7977.75 and Firefox 153.0, headless.
[Machine-readable results](cad-only-import-evidence.json) list individual harnesses,
package checks and runtime hashes.

- Python: 77 tests pass.
- Native FEM: 8/8 CTest tests pass; WASM rebuilt using `tools/build-wasm.sh`.
- Chromium direct-file: all 35 browser harnesses pass, including analytical
  solves, Tet4/Tet10, convergence, CAD faces, authoring, history, unit preferences,
  DOCX/report export, workspace and worker lifecycle. Resource coverage uses
  `resource-benchmark-tests.html?profile=smoke`; the full calibration matrix was
  not rerun. Earlier resource calibration remains historical evidence.
- CAD corpus: 50/50 classifications agree in direct-file and HTTP runs; accepted
  models mesh twice with stable FaceIds and positive Jacobians.
- Firefox direct-file: nine focused harnesses pass.
- Chromium HTTP: four import/corpus/analytical-workflow harnesses pass.
- Rebuilt source-accompanied package passes the distribution audit. With browser
  networking disabled, Chromium and Firefox each start with zero workers, import
  the six-face STEP cube, generate 27,202 Tet10 elements / 40,667 nodes, and retain
  that mesh after rejecting an STL. No page errors or repair assets are present.
- JavaScript syntax and complete-diff review pass. Review covered cancellation,
  source ownership, state invalidation, memory, worker boundaries, accessibility,
  removed references and reproducible generated artifacts.

The new import-orchestration regression covers overlapping reads, stale success
and failure, unsupported files, direct import, assignment review, and replacement
while meshing. Its replacement case was observed failing before the fix and
passing afterward. The actual worker rejects mesh-format requests independently
of client validation in `step-import-tests.html`.

## Reproduction and remaining gates

Use the commands in README for Python, native tests and the browser harnesses.
Open `cad-import-workflow-tests.html`, `step-import-tests.html`, and
`cube-wasm-vertical-slice-tests.html` with file access enabled or via `tools/serve.py`.
Generate an offline package with:

```sh
python3 tools/package-distribution.py --output build/cad-only-distribution/web
python3 tools/audit-distribution.py --release-root build/cad-only-distribution/web
```

M30 integrated owner review and Task 20 release audit remain open. This change
updates main and the archive branch; it does not publish a website or tag v1.
