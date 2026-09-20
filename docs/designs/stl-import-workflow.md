# STL import workflow

Status: **Implemented; M29 owner walkthrough/acceptance pending.** On 2026-09-19 the owner
requested a simpler import workflow and consolidation of the previous STL plans.
The revised implementation is tracked in the [M29 review](../reviews/29-stl-workflow.md).
This document replaces the earlier import, simulation-surface and repair designs.
Historical measurements remain in `docs/reviews/` and `benchmarks/`; they do not
certify this workflow. [Plan 29](../plans/29-stl-import-workflow.md) is the sole
remaining STL implementation plan. `spec.md` remains the requirements authority.

## Intended experience

**Open STL → see the part while it is checked and cleaned → confirm dimensions
→ continue with material, supports and loads.**

The application handles routine preparation. It asks users about physical scale
and proposed shape changes, not validation algorithms or surface representations.
Readable triangles, a validated solid, and a usable analysis mesh are distinct
states. An invalid solid can be inspected without becoming eligible for analysis.

### Open and inspect

- Open a large preview in the main viewport with a compact import panel. Remove
  the separate small modal viewport. While replacing an existing part, keep its
  analysis in controller state and clearly label the displayed part as pending.
  Cancel restores the prior view, selection, setup, mesh and results.
- Decode bounded binary/ASCII input in a disposable JavaScript worker. Publish a
  preview before topology checks, repair, intersection validation or Gmsh startup.
  Rendering works even with holes, reversed triangles or disconnected pieces;
  use double-sided shading so reversed winding does not hide the problem.
- Run checking and routine cleanup automatically. Show truthful stages such as
  “Reading triangles”, “Checking surfaces”, “Corrected triangle directions” and
  “Checking repaired model”. Keep navigation and Cancel responsive. Do not invent
  percentage completion or an estimated duration.
- Keep a readable source visible on failure, timeout, or incomplete diagnostics. Closing the import panel cancels the entire pending
  import. If decoding itself is unsafe (malformed lengths, nonfinite coordinates,
  or input limits), explain the failure; do not promise a partial model preview.

### Confirm physical scale

- Show interpreted dimensions prominently beside source units (`m/mm/cm/in/ft`).
  Use the last **confirmed STL source unit**, or `mm` on first use, explicitly
  labeled “Assumed millimeters — confirm dimensions”. Never infer from filename
  or reuse general result/display-unit preferences as evidence of source units.
- Preview starts without a unit selection. Changing source units rescales the
  displayed dimensions immediately and invalidates scale-dependent checks and
  repair consent. Recheck automatically; retain the visible source and camera.
- A single primary **Use model** action confirms the displayed scale and installs
  a ready candidate. No additional checkbox or “Update preview” action is needed.
  Persist the source-unit preference only after successful installation; tolerate
  unavailable storage. There is no unit guess that silently installs a part.

### Cleanup and repair

| Operation | Default workflow |
| --- | --- |
| Exact duplicate or exactly zero-area facets | Remove automatically; summarize changes |
| Inconsistent or inward winding on an orientable shell | Correct automatically; summarize changes |
| Existing narrowly defined stray-facet removal | Prepare a proposal; highlight removed facets for approval |
| Small planar convex hole filling | Prepare a proposal; highlight added facets for approval |
| Remaining detected intersections after local repair | Subdivide intersections and extract a detail-preserving solid-boundary proposal in a separate worker; strict checks and explicit acceptance |
| Tolerance welding, manual vertex movement, discarding solid components, arbitrary reconstruction | Unsupported; retain useful diagnostics |

Automatic cleanup preserves coordinates and intended surface location. Never
erase a thin real triangle because a floating-point cross product rounded to
zero. Proposed deletion of nonzero-area facets is a shape change, even when the
existing repair routine calls them “stray”.

Compute eligible local repair proposals automatically using the retained bounds
and a default maximum hole width of 1% of the part diagonal. Put the existing
0–5% limit under **Repair details**, expressed with actual physical hole widths;
0 disables filling. Users normally see the proposed locations, not this setting.
Retain the existing strict geometric limits listed below.

For a fully validated proposal, change the primary action to **Use repaired
model**, with adjacent text explaining that highlighted surfaces will be added
or removed. This action also confirms dimensions. Users can compare Original /
Prepared without moving the camera, or reject the proposal and keep inspecting.
No second generic approval dialog follows. Replacement assignment transfer is
still required when existing supports/loads would be affected.

