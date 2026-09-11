# Explicit local STL surface repair

The owner requested defect detection and an offered repair during import. This
extends the accepted STL contract; normal imports still never modify their input.
No new dependency, runtime download, CAD kernel or solver change is introduced.

## Review flow and retained sources

The existing validator identifies invalid input during the automatic units-based
review. Open edges, nonmanifold edges/vertices, degenerate triangles and winding
errors expose **Try surface repair**. The user controls maximum hole diameter:
0–5% of the remaining part's bounding-box diagonal, default 1%; 0 disables hole
filling. Trying repair does not accept a model.

Successful repair produces a separately serialized, fully validated STL. The
normal import path builds its preview, using the selected original/reconstruct/
remesh mode. The review reports removed/corrected triangles, filled holes and
maximum filled-hole diameter; changes to overall dimensions are also shown.
Explicit **Import model** installs the reviewed candidate. Failed, cancelled and
stale operations leave the installed analysis unchanged. Existing assignments
still use explicit replacement transfer.

The controller-owned source retains `repair: {version: 1, originalSourceBytes,
report}` alongside the candidate `sourceBytes`. Original bytes are preserved
byte-for-byte, may be downloaded during review, and survive installation and
later regrouping/replacement transfer. **Discard repair** restores the original
source in the pending review. Both source buffers count toward memory use: at
most 16 MiB each. Meshing transfers a copy of the candidate, not the unrepaired
original. Hash/triangle-count checks bind repair provenance to imported geometry.

The report stores SI measurements with the length unit used when repairing.
Changing reviewed units retains the source bytes, invalidates geometry normally,
and displays repair measurements in the new interpretation of source units.
A reconstructed CAD preview compares against the **repaired** STL; its deviation
bound does not certify the repair's geometry changes.

## Local algorithm and refusals

`StlImport.readUnvalidated` shares strict binary/ASCII decoding, finite-coordinate
and scale checks with `parse`. It is not a solid validator and is only used by
the explicit worker repair path. The normal `parse` entry point continues through
all existing topology, orientation, volume and exact intersection checks.

`workers/stl-repair.js` performs deterministic source-order operations:

1. Index exact shared coordinates; remove exact duplicate facets, independent of
   winding. Suspected zero-area facets require exact binary64 orientation
   predicates before removal. Roundoff alone must not erase a thin real facet.
2. Remove isolated stray triangles only when every edge is either open or shared
   by more than two retained faces, with at least one of each. Never remove a
   triangle that would open an edge currently used by exactly two faces.
3. Propagate consistent winding across two-face edges. Reject unresolved branching
   edges, contradictory orientation or multiple edge-connected components. Never
   choose a component to discard or join parts with added material.
4. Recompute the retained bounds, excluding removed stray/degenerate outliers.
   This bounds hole filling; corrupted original extents cannot inflate the limit.
   Fill at most 128 simple loops, each with 3–32 vertices, strictly convex and
   planar within `retainedDiagonal * 1e-10`. Reject near-degenerate corners using
   the existing `diagonal² * 1e-14` area criterion. Each loop's greatest pairwise
   vertex distance must fit the user's diameter limit. Triangulation uses only
   existing boundary vertices, with orientation opposite the boundary edges.
5. Use compensated signed volume relative to retained bounds to orient the
   candidate outward. Do not move, tolerance-weld or smooth vertices.
6. Serialize binary STL only if every retained source coordinate is exactly
   representable in binary32. Otherwise serialize round-trip binary64 decimal
   ASCII, with bounded output size. Normals/header data are regenerated; original
   bytes remain available. Reparse the serialized candidate through the unchanged
   **full solid validator**, including vertex fans and self-intersections.

A topology cleanup is not proof of a valid simulation boundary. Residual contacts,
self-intersections, pinches, nonflat/concave/large holes and disconnected parts
remain actionable failures. No partial repair is installed after such a failure.
The distinction between combinatorial and geometric repair is also described in
[CGAL's mesh repair manual](https://doc.cgal.org/latest/PMP_Mesh_repair/index.html);
CGAL is a design reference, not a shipped dependency or copied implementation.

## Worker and model contracts

Coarse worker protocol remains 3. The additive `stl-repair` request has `version:
1`, source name/format/bytes, existing import options, and `repairOptions:
{version:1, maxHoleDiameterRatio}`. Its `stl-repair-result` carries `{version:1,
sourceBytes, report}`; candidate buffer ownership transfers back to the client.
The normal 120-second operation deadline and worker termination on cancellation
apply. All geometry work remains off the main thread.

Report version 1 (`method: 'local-stl-repair'`) includes source/candidate SHA-256,
original/repaired triangle counts, duplicate/zero-area/stray removal counts,
retained-face winding corrections, hole/addition counts, largest filled-hole
width, selected ratio, source and retained diagonals, before/after bounds, repair
units and the candidate's full validation report. `before` edge counts describe
topology after duplicate/zero-area cleanup and before stray-face removal.
Counts must reconcile exactly; holes, added triangles, dimensions and validation
work must stay within bounds. Source history is validated before review or
installation; the candidate hash and count must match imported source metadata.

Input/output remain capped at 16 MiB and 200,000 triangles. The existing
2-million intersection-candidate bound remains; successful repair does not waive
512-surface classification or solver/mesh quality gates. Stable errors include
`STL_INVALID_REPAIR_OPTIONS`, `STL_REPAIR_UNSUPPORTED`, `STL_REPAIR_CANCELLED`,
`MESHER_TIMEOUT`, and `INVALID_STL_REPAIR_RESULT`.
