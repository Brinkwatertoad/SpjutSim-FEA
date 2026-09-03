# v1.0 acceptance audit

Audit date: 2026-09-02. `spec.md` section 26 remains authoritative. “Pass”
means the cited repository test or inspected implementation currently supports
the item; “Pending” keeps the v1 release gate closed.

| Area | Status | Evidence |
| --- | --- | --- |
| STEP/IGES/BREP import and one-solid restriction | Pass for current corpus | `step-import-tests.html`, `tests/fixtures/README.md` |
| Orientation invalidation and face stability | Pass | `analysis-authoring-tests.html`, `tet4-mesh-tests.html`, `tet10-mesh-tests.html` |
| Tet10 production default | Pass | `analysis-document.js`, Tet10 cube vertical slice |
| Supports, prescribed displacement, pressure, force, gravity | Pass | native solver tests and authoring browser tests |
| Load/reaction equilibrium | Pass | native solver tests and Tet10 cube vertical slice |
| First-party bounded CSR/PCG and diagnosed failures | Pass | native sparse, PCG, failure, and benchmark tests |
| Dependency-free frontend and local assets | Pass | Python framework tests and direct-local browser matrix |
| Full `file://` import/mesh/solve workflow | Pass in Chromium 151 headless | `cube-wasm-vertical-slice-tests.html` |
| No baseline SharedArrayBuffer/server/network requirement | Pass | generated serial runtimes and direct-local browser matrix |
| Mesher/solver workers and cancellation | Pass | worker runtime and convergence-runner tests |
| Optional HTTP isolated mode | Pass for serial path | STEP, Tet10 mesh, cube solve, and convergence harnesses at `tools/serve.py` |
| Optional threaded acceleration | Pending | No threaded runtime is shipped or benchmarked |
| Internal UI shell and compact editable setup | Pass | framework and authoring browser tests |
| Memory preflight, optional device hint, hard WASM cap | Pass | native/C-ABI and WASM result tests |
| >= 8 GiB confirmation | Pending release evidence | State-machine path exists; the 3.5 GiB hard cap prevents such a solve |
| Deformation/contours, raw vs smoothed extrema, summaries | Pass | WASM result and cube vertical-slice tests |
| Yield-based von Mises FoS | Pass | FoS and WASM result browser tests |
| Global convergence and separate stress status | Pass | pure, fake-runner, and real Tet10 convergence tests |
| Likely-singularity caution | Pass as deterministic heuristic | convergence tests; no mathematical-singularity claim |
| Analytical/reference validation matrix | Pending | Tet10 axial record passes; independent bending, pressure, and stress-concentration references remain |
| Supported-browser memory calibration | Pending | One Chromium record exists; larger/non-headless/browser-matrix records remain |
| Representative/problematic CAD corpus size | Pending | Current generated corpus is intentionally small |
| Gmsh distribution rights | Pending external decision | `THIRD_PARTY.md`; current combined public distribution is prohibited |

The project must not be tagged or described as v1.0-ready while any Pending row
that maps to section 26 remains unresolved.
