# M29 STL import usability and capacity

Implemented on `feat/28-29-stl-import` in response to the owner’s import-flow
feedback. M29 acceptance and release approval remain separate.

## Import behavior

New imports ask for file units, automatically validate/preview the original
triangles, display dimensions in those units, and require **Import model**.
Advanced options retain reconstruction, experimental remeshing and selection
angles. Failed reconstruction has an explicit **Use original triangles instead**
action. This changes the reviewed mode; it does not automatically install a
model. Cancellation, stale responses and assignment transfer keep their previous
contracts. Reopening an existing STL retains its chosen options.

Binary files show triangle counts from an exact-length header before units are
selected. This is a source summary, not solid validation. Detailed sources
(25,000+ triangles) show advice during review and before meshing: try Coarse,
compare refinement, expect potentially minutes of work, and use Cancel as
needed. The existing two-minute operation deadline remains. The threshold is a
usability heuristic motivated by the funnel case, not a calibrated ETA. ASCII
counts are available after worker validation. Original triangles can still
produce a dense/poor mesh even with Coarse selected.

## Expanded capacity

The parser and geometry contract now accept up to **200,000 triangles**, with the
16 MiB byte bound unchanged. Topology, intersection and volume checks remain
mandatory, as do the 512-surface and 2-million-candidate limits. No geometry
repair, tolerance welding, dropped faces or relaxed numerical predicates were
introduced.

`stl-large-tests.html` creates a procedural unit cube with exactly 200,000 source
triangles (196,608 grid triangles plus 1,696 centroid splits). It exercises
original import, analytic reconstruction, then a fresh-worker coarse Tet10 mesh
from the same dense source. Both imports preserve six selection groups and
1 m³ volume. The mesh has positive sampled Jacobians, six mapped groups and
fewer than 10,000 nodes. The source is generated, not redistributed fixture data.

An initial Chromium 152 file-mode run measured 20.4 s for original import,
20.7 s for reconstruction, and 21.1 s for fresh-worker reconstruction/meshing.
The reconstructed mesh contained 5,901 nodes and 3,530 Tet10 elements. These are
measurements on a highly structured cube, not a prediction for arbitrary shapes.
Final file/HTTP measurements and WASM/preview-buffer sizes are in
`benchmarks/stl-import/usability-chromium-152.json`. WASM capacity does not measure
whole-browser memory or JavaScript heap; both original and reconstructed preview
buffers are counted where retained.

## Supplied gargoyle

`cathedral_gargoyle.stl` is 3,308,784 bytes with 66,174 binary triangles. Its size
is accepted by the new bounds. All three surface modes then report
`STL_NONMANIFOLD`, before constructing simulation geometry. An independent exact
coordinate edge-incidence count finds 99,255 edges used twice, three edges used
three times, and three edges used once. There are no exact duplicate facets or
facets with repeated vertices. This does not certify the remaining geometry:
full validation stops at the first topology defect. A separate in-memory probe
removed the two faces responsible for the irregular edge counts; it then failed
vertex-fan validation. Removing those faces alone is therefore not a repair. No
modified copy was saved or used by the application.

The actionable next step is to repair the surface in the source modeling
application and export a closed, manifold solid. Reconstruction and remeshing
cannot repair these defects. An in-app repair workflow would be a separate
geometry-changing feature requiring a reviewed candidate and clear reporting of
changes, not a bypass of the simulation validator.

The optional `stl-large-tests.html?fixture=gargoyle` case verifies this diagnostic
in original, reconstruction and experimental remeshing modes. The supplied
funnel and gargoyle files and their Zone.Identifier files remain untracked and
unchanged.

## Verification

- 79 Python tests and 8 native tests passed.
- 43 direct-local browser configurations passed, including all 68 CAD corpus
  cases, the original 50,000-triangle resource case, analytical STL solves,
  experimental funnel remeshing, the new 200,000-triangle boundary and gargoyle
  rejection. Rapid unit changes also verify that stale previews cannot replace
  the latest reviewed units.
- 5 HTTP configurations passed: worker runtime, STEP import, STL workflow,
  200,000-triangle capacity and supplied-gargoyle rejection.
- Local runtime packaging and distribution audit passed; only the first-party
  worker source payload and its hashes changed. No vendor/WASM rebuild.
- Reviewed the complete source/test/documentation diff, checked whitespace, and
  inspected the revised import dialog with the supplied funnel.
