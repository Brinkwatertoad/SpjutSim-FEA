# M29: visible STL preparation and analysis workflow

Status: **Owner-feedback implementation available; M29 acceptance pending.**
Branch: `feat/stl-import-workflow`, verified 2026-09-20 on Linux x86_64.
The [design](../designs/stl-import-workflow.md) and
[Plan 29](../plans/29-stl-import-workflow.md) remain the sole current STL work queue.
Task 30 and the exact-candidate release review remain separate gates.

## Current behavior

A selected filename appears before asynchronous file reading finishes. Readable
triangles appear before checks, including invalid surfaces. Status distinguishes
reading, checking/repairing, ready, proposed repair and unsuccessful repair.
Cancel preserves the installed analysis and rejects late file reads/worker replies.
Routine exact duplicate/zero-area removal and winding correction are automatic.

Intersection pairs are grouped into connected regions, with exact pair totals.
Component counts mean components. Unresolved locations are expandable explanations,
not a list of manual tasks. Clean or fully repaired candidates hide “Highlight
unrepaired regions”; viewport Fit remains separate. Before/after comparison retains
the camera. Preview shading retains visible detail under the viewport lights.

Local fills and stray-facet removal remain reviewable proposals. Remaining
intersections start a separate exact-construction refinement worker. It splits
intersections and extracts the boundary while preserving unaffected source vertices.
Localized changes and small enclosed void fills require **Use repaired model**.
Every serialized candidate passes all strict checks; original bytes remain intact.
Automatic whole-model wrapping has been removed. Both repair phases share one
two-minute deadline, and native types remain behind a replaceable array interface.

Default analysis meshing rebuilds planar boundaries exactly. Complex surfaces use
constrained triangle-surface remeshing followed by discrete Gmsh volume meshing,
without parametrization charts. A graded local thickness/curvature field controls
both stages. The surface worker terminates before Gmsh starts; all meshing phases
share one two-minute deadline. Candidates must pass strict topology/intersection
checks, per-group area/volume limits and bidirectional local surface-deviation checks.
Original/reconstruct/experimental-remesh remain explicit advanced choices. Group IDs,
assignments, method invalidation and Undo/Redo retain their existing contracts.

## Repair-engine decision and limits

The supplied gargoyle has 66,174 raw facets. Local cleanup removes two stray
facets, leaving 1,800 intersection pairs grouped into ten regions, three components
and a pinched vertex. An independent Python rational-arithmetic check confirmed
all 1,800 pairs; these are not merely coplanar contact false positives.

We built and tested meshrepair with VCGlib, rather than inferring its behavior from
its README. Minimal/print-ready still leave 1,800 pairs; aggressive leaves 1,792.
All three return success from that library but fail our strict solid checks. This
does not establish that a custom VCGlib pipeline cannot work. VCGlib/meshrepair also
use GPL terms, so neither is a permissive-license replacement as currently licensed.

The detail-preserving repair produces 61,448 strict-valid facets. An independent
coordinate comparison confirms 57,030 original facets retained unchanged, with
identical exterior bounds. One enclosed inward four-facet void (about 0.25 mm wide)
is filled within the explicit local limit. The original exterior is not offset.

**Gargoyle default volume meshing now passes in Chromium and Firefox.** The recorded coarse
Tet4 run produced 129,256 boundary triangles and 517,043 tetrahedra in about 50 s in Chromium and 111 s in Firefox.
Its volume change was 0.063%; maximum group-area change was 0.870%. Bidirectional
sampling checked 572,112 unique vertex/edge-midpoint/facet-centroid locations;
maximum sampled deviation was 0.129 mm, and every local limit passed.

The mesh has no inverted or near-zero-Jacobian elements. It still has 1,002 elements
below gamma 0.1 (about 0.19%), minimum gamma about 2.1e-6 and maximum edge ratio
about 15,629 around retained microscopic features. The quality warning remains
visible. Median gamma is about 0.75 and fifth percentile about 0.40. A successful
mesh does not establish stress accuracy or convergence; no gargoyle solve is claimed.

A folded-cube fixture previously accepted through wrapping now remains blocked:
exact refinement cannot produce one supported closed boundary within the local
fill limit. It remains visible with a specific explanation. The corpus expectation
records this intentional consequence of removing automatic approximation.