For unresolved intersections, use the replaceable exact-construction refinement
stage: split intersecting facets, extract the solid boundary, and retain unaffected
exterior coordinates. Highlight changed source regions and explain material changes
beside acceptance. Only enclosed inward voids within the explicit small-hole width
limit may be filled. Separate exterior bodies are never removed. No automatic
whole-model wrapping is permitted. Both workers share one deadline and terminate
before meshing; the application retains no CGAL types.

If preparation cannot produce a valid solid, retain original/cleaned previews,
fixed-issue information, and remaining diagnostics. Do not install a partial
repair or imply that checks not reached have passed. Offer specific next steps
and **Choose another file**, not an endless “Try repair” loop. Changing an actual
repair setting or explicitly retrying after a timeout can rerun preparation.

Always preserve byte-identical original input and offer **Download original STL**
in import details and the installed Model panel. A repaired candidate is a
separate source with a recorded digest and changes. Avoid copying unchanged source
bytes when original and prepared input are identical.

### Explain problems on the model

- Group findings as **Fixed automatically**, **Proposed changes**, and **Still
  unresolved**. Show counts and concrete text, not raw codes by default.
- Open boundaries highlight edge loops; nonmanifold findings highlight edges or
  vertices; intersections highlight both implicated triangles; disconnected
  components have selectable locations and counts. Proposed fills/removals show
  the affected surfaces. Fixed winding/duplicates are available in details.
- Clicking an issue focuses its bounds and highlights it. Provide keyboard
  selection, labels and symbols as well as color, issue highlighting separate from Fit, and a way
  back to the whole part. Occluded issues can be emphasized through the surface.
  Issue picking must not create load/support selections.
- Use stage-level updates, not a message or animation per triangle. Preserve the
  original locations for removed facets and distinguish source/candidate indices.
- Diagnostics are bounded: cap detailed location records at 1,000 and total
  referenced triangle/edge/vertex entries at 200,000. Aggregate additional counts
  where affordable. Mark truncated locations, lower-bound counts, checks skipped
  because of invalid prerequisites, and work-limit exhaustion explicitly. “No
  intersections found so far” is not a passed intersection check.

## Analysis setup and mesh preparation

Installation accepts only one closed, connected, consistently outward manifold
solid with positive usable volume and no self-intersections. Invalid previews
cannot enable supports, loads, meshing, checks, solve, convergence or export.
Existing valid analysis remains intact until replacement succeeds.

Create selection groups automatically (40° connected-neighbor default). Put
grouping adjustment in the Model selection controls near support/load authoring,
not in initial import. Retain keyboard access to groups. Changing groups on an
authored model requires explicit map/drop of assignments; cancel preserves them.

Put simulation-surface settings under **Mesh → Advanced**:

- Default: **Rebuild for analysis**. Reconstruct planar boundaries without retaining
  skinny source facets. Internal planes can share one engineering group. If the
  source requires more than 512 planar regions, rebuild its triangular boundary
  directly, then generate volume tetrahedra without parametrization charts;
  failures are explicit, without trying frozen triangles as a fallback.
- **Keep original surface** is an advanced option preserving source triangles.
- Optional **Reconstruct simple surfaces** with a positive deviation bound and
  a source/candidate comparison before application.
- Optional **Remesh STL surfaces (experimental)** with feature angle and clear
  geometry/pressure-fidelity diagnostics.

The default uses one construction rule with bounded refinement of failing regions.
Measure thickness at every source facet and combine it with a curvature target.
A graded distance field retains small elements around thin features and permits
larger elements farther away. Use this field in both surface and volume meshing;
estimate workload locally instead of imposing the thinnest feature everywhere.
The native boundary worker terminates before Gmsh starts. Both phases share one
120-second meshing deadline and cancellation; no CGAL types cross the array API.

Constrain engineering seams and sharp edges. Reject invalid or intersecting remesh
candidates; refine their affected source neighborhoods, without accepting a changed
solid. Accept a boundary only with group-area and volume errors at most 1% and
bidirectional sampled distances within `min(.001*diagonal,.15*localSize)`.
Sample every unique vertex, edge midpoint and facet centroid. These checks do not
certify maximum deviation or engineering accuracy; convergence and inspection remain
necessary. Retain explicit warnings for poor tetrahedra. See spec §6.1 for contracts,
local sizing, refinement and resource limits.
On a meshing failure, keep the installed model and explain the relevant next
action. Surface-method changes invalidate mesh/results but preserve selection
identities when exact ownership is verified. Ambiguous ownership fails; an actual
group/source change goes through explicit assignment transfer.

