# Accepted STL import contract — M28

Status: **Accepted by the owner on 2026-09-11 (“yes, accept.”).**
Production implementation and initial M29 verification follow this contract.
The owner-authorized [simulation-surface extension](stl-simulation-surfaces.md)
adds explicit original-surface and bounded reconstruction modes; version-1
behavior below is retained as the initial contract.

## Decision presented to the owner

Use the existing pinned runtime, with no dependency or runtime rebuild. Accept
binary/ASCII STL describing one closed, connected, consistently outward-oriented,
non-self-intersecting manifold solid. Require explicit length units and dimensions
review. Reject defective input with actionable errors; do not repair or reverse
winding automatically. Ignore stored facet normals and recompute them from winding.

Expose connected angle-based patches (40° initially, adjustable from 1° to 179°)
independently of Gmsh's internal subdivisions. Preserve the input's planar facets
during meshing. A curved patch is a selectable group of facets, not recovered CAD
curvature. Changing grouping or units on an installed model uses explicit
assignment remapping and may be cancelled without changing the old model.

Proposed initial bounds: 16 MiB input, 50,000 triangles, 512 internal Gmsh surfaces,
2,000,000 intersection candidate pairs, 120 seconds per meshing worker. These are
**proposed ceilings, not measured capacity claims**: M29 must exercise their edges
and apply existing memory preflight before production acceptance. If they cannot
be met, report that evidence and request a revised bound instead of quietly
changing support. No arbitrary STL, shell, multibody, mesh repair, or OBJ support.

## Reproduction and actual APIs

Generate fixtures with `python3 tools/cad-fixtures/generate-stl-fixtures.py`.
Open `tests/browser/stl-feasibility-tests.html`, `stl-runtime-tests.html`, and
`stl-patch-demo.html`. For fixture reads under `file://`, use the repository's
documented local-file-access browser setting; otherwise use `tools/serve.py`.
The demo starts without selected units and provides patch buttons as a keyboard
alternative to picking. Everything is test-only and uses local runtime assets.

Pinned runtime metadata is in
`web/generated/local-runtime/gmsh-runtime-source.js`: Gmsh commit
`29726e7237db13ff77ef3f2db2d7fb9499c4e65c`, gmsh-js v0.3.0 commit
`3fdabeeb1dac2417446cefb9f75ecb6645315cd6`, Emscripten 3.1.74, OCCT 7.8.1.
The payload SHA-256 is
`85cf9d1160de66b60fcd378eb2735644ddf2c0991dd0aaae87cd58e210a80603`.

