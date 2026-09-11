# M29 reviewed local STL surface repair

Implemented on `feat/28-29-stl-import` following the owner's request to detect
surface defects during import and offer repair. The existing import validator
exposes **Try surface repair** after relevant errors. A successful candidate
requires normal preview and explicit import; original bytes remain available
through **Download original STL** and **Discard repair**. Existing surface
processing modes and assignment-transfer review remain available.

## Scope and safeguards

Repair removes exact duplicate/zero-area facets and narrowly defined isolated
stray triangles, corrects winding, and fills small flat strictly convex holes.
The selected hole diameter limit is 0–5% of the retained part diagonal, default
1%; 0 disables hole filling. Vertices are not moved or tolerance-welded, and
components are not discarded or joined. Source coordinate precision is retained.
Every serialized candidate passes all existing solid validation checks.

The change report describes removals, winding corrections, holes and changed
overall dimensions. Source/candidate hashes and counts bind retained history to
the imported geometry. Cancellation, deadlines, failed validation and stale
replies preserve the installed source and analysis. The invalid-source review
now hides the viewer's default placeholder until a validated preview exists.

The [design](../designs/stl-surface-repair.md) specifies numerical criteria,
ownership, protocol and refusal behavior. No solver method, dependency, vendor
code or WASM binary changed. Worker packaging was regenerated reproducibly and
the distribution artifact audit passed.

## Verification

- 79 Python tests and all 8 native tests passed.
- All 49 direct `file://` browser configurations passed, including the 68-case
  CAD corpus, resource smoke checks, existing STL processing modes and funnel
  remesh/solve. All 7 HTTP configurations passed.
- Local repair tests cover duplicate/zero-area/stray removal, inconsistent and
  inward winding, triangular and quadrilateral holes, disabled/oversized/nonflat
  hole refusals, intersecting/disconnected surfaces, and ASCII precision.
- Regressions prove roundoff cannot remove a real skinny facet and removed
  outliers cannot inflate the hole diameter limit.
- Worker/UI tests cover offered repair, explicit review, original preservation,
  unit changes, candidate provenance, cancellation, simulated deadline expiry,
  stale replies, discard, installation, reopening and replacement setup transfer.
  Focused workflow tests passed again after final provenance and preview fixes.
- An actual browser download matched all 1,063 original bytes of
  `inconsistent.stl`; repair offer and candidate preview were visually inspected.
- A repaired cube meshed in a fresh worker and solved to displacement
  `1.0000000012516834e-6 m`, stress `1000.0000026285716 Pa` and normalized force
  imbalance `3.2420788695681206e-10`. Existing faceted-cylinder analytical checks
  passed in the same suite.
- At 200,000 source triangles, correcting one reversed face and fully validating
  the candidate took 20.98 seconds in file mode and 20.76 seconds over HTTP.
  Subsequent original/reconstruction imports and fresh-worker meshing passed;
  the reconstructed mesh had 5,901 nodes, 3,530 Tet10 elements and positive
  minimum sampled Jacobian `0.00047279511329354997`.

Measured reports are retained in
[`repair-chromium-152.json`](../../benchmarks/stl-import/repair-chromium-152.json).
These structured test geometries do not predict repair/meshing time for arbitrary
parts. The 16 MiB, 200,000-triangle, intersection-work and 120-second operation
limits remain. Original and candidate source buffers are both retained; this
adds at most one extra 16 MiB source buffer to controller state.

## Supplied gargoyle

The supplied `cathedral_gargoyle.stl` contains 66,174 triangles in 3,308,784 bytes.
The real import UI offers repair after detecting nonmanifold topology. Removing
two isolated stray triangles still leaves three edge-connected surface
components of 41,062, 13,936 and 11,174 triangles. Local repair therefore returns
`STL_REPAIR_UNSUPPORTED` with the remaining-component explanation and leaves the
installed model unchanged. It does **not** produce a repaired importable gargoyle.

This file needs more extensive surface reconstruction or source-application
repair. Component counts describe connectivity, not the author's intended part
structure. The supplied gargoyle and funnel files were not modified, added to
the redistributable fixture corpus or committed.

## Final diff review

Reviewed the complete first-party diff and new module/tests inline, including
algorithmic bounds, exact predicates, precision-preserving serialization,
worker termination, source ownership, stale responses, provenance guards, UI
labels, accessibility and generated-artifact reproducibility. No outstanding
defect was identified within the implemented local-repair scope.