Recognize broad planar loading/support areas separately from the small curved strips
around fillets. Keep smooth cylinder walls together; a transitive angle flood alone
must not swallow the flat sides of a rounded mechanical part. See spec §6.1 for the
bounded, scale-relative classifier. This labels existing facets, without recovering
or inventing an exact CAD surface. Show face count and boundary lines during review.

Optional **Split selected face into two** and **Merge selected faces** sit beside
selection. Splitting creates two connected regions along source triangle edges;
merging requires touching faces. These are corrective controls, not import steps
or arbitrary sketch-based surface cuts. Preview changes; preserve the installed
model on cancellation and explicitly review existing assignments before transfer.
Source-bound edit records are capped at 64 operations. Reset recognition clears them.

Patch IDs derive from canonical prepared source content and group membership,
with source units included. A local split or merge retains IDs of unchanged faces. They do not include mesh
preset, simulation-surface method, reconstruction tolerance, remesh feature angle,
or rigid orientation. A method may own multiple internal surfaces for one group;
all must have unambiguous source ownership. Changing method must never attach
loads to a newly numbered surface by position.

## State, contracts and ownership

The alpha has no compatibility requirement. Replace the old STL options,
metadata, repair request, review state and version-1 facet-classification path.
Update producers, consumers, fixtures and tests together. Reject stale versions;
do not add aliases, migrations, legacy branches or a second import workflow.
Historical evidence schemas may remain readable by audit tools as historical
records, but cannot be fed back into the live application as legacy requests.

Use a small, file-safe **STL preparation worker** containing the parser,
diagnostics and local repair, without Gmsh/WASM. Terminate it before creating the
disposable Gmsh mesher. Solver and mesher lifecycles remain separate. All bulk
geometry work stays off the main thread. Do not create a generic job framework.

The controller owns one transient STL import session. Its state contains source
bytes, source-unit assumption, generation, available previews, diagnostics,
proposed/accepted changes, and readiness. Transitions are:

```text
reading → checking (source visible) → ready | needs-review | blocked
Use model / Use repaired model → install, or assignment transfer → install
unit/repair-option edit → new generation → checking (source remains visible)
Cancel → terminate worker, release pending data, restore installed analysis
```

`needs-review` means a fully checked shape-changing candidate is available;
`blocked` includes invalid, timed-out and incompletely checked candidates. The
controller, not DOM state or presence of a preview, decides installation eligibility.
Requests and all events carry session/request identity and generation. Late
preview/progress/completion after edits, cancellation or replacement is ignored.

Contracts separate source-unit/grouping settings from mesh surface settings.
Preview buffers have their own contract and cannot pass as `GeometryModel`.
Diagnostics carry check coverage, issue type/status, source or candidate revision,
bounds, counts and typed location buffers. Reports bind cleanup/proposals to
original/prepared digests. Validate finite values, lengths, indices, versions,
coverage and digest/revision associations at worker/application boundaries.

Transfer buffers rather than cloning; make a copy only when both sender and
receiver need ownership. Keep at most original plus current candidate source
bytes, with no chain of serialized repair intermediates. Keep only needed source
and candidate preview buffers. Stage updates send deltas/metadata, not repeated
full geometry. On installation dispose diagnostic GPU layers and temporary
buffers; retain source/provenance needed for original download and reproducible
fresh-worker meshing. Normal result rendering consumes accepted geometry only.

## Numerical and resource limits retained

These are explicit support limits, not capacity or performance guarantees:

- 16 MiB per source/candidate, 200,000 source/prepared-boundary triangles, 512 selection groups
  (advanced parametrization/reconstruction still cap internal surfaces at 512),
  2,000,000 intersection candidate pairs, 120 seconds per STL worker operation.
  The preparation deadline covers its whole request, not each automatic stage.
  The mesher retains its separate operation deadline and solver memory preflight.
- Decode coordinates without loss; exact indexing is allowed, tolerance welding
  is not. Physical diagonal must be in `[1e-9, 1e6]` m for acceptance. Triangle
  cross-product norm and volume must exceed `1e-14 * diagonal²` and
  `1e-14 * diagonal³`, respectively. A source can be shown pending a scale fix.
- Preserve edge/vertex-manifold, compensated signed-volume, BVH intersection and
  exact binary64 predicate checks. Revalidate every serialized repair candidate.
  Serialization uses binary32 only if all coordinates are exactly representable;
  otherwise round-trip binary64 decimal ASCII. Stored STL normals are advisory.