The experiment follows the pinned upstream `tutorials/python/t13.py` and checks
the actual JavaScript wrapper. The public upstream explanation is
[Gmsh tutorial t13](https://gmsh.info/doc/texinfo/gmsh.html#t13).

| Operation | Actual callable API and observed output |
| --- | --- |
| Reader characterization | `gmsh.FS.writeFile(path, data)`, `gmsh.merge(path)` imports ASCII and binary triangle data, but performs tolerance-based merging |
| Exact indexed import (recommended) | `gmsh.model.addDiscreteEntity(2)`, `gmsh.model.mesh.addNodes(2, tag, nodeTags, positions)`, `addElementsByType(tag, 2, [], connectivity)` accept typed arrays and preserve prevalidated connectivity |
| Classify | `gmsh.model.mesh.classifySurfaces(angle, true, true, Math.PI)` creates discrete curves/surfaces; a 12-triangle cube becomes eight internal surfaces |
| Parametrize | `gmsh.model.mesh.createGeometry()` succeeds on planar and cylindrical fixtures |
| Construct volume | `gmsh.model.geo.addSurfaceLoop(tags)`, `addVolume([loop])`, `synchronize()` create one volume |
| Mesh | `gmsh.model.mesh.generate(3)` yields type 4; `setOrder(2)` yields type 11 with type 9 boundary elements |
| Extract | `getNodes()` returns `nodeTags/coord`; `getElements()` returns `elementTypes/elementTags/nodeTags`; `getElementQualities(tags, 'gamma')` returns `elementsQuality` |

The naive approach of using classified Gmsh surface numbers as user faces was
rejected: the cube already has eight internal surfaces for six physical faces.
Using the user's grouping angle as the geometry simplification angle is also
not the proposed production path: it does not enforce every source facet crease.

The pinned `src/geo/GModelIO_STL.cpp` reader indexes vertices with
`bboxDiagonal * Geometry.Tolerance` and can skip degenerate/duplicate triangles.
That is an unacceptable silent input change for production. The final proposed
adapter uses the tested indexed APIs instead; the file-reader cases are retained
only as explicit capability characterization. This also avoids serialization and
reparsing of canonical STL text. No source/runtime modification is needed.

The demonstrated path classifies internal surfaces at **1e-8 radians** and sets
`Mesh.SecondOrderLinear = 1`. Near-coplanar classification is a numerical angular
criterion, not coordinate welding. M29 must enforce its geometric tolerance and
reject ambiguous ownership. Each internal surface is mapped back to source
triangles **before** remeshing; the probe rejects lost or mixed patch ownership.
The production extractor then concatenates all surfaces belonging to each user
patch into one contiguous solver/display range. Internal seams are not displayed
as user patch boundaries.

## Measured evidence and limits of the result

See `docs/reviews/28-stl-runtime-evidence.json` for browser, platform, runtime
hashes, per-stage WASM capacity, buffer sizes, timing, quality, patch ownership,
and file/HTTP runs. These are feasibility measurements, not release calibration.
All six small fixtures pass Tet4 and Tet10 in separate fresh workers; cancelling
at volume generation terminates the worker, revokes its Blob URL, and a subsequent
fresh-worker cube succeeds. Termination was exercised; browser/OS memory reclaim
latency was not measured. WASM capacity is a nonshrinking memory high-water
measurement, **not** live native heap use or whole-browser RSS.

Representative direct-local Tet10 results (timing varies between runs):

| Fixture | User patches / internal surfaces | Tet10 elements | Mesh buffers | Minimum sampled Jacobian |
| --- | --- | --- | --- | --- |
| Cube | 6 / 8 | 1,154 | 137,288 B | 1.558e-3 m³ |
| Cylinder, 16 sides | 3 / 20 | 1,689 | 210,264 B | 1.358e-4 m³ |
| Cylinder, 32 sides | 3 / 36 | 4,463 | 530,048 B | 1.597e-5 m³ |
| Cylinder, 64 sides | 3 / 68 | 6,207 | 775,536 B | 4.682e-6 m³ |
| Thin plate | 6 / 8 | 485 | 73,232 B | 3.534e-6 m³ |

All sampled Jacobians are positive. Tet10 returns six-node solver boundary faces
and four display triangles per face. Each tested worker retained a 64 MiB WASM
capacity. The thin plate produces a low-gamma quality warning; it is not suppressed.
Source input, serialized reader input (zero for indexed import), preview buffers,
and final mesh buffers are reported separately; JS maps, wrapper arrays, and Blob strings incur additional
unmeasured transient allocations. M29 should replace per-number extraction arrays
in hot paths with bounded typed-array processing where feasible.

The source cylinders have radius 0.5 and height 1. Their volume deficit versus
an exact cylinder is 2.55047%, 0.641319%, and 0.160562% for 16, 32, and 64 sides.
The tetrahedral corner volumes agree with the **faceted** volume to below 1e-7
relative error (observed below 5e-15). With straight Tet10 midpoints the corner
volume is also the element volume. This separates source tessellation error
from meshing error; **no STL displacement/stress accuracy is claimed here**.
M29 must supply axial displacement/stress/equilibrium and faceted-geometry
refinement evidence before declaring analysis support.

## Source, worker, and geometry contracts

The production request retains original `sourceBytes`, `sourceName`,
`sourceFormat: 'stl'`, `geometryId`, and a rigid orientation. Add:

```js
importOptions: {
  version: 1,
  lengthUnit: 'mm', // m, mm, cm, in, ft; required, never inferred
  patchAngleDegrees: 40,
  normalization: 'none'
}
```

The adapter is the sole producer of the corresponding SI scale (1, .001, .01,
.0254, .3048). Do not accept an independent conflicting numeric scale. Geometry
metadata retains these validated options, source SHA-256, adapter version,
facet count, validation report, and `surfaceKind: 'stl-patch'`; ordinary CAD
uses `surfaceKind: 'cad-face'`. `faceIds` remain opaque strings downstream.
Dimensions and volume are SI, and the review displays the chosen source units.
The controller retains original source bytes for every fresh-worker reconstruction;
transferring a work copy must not detach the controller's retained source.

Bump the coarse worker protocol from 2 to 3 consistently in worker clients,
bootstrap, mesher and solver shells, validators and fixtures. No native FEM API
change is required. Version the added source/options contract at its producer
and validators. CAD imports omit STL options; do not silently supply STL defaults
at either the UI or worker boundary. Preview review and reconstruction carry
the same validated options and source digest.

## Validation and stable errors

The experimental parser is deliberately only a topology screen. Its result is
labeled `experimental-topology-screen`, never a valid production solid.
Before production import, implement all the following in `workers/stl-import.js`.

| Check | Code / action |
| --- | --- |
| Exact binary length `84 + 50*n`, including `solid` headers; strict ASCII grammar; no truncated/overflow records | `STL_MALFORMED`, reject and re-export |
| Required supported units, finite angle in [1,179], known version/normalization | `STL_INVALID_OPTIONS`, correct import settings |
| Nonempty input, file/triangle limits | `STL_INPUT_LIMIT`, export a smaller tessellation |
| Finite coordinates; stored normals are advisory | `STL_NONFINITE`, correct source coordinates |
| Finite positive SI extent within declared bounds | `STL_SCALE_LIMIT`, check units/scale |
| Repeated/collinear triangle vertices; relative cross-product norm <= 1e-14 diagonal² | `STL_DEGENERATE_TRIANGLE`, re-export without degenerate facets |
| Exact shared-coordinate indexing; no proximity welding | Near gaps remain `STL_OPEN_SURFACE` |
| Every undirected edge has two incidents | `STL_OPEN_SURFACE` or `STL_NONMANIFOLD` |
| Each vertex link is one cycle, no bow-tie/pinched vertices | `STL_NONMANIFOLD` |
| Opposite directed traversal of each paired edge | `STL_INCONSISTENT_WINDING` |
| One connected component of triangle adjacency | `STL_DISCONNECTED`, export one solid |
| Signed enclosed volume > 1e-14 diagonal³ | `STL_INWARD_WINDING` or `STL_ZERO_VOLUME`; no automatic reversal |
| BVH broad phase, robust triangle intersection/contact checks including adjacent triangles intersecting beyond their shared simplex | `STL_SELF_INTERSECTION`, repair externally |
| Numerically ambiguous intersection predicate | `STL_INTERSECTION_UNCERTAIN`, reject explicitly rather than assume validity |
| Bounded candidate budget and internal surface count | `STL_VALIDATION_LIMIT` / `STL_PATCH_LIMIT`, simplify the source |
| Missing or mixed original-patch ownership after classification | `STL_PATCH_MAPPING_FAILED`, no install or silent reassignment |
| Runtime meshing failure, timeout, or nonpositive Jacobian | Stable stage-specific meshing error; old model/setup remain intact |

Translate coordinates near the model bounds for geometric predicates and volume
accumulation. Reject numerical uncertainty instead of changing input geometry.
Use compensated volume accumulation in production. The proposed diagonal bounds
are 1e-9 through 1e6 meters; input extent and representable coordinate differences
must both be usable. Do not convert validation failure into preview-only analysis.

## Persistent patch identity and interactions

Build exact-indexed triangle adjacency in source coordinates; traverse connected
neighbors where the dihedral angle is at most the selected threshold. Patches are
connected components under that rule (the rule is transitive, not a global normal
cone). A cylinder side may be one patch even though its normals span a full turn.

Each patch ID is `stl:` plus SHA-256 of a versioned encoding of source SHA-256,
units, grouping angle, normalization policy, and sorted canonical triangle geometry
membership. Raw triangle positions in a file and Gmsh tags are never durable IDs.
The demo implements this versioned membership scheme for its only normalization
policy (`none`). Identical bytes/options reproduce IDs in fresh workers; a rigid
orientation or mesh-size/order change does not enter the ID. A changed file or
grouping/options intentionally creates a new identity namespace. There is no
promise of identity across differently encoded exports of the same shape.

Install only after units/dimensions and patch review. Import failure, rejection,
Cancel, or stale completion preserves the existing model and all setup. Use the
existing replacement review for CAD→STL, STL→CAD, and later regrouping: explicitly
map or drop every assignment, then accept the summary. Material/gravity/settings
transfer by their existing contracts. No geometric nearest-face matching.

Patch selection uses Task 25's draft face-set model. Pressure and normal forces
follow each oriented facet; total component force integrates over all selected
Tri6 faces. Supports and component loads remain in global axes. Rotate geometry
as in the CAD path, preserving source/options and invalidating mesh/results.
Task 27 history remains bounded; replacing/regrouping the geometry clears history.
Display feature edges come from boundaries between user patches; optional wireframe
may show the tessellation without labelling it CAD curvature.

## Complexity, ownership, and production file boundaries

Parsing/indexing/edge adjacency are expected O(T) with bounded hash tables and
typed positions, connectivity, adjacency, normals, and patch membership arrays.
Canonical hashing is O(T log T) in the prototype; production can sort compact
triangle digests instead of retaining large coordinate strings. BVH construction
is O(T log T); candidate work is O(K) with an explicit cap because overlapping
inputs can make K quadratic. No unbounded all-pairs intersection scan. All bulk
work, including hashing, runs in disposable workers. UI receives only preview
buffers and compact diagnostics. Release temporary input/parser/classifier data
before volumetric meshing when ownership mapping permits it.

| File | Responsibility / consumers |
| --- | --- |
| `workers/stl-import.js` | Parser, full validator, units, source fingerprint and user patch construction; consumed only by mesher worker |
| `workers/mesher-worker.js` | Separate OCC/discrete adapters, internal-surface ownership mapping, geometry/mesh extraction; format-neutral results |
| `web/js/geometry/geometry-model.js` | Source/options/metadata validators and opaque surface contract |
| `web/js/workers/worker-protocol.js`, `mesher-client.js` | Versioned validated messages, retained-source work copies and cancellation |
| `web/js/analysis/app-controller.js` | Transactional source review, installation/invalidation, orientation and regroup/replacement orchestration |
| `web/js/ui/stl-import-ui.js` | Units/dimensions/patch review and explicit accept/cancel; consumes controller data, not parser internals |
| Existing replacement, draft, glyph, mesh display modules | Consume shared opaque surface IDs; no STL-dependent numerical logic |
| `tools/build-local-runtime.py` | Reproducibly bundle the helper before the mesher worker for HTTP and file execution |

Keep simulation-specific UI under the existing first-party application UI boundary;
do not couple portable UI Kit helpers to STL. The native solver only sees the
existing mesh/load contract. Existing CAD corpus and numerical/resource/distribution
acceptance criteria remain in force. M29 extends evidence rather than relaxing it.

## Owner decision record

Owner response: accepted on 2026-09-11 (“yes, accept.”). See `docs/reviews/28-stl-contract.md` for the
walkthrough. No task or v1 acceptance is implied by this feasibility report.
