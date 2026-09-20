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

Local fills and stray-facet removal remain reviewable proposals. If local repair
leaves detected intersections, a separate CGAL Alpha_wrap_3 worker constructs an
enclosing-surface candidate. It may join overlaps, fill gaps and round details;
this is explained beside **Use repaired model**. The serialized output must pass
all first-party strict solid checks. Original bytes remain downloadable. The
native adapter returns only indexed arrays; no CGAL types enter application,
mesher or solver contracts. Both repair phases share one two-minute deadline.
Ordinary imports do not instantiate CGAL. Cancellation terminates the current worker.

STL meshing now defaults to rebuilt analysis boundaries, freeing planar parts from
long skinny input triangles. Engineering groups remain independent of internal
surfaces. Inward thickness measurements cap mesh size, and group-area, volume and
bidirectional sampled surface-distance checks reject excessive boundary changes.
Original/reconstruct/experimental-remesh settings remain in Mesh Advanced. Model
owns grouping; method changes retain verified assignments and invalidate results.
There are no old-version compatibility paths.

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

CGAL's current candidate has 8,638 triangles, 220 selection groups and passes all
strict checks. Its kernel took 1,141.5 ms with a 29,097,984-byte WASM heap in the
recorded browser trial; this excludes source decoding, validation and UI startup.
These are local measurements, not performance guarantees or whole-browser memory.
The visible candidate softens small details; no maximum geometric deviation or
engineering equivalence to the intersecting input is certified.

**Gargoyle import is repaired; its default analysis mesh remains unsupported.**
The default discrete charts hit the 512-chart bound. An unshipped wider-chart
experiment passed that stage but then hit the conservative global-thickness work
cap. Local adaptive sizing and more capable chart construction need further work;
we have not relaxed fidelity/resource checks or silently fallen back to frozen
triangles. No gargoyle mesh, solve or stress accuracy is claimed.

The embedded repair runtime is 905,503 bytes (304,769 gzip), versus meshrepair's
420,165-byte embedded build (147,550 gzip; 233,308 raw WASM). Only the needed CGAL
adapter is compiled. The runtime is replaceable and bounded at 2 MiB / 768 KiB gzip.
Full pinned CGAL/Boost corresponding-source archives add about 144 MiB to a complete
offline source-accompanied folder; the hosted application does not load them.
First-party sources remain GPL-2.0-or-later; the combined CGAL distribution uses
GPL-3.0-or-later. Notices/source packaging are in the release manifest. Dependency
approval does not grant publication or final artifact approval.

## Verification

[Follow-up evidence](29-stl-followup-evidence.json) records current runs, source
hashes, the engine comparison and the failed gargoyle mesh probe. The
[current 68-case report](../../benchmarks/cad-corpus/chromium-152-stl-workflow.json)
records fresh outcomes. Its numerical STL baselines explicitly use original mode;
new default-analysis regressions are separate. The
[preceding report](../../benchmarks/cad-corpus/chromium-152-stl-workflow-before-solid-repair.json)
and [initial workflow evidence](29-stl-workflow-evidence.json) preserve history.

- 83 Python tests, eight native FEM CTests and the native repair ABI regression pass.
  Five historical numerical records and 36 historical resource records validate;
  this is not new release-wide calibration.
- Chromium 152 file tests cover the STL pipeline, default and advanced meshing,
  analytical solves/convergence, repair consent, replacement cancellation, worker
  protocol, geometry authoring/history, reports, unit preferences and layout.
  All 68 corpus cases agree, including the newly reviewable intersecting fixture.
- The elongated 20 × 0.5 × 0.5 part and fully rotated Tet4/Tet10 tests yield about
  7,200 elements, minimum gamma about 0.30, fifth-percentile gamma about 0.57,
  maximum edge ratio about 2.5 and no poor-quality elements. Thin appendages and
  shifted equal-area/volume boundaries have separate sizing/fidelity regressions.
- Chromium HTTP and Firefox 153 file tests pass solid repair (including gargoyle),
  real-app review and/or default-analysis checks. An HTTP favicon 404 is unrelated
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

The default thickness cap is global, not local adaptive refinement. Very fine
features can exceed its work limit. Distance samples are not a Hausdorff bound.
The earlier full resource calibration timeout remains unclaimed; resource smoke
and separate STL capacity/cancellation tests pass. No numerical tolerance was relaxed.

## Owner walkthrough

1. Open clean and winding/duplicate examples: identify the new filename immediately,
   see the part while checking, confirm dimensions, then continue with one action.
2. Open the optional gargoyle: compare Original/Prepared and inspect softened detail.
   Cancel once, reopen, then use the repaired model only if those changes are acceptable.
   Its current default meshing limit should be reported as above.
3. Open disconnected bodies: inspect a short grouped explanation, retain the preview
   and download the original. Hide details again; no endless repair checklist appears.
4. Replace an existing analysis and cancel; verify setup/results/view return. Then
   accept a replacement and use assignment transfer when required.
5. Mesh the elongated/rotated test part with the default method. Inspect quality and
   fidelity evidence. Exercise an advanced method change and Undo.

Planning approval and passing tests do not constitute owner acceptance or release
approval. Keep M29 open until this walkthrough is accepted.
