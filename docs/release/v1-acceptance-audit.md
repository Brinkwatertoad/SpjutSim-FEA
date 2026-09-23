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

## Revised pre-v1 gates — planning scope updated 2026-09-22

The Pass rows above record the earlier evidence scope and are not exact-candidate
release certification. M21–M27 acceptance is recorded below. The owner removed
STL from main and v1 on 2026-09-20. The 2026-09-22 planning update renumbered
completed Plans 31/32 to 28/29, added pre-v1 Plans 30–37, and moved the former
integrated Plan 30 to 38. The subsequent implementation of Plans 30–34 has [fresh verification](../reviews/30-34-verification.md); owner review remains pending and historical Pass claims are unchanged.

| Area | Status | Required evidence |
| --- | --- | --- |
| Responsive workspace and bounded overlays | Accepted 2026-09-08 | [M21–M23 review](../reviews/21-23-review.md) |
| Accurate surface extrema and result explanation | Accepted 2026-09-08 | [M21–M23 review](../reviews/21-23-review.md) |
| Orthographic/isometric and interactive gizmo | Accepted 2026-09-08 | [M21–M23 review](../reviews/21-23-review.md) |
| Contextual display and vertical/horizontal legend | Accepted 2026-09-10 | [M24–M27 review](../reviews/24-27-followup.md) |
| Transactional assignment previews | Accepted 2026-09-10 | [M24–M27 review](../reviews/24-27-followup.md) |
| Setup and explicitly triggered solve checks | Accepted 2026-09-10 | [M24–M27 review](../reviews/24-27-followup.md) |
| Bounded engineering undo/redo | Accepted 2026-09-10 | [M24–M27 review](../reviews/24-27-followup.md) |
| Material/load-unit/report and DOCX/unit preferences | Implemented; historical verification | [Plan 28](../reviews/28-material-units-and-report.md), [Plan 29](../reviews/29-document-report-and-unit-preferences.md); include in final integration |
| Portable projects and lightweight recovery | Implemented; owner review pending | Plans 30–31, malformed/cancelled/overlapping open, safe face identity, optional caches and storage failures |
| Contextual workflow, model information and selection | Implemented; owner review pending | Plans 32–33, simple/expanded keyboard paths, View command preservation, volume/mass, selection and cancellation |
| Optional report customization with complete defaults | Implemented; owner review pending | Plan 34, DOCX/ZIP content, numerical context and scene restoration |
| Local directions and sliding/symmetry supports | Planned | Plan 35 native/WASM rotation, constraint consistency and reactions |
| Bearing loads and moments/offset forces | Planned | Plans 36–37 quadrature/resultants, analytical/reference convergence and memory |
| Integrated usability and changed-path regression | Pending | Plan 38 complete applicable suites and owner M38 |
| Exact final candidate | Pending | Task 20 audit after the completed pre-v1 sequence and accepted M38 |

The project must not be tagged or described as v1.0-ready while any Planned, Pending or
Changes requested row that maps to section 26 remains unresolved.

Historical evidence ownership: Task 16 owns numerical and
independent-solver validation, Task 17 owns the CAD corpus and quality evidence,
Task 18 owns browser/resource/PCG calibration, Task 19 owns distribution rights,
and Task 20 reruns and binds the complete acceptance record to one candidate.

The revised execution and mandatory manual review schedule is in
`../plans/README.md`. Review Plans 30–34, implement Plans 35–37 and obtain final Plan 38 acceptance before Task 20.
Post-v1 Plans 39–46 are not release gates.