- Local filling: at most 128 simple loops, 3–32 vertices per loop, strictly convex
  and planar within `retainedDiagonal * 1e-10`; reject near-degenerate corners at
  `retainedDiagonal² * 1e-14`. Use existing vertices. Recompute retained bounds
  after approved cleanup/deletion so outliers cannot enlarge the hole limit.
- Proposed stray removal retains the existing rule: every edge is open or shared
  by more than two retained faces, with at least one of each; removal must not
  open an edge used by exactly two retained faces. Never delete a component.
- Original surface uses exact indexed discrete import, one or more surfaces per
  group as needed, fixed source facets (`Mesh.MeshOnlyEmpty=1`) and straight
  Tet10 boundary midpoints. Avoid Gmsh's tolerance-welding STL reader.
- Reconstruction remains limited to coplanar polyhedra (including inner loops)
  and whole cylinders/conical frusta with perpendicular flat ends. Require a
  closed shell, unambiguous ownership and the existing whole-facet deviation
  bound, not only vertex fit or volume agreement. Coplanar nonplanarity is bounded
  by both `1e-10 * diagonal` and one quarter of the selected deviation; retain the
  curved radial-projection factor `sqrt(1+slope²)` and `2e-10 * diagonal` margin.
  The polyhedral bound includes its `1e-10 * diagonal` margin. Unsupported trims,
  primitive combinations and freeform shapes stay unsupported.
- Experimental remeshing uses feature angle 1–40° (default 5°), capped by the
  selection angle, algorithm 6, selected mesh sizes, no point/curvature-derived
  sizing and straight Tet10 midpoints. A group can own several parametrized
  surfaces. Retain patch source/mesh area reports and the >1% area-change warning;
  area agreement does not certify shape accuracy or pressure-vector agreement.
- Preserve sampled positive Jacobians and element-relative degeneracy
  `abs(det J) <= 1e-12 * longestCornerEdge³`, existing numerical tolerances,
  equilibrium/convergence diagnostics and independent native-solver boundaries.

## Acceptance

1. Valid binary/ASCII STL is visible before solid checks finish; one scale-confirming
   action reaches setup. Routine winding/duplicate cleanup adds no repair click.
2. An open or intersecting model remains navigable; findings locate the defects.
   Fixed findings remain distinguishable from unresolved or unchecked conditions.
3. Proposed fills/deletions are visibly reviewable. Only the explicit repaired-model
   action accepts shape changes. Original download is byte-identical.
4. Clean, repaired and blocked flows preserve scale correctness, cancellation,
   stale-response rejection and replacement atomicity. Invalid previews never
   satisfy analysis contracts.
5. Mesh methods live in Mesh; grouping lives with selection. Verified method
   changes retain assignments while invalidating mesh/results. CAD import and
   downstream numerical contracts retain their behavior.
6. File/HTTP, numerical, corpus, resource, keyboard, resize and high-DPI checks
   have current evidence. M29 owner review accepts the new flow before M30; M30
   and exact-candidate Task 20 remain separate release gates.

Historical evidence: [M28 feasibility](../reviews/28-stl-contract.md),
[initial integration](../reviews/29-stl-workflow.md),
[surface methods](../reviews/29-stl-simulation-surfaces.md),
[capacity](../reviews/29-stl-import-usability.md),
[repair](../reviews/29-stl-surface-repair.md), and
[funnel limitations](../reviews/29-funnel-remeshing.md).

## Owner-feedback follow-up

Open the filename before reading bytes. Status distinguishes reading, checking and
repairing, ready for setup, repair proposal, and unsuccessful automatic repair.
During replacement, explicitly retain the old analysis until acceptance. A decoded
STL is a triangle surface; this is not recognition of CAD design features.

Intersection pairs sharing triangles form connected inspectable regions. The
aggregate still reports the exact pair count; a component count means components,
not their triangles. Keep diagnostic locations expandable and describe them as
explanations of blockers, not repairs the user must individually perform. Hide
issue controls for clean files and comparison for unchanged files.

The optional solid-repair kernel is a separate, replaceable dependency behind
plain typed-array worker contracts. It must produce a candidate, never directly
install geometry. All material changes require before/after review and strict
serialized-candidate validation. Its size, licenses, source distribution and build
pins must be recorded before runtime integration; dependency approval alone does
not establish geometric fidelity or authorize publishing a release.
