# M29: visible STL preparation and analysis workflow

Status: **Implemented; owner walkthrough/acceptance pending.**
Branch: `feat/stl-import-workflow`. Implementation through `5a9c934`, verified
2026-09-20 on Linux x86_64. Task 30 and release acceptance remain unstarted.
The [design](../designs/stl-import-workflow.md) and
[completed implementation plan](../plans/29-stl-import-workflow.md) are the sole
current STL work queue.

## Delivered workflow

Open an STL and see safely decoded triangles in the main viewport before solid
checks. Readable invalid geometry remains visible. The preparation panel shows
assumed source units, original/prepared dimensions, progress and localized findings.
Routine exact-duplicate/zero-area removal and winding correction run automatically.
Hole fills and nonzero stray-facet removal require **Use repaired model** after
inspection. Unresolved problems block acceptance. Keyboard issue buttons focus
locations; comparison preserves the camera; Cancel restores the prior presentation
and analysis. Original bytes remain downloadable.

The preparation worker contains no Gmsh/FEM payload. Startup checks only the
lightweight worker path and WebAssembly availability. Gmsh/FEM start on demand.
The controller rejects stale generations, mismatched geometry/digests/units,
invalid previews offered as geometry, and unconsented shape changes.

Grouping is in Model; surface settings are in Mesh Advanced. Review a candidate
before Apply. Source group identities survive original/reconstruct/remesh choices,
feature-angle/tolerance edits and rigid orientation. Applying mesh settings retains
assignments, clears mesh/results and participates in Undo/Redo. Replacing source or
grouping uses explicit assignment transfer when assignments exist. A new source
starts with its reviewed surface settings, rather than inheriting an unrelated fit.

Protocol 4, source/group version 3, and independent surface settings replace the
old combined options and repair request. There is no compatibility path. Native
solver sources, numerical algorithms, pinned Gmsh/FEM binaries and vendor assets
are unchanged.

## Evidence

[Machine-readable checks and source hashes](29-stl-workflow-evidence.json) accompany
this review. The [new corpus report](../../benchmarks/cad-corpus/chromium-152-stl-workflow.json)
contains fresh measurements; older reports remain unchanged.

- 80 Python tests and all 8 native CTest tests pass. Five stored validation records,
  36 stored resource records, the 68-entry corpus and distribution artifacts audit
  successfully. Auditing historical records is not fresh release calibration.
- The browser evidence lists 46 distinct current harnesses, plus STL mode/repair
  variants, in Chromium 152.0.7977.75. The CAD corpus agrees on all 68 raw
  classifications and all 18 STL preparation outcomes. The original 50 CAD
  expectations are unchanged.
- Chromium and Firefox 153 pass preparation and real-app import/repair/surface-review
  checks under both `file://` and HTTP. Chromium worker-runtime, numerical, report,
  history, selection, units, convergence and layout regressions pass.
- Cube solves pass for original, reconstruction, experimental remeshing and winding
  cleanup; a reviewed hole-fill candidate also passes reconstruction and analytical
  solve checks. Curved reconstruction retains the existing displacement/stress,
  reaction and equilibrium limits. No numerical acceptance tolerance was relaxed.
- Cancellation, accelerated deadline, stale/malformed messages, source preservation,
  source/candidate facet indices, grouping limits, and truncated diagnostic locations
  have explicit regression coverage. The deadline test shortens only the test clock;
  production retains 120 seconds.
- Offline real-app checks made no remote requests or page errors. Keyboard issue
  focus/activation and Escape, all bundled color schemes, 1440×1000 and 760×700
  layouts, reduced motion and 2× DPI passed. There was no horizontal overflow.
- All three generated worker wrappers reproduce byte-for-byte across repeated
  builds. Distribution hashes are current; publication approval is not asserted.

### Resource and corpus interpretation

The 200,000-triangle winding-cleanup case provides separate time-to-first-preview,
preparation, surface import and mesh timings in the evidence. The final preparation-only
repeat measured 140.9 ms to preview and 40,518.7 ms to complete. These are local
measurements, not latency guarantees. The 50,000-triangle case, 16 MiB boundary,
triangle/work limits and cancellation/recovery also pass. Retained preview byte
counts and WASM sizes do not measure total browser or GPU peak memory. The new
source/candidate facet map has at most 200,000 Int32 entries (0.8 MB).

The full resource calibration matrix exceeded the browser harness's 300-second
wait during the first mixed-scale 150k-node repetition. It is **not claimed as
passed**. The resource smoke profile passed; full calibration remains part of the
later release audit. STL-specific capacity checks completed independently.

The new default keeps original boundary triangles. Consequently its element counts
and quality distribution differ from the removed version-1 classification path.
Only the six accepted STL mesh baselines were remeasured, using the same relative
regression bands; geometry-volume, positive-Jacobian and analytical accuracy checks
remain intact. Raw invalid fixtures still reject. Preparation makes reversed,
inconsistent, duplicate/nonmanifold and exact-degenerate fixtures usable where
routine cleanup suffices; open, intersecting, disconnected and pinched cases stay
blocked. Malformed/nonfinite input produces no preview.

## Owner walkthrough — about 20 minutes

1. Open valid binary and ASCII parts. Confirm visible size and use the model with
   one action. Change assumed units and check the resulting physical dimensions.
2. Open a reversed/duplicate-facet part. Inspect optional cleanup findings and
   continue without a separate repair command.
3. Open a small-hole part. Focus the proposed fill, compare Original/Prepared,
   reject once, then explicitly accept. Download the unchanged original.
4. Open intersecting/disconnected input. Inspect localized errors and actionable
   explanations; verify there is no analysis-ready claim.
5. Replace a solved model, then Cancel. Verify view, setup and results return.
   Retry and exercise explicit assignment transfer where needed.
6. Author supports/load, mesh, check and solve. Find grouping in Model and surface
   methods in Mesh Advanced. Compare and apply a method change, verify retained
   assignments/invalidation, Undo/Redo, and remesh.

Record confusing steps and address them within M29. Automated evidence does not
replace owner usability acceptance; keep M29 unchecked until that walkthrough.

## Historical evidence

The [2026-09-11 packet](29-stl-workflow-2026-09-11.md),
[original machine evidence](29-stl-evidence.json),
[old corpus report](../../benchmarks/cad-corpus/chromium-152-stl.json),
[M28 scope decision](28-stl-contract.md),
[surface-method evidence](29-stl-simulation-surfaces.md), and
[repair evidence](29-stl-surface-repair.md) retain their original scope.