The combined repair/surface runtime is 1,479,354 bytes (480,772 gzip), within the
2 MiB / 768 KiB budget. An optimized build replaces the earlier size-optimized
prototype to reduce Firefox meshing time. Only the selected CGAL adapter is linked.
Full pinned CGAL/Boost corresponding-source archives add about 144 MiB to a complete
offline source-accompanied folder; the hosted application does not load them.
First-party sources remain GPL-2.0-or-later; the combined CGAL distribution uses
GPL-3.0-or-later. Notices/source packaging are in the release manifest. Dependency
approval does not grant publication or final artifact approval.

## Verification

[Follow-up evidence](29-stl-followup-evidence.json) records current runs, source
hashes and the historical engine comparison. The
[current 68-case report](../../benchmarks/cad-corpus/chromium-152-stl-workflow.json)
records fresh outcomes. Its numerical STL baselines explicitly use original mode;
new default-analysis regressions are separate. The
[preceding report](../../benchmarks/cad-corpus/chromium-152-stl-workflow-before-solid-repair.json)
and [initial workflow evidence](29-stl-workflow-evidence.json) preserve history.

- 83 Python tests, eight native FEM CTests and both native adapter ABI regressions pass.
  Five historical numerical records and 36 historical resource records validate;
  this is not new release-wide calibration.
- Chromium 152 file tests cover the STL pipeline, default and advanced meshing,
  analytical solves/convergence, repair consent, replacement cancellation, worker
  protocol, geometry authoring/history, reports, unit preferences and layout.
  All 68 corpus cases agree, including the intentionally blocked folded-cube fixture.
- The elongated 20 × 0.5 × 0.5 part and fully rotated Tet4/Tet10 tests yield about
  7,200 elements, minimum gamma about 0.30, fifth-percentile gamma about 0.57,
  maximum edge ratio about 2.5 and no poor-quality elements. Thin appendages and
  shifted equal-area/volume boundaries have separate sizing/fidelity regressions.
- Chromium HTTP and Firefox 153 file tests pass solid repair (including gargoyle),
  real-app review and/or default-analysis checks, including full gargoyle volume meshing in Firefox. An HTTP favicon 404 is unrelated
  to worker/runtime loading; no external runtime requests are required.
- Real UI tests reject missing consent, preserve exact original bytes and installed
  analysis on Cancel, and retain repair provenance. Cancellation at worker handoff
  produces no accepted result. A control regression first failed for the redundant
  highlight button, then passed with the fix.
- Offline, keyboard, Escape, all themes, 1440 × 1000 / 760 × 700, reduced-motion and
  2× DPI checks pass. Original/prepared gargoyle screenshots were visually reviewed.
- Two native/WASM builds reproduce the repair runtime byte for byte. Python wrapper
  checks reproduce all worker scripts. License notices are verified against their
  pinned archives. Optional supplied gargoyle/funnel files are excluded from the
  source-distribution snapshot; this has a regression test.

Local sizing removes the old global minimum-thickness cap. Workload integration
is approximate and does not replace solver memory preflight. Sampled deviation is
not a Hausdorff certificate. The earlier full resource calibration timeout remains
unclaimed; stored numerical/resource records are validation of historical data,
not a fresh release-wide calibration. M29 owner acceptance remains open.

## Owner walkthrough

1. Open clean and winding/duplicate examples: identify the new filename immediately,
   see the part while checking, confirm dimensions, then continue with one action.
2. Open the optional gargoyle: compare Original/Prepared and inspect retained detail and highlighted
   local changes. Cancel once, reopen, then accept the proposal and generate the
   default mesh. Inspect fidelity evidence and the remaining poor-element warning.
3. Open disconnected bodies: inspect a short grouped explanation, retain the preview
   and download the original. Hide details again; no endless repair checklist appears.
4. Replace an existing analysis and cancel; verify setup/results/view return. Then
   accept a replacement and use assignment transfer when required.
5. Mesh the elongated/rotated test part with the default method. Inspect quality and
   fidelity evidence. Exercise an advanced method change and Undo.

Planning approval and passing tests do not constitute owner acceptance or release
approval. Keep M29 open until this walkthrough is accepted.
