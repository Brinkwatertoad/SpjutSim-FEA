# v1.0 acceptance audit

Audit date: 2026-09-06; distribution and revised pre-v1 scope updated 2026-09-07. `spec.md` section 26 remains authoritative. “Pass”
means the cited repository test or inspected implementation currently supports
the stated area. A Section 26 checkbox remains unchecked when its full wording
needs broader evidence; every “Pending” row keeps the release closed.

| Area | Status | Evidence |
| --- | --- | --- |
| STEP/IGES/BREP import and one-solid restriction | Pass for v1 corpus | 50-entry manifest, `cad-corpus-tests.html`, Chromium 152 report |
| Orientation invalidation and face stability | Pass | `analysis-authoring-tests.html`, `tet4-mesh-tests.html`, `tet10-mesh-tests.html` |
| Tet10 production default | Pass | `analysis-document.js`, Tet10 cube vertical slice |
| Supports, prescribed displacement, pressure, force, gravity | Pass | native solver tests and authoring browser tests |
| Load/reaction equilibrium | Pass | native solver tests and Tet10 cube vertical slice |
| First-party bounded CSR/PCG and diagnosed failures | Pass | native sparse, PCG, failure, and benchmark tests |
| Dependency-free frontend and local assets | Pass | Python framework tests and direct-local browser matrix |
| Full `file://` import/mesh/solve workflow | Pass in Chromium 152 non-headless | Resource matrix and `cube-wasm-vertical-slice-tests.html` |
| No baseline SharedArrayBuffer/server/network requirement | Pass | generated serial runtimes and direct-local browser matrix |
| Mesher/solver workers and cancellation | Pass | worker runtime and convergence-runner tests |
| Optional HTTP isolated mode | Pass for serial path | STEP, Tet10 mesh, cube solve, and convergence harnesses at `tools/serve.py` |
| Optional threaded acceleration | Pass by explicit v1 deferral | Isolated HTTP is detected and tested; workers report serial execution and the UI does not advertise a threaded path |
| Internal UI shell and compact editable setup | Pass | framework and authoring browser tests |
| Memory preflight, optional device hint, hard WASM cap | Pass | native/C-ABI and WASM result tests |
| >= 8 GiB confirmation | Pass synthetically | Native preflight test drives the state above 8 GiB without allocating it; application and convergence paths require confirmation |
| Deformation/contours, raw vs smoothed extrema, summaries | Pass | WASM result and cube vertical-slice tests |
| Yield-based von Mises FoS | Pass | FoS and WASM result browser tests |
| Global convergence and separate stress status | Pass | pure, fake-runner, and real Tet10 convergence tests |
| Likely-singularity caution | Pass as deterministic heuristic | convergence tests; no mathematical-singularity claim |
| Analytical/reference validation matrix | Pass | Five converged Tet10 cases, CalculiX 2.21 raw outputs, normalized records, and enforced Section 16.2 tolerances |
| Supported-browser memory calibration | Pass | 36 records: Chromium 152 file/isolated HTTP and Firefox 155 file, four cases, three repetitions |
| Representative/problematic CAD corpus size | Pass | 50 CC0 fixtures: 34 accepted across three formats and 16 classified rejections |
| Gmsh distribution rights | Pass | `distribution-policy.md`, `artifact-manifest.json`, `SOURCE.md`; owner approval on 2026-09-07 and successful staged-source audit with `--require-approved` |

## Revised pre-v1 gates — all pending

The Pass rows above record the earlier evidence scope; they are not acceptance
of the approved changes. New boundary-range/contour, resize, and authoring
behavior requires regression evidence even where an earlier row passed.

| Area | Status | Required evidence |
| --- | --- | --- |
| Responsive workspace and bounded overlays | Pending | Task 21 regression and owner M21 |
| Accurate surface extrema and result explanation | Pending | Task 22 numerical/postprocessing regression and owner M22 |
| Orthographic/isometric and interactive gizmo | Pending | Task 23 navigation tests and owner M23 |
| Contextual display and vertical/horizontal legend | Pending | Task 24 presentation tests and owner M24 |
| Transactional assignment previews | Pending | Task 25 state/integration tests and owner M25 |
| Setup and explicitly triggered solve checks | Pending | Task 26 preflight/recovery tests and owner M26 |
| Bounded engineering undo/redo | Pending | Task 27 invalidation/memory tests and owner M27 |
| STL feasibility and accepted patch contract | Pending | Task 28 runtime evidence and owner M28 decision |
| Accepted STL import/mesh/solve subset | Pending | Task 29 topology/numerical/resource/corpus evidence and owner M29 |
| Integrated usability and changed-path regression | Pending | Task 30 complete applicable suites and owner M30 |
| Exact final candidate | Pending | Task 20 audit after accepted Tasks 21–30 |

The project must not be tagged or described as v1.0-ready while any Pending row
that maps to section 26 remains unresolved.

Historical evidence ownership: Task 16 owns numerical and
independent-solver validation, Task 17 owns the CAD corpus and quality evidence,
Task 18 owns browser/resource/PCG calibration, Task 19 owns distribution rights,
and Task 20 reruns and binds the complete acceptance record to one candidate.

The revised execution and mandatory manual review schedule is in
`../plans/README.md`. Complete Tasks 21–30 before final Task 20 acceptance.
