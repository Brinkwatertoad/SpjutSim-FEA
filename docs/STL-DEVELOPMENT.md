# Paused STL development: resume guide

The owner paused STL support on 2026-09-20 to keep the main application focused on
single-solid STEP, IGES and OpenCASCADE BREP analysis. This branch,
[`features/stl-import`](https://github.com/Brinkwatertoad/SpjutSim-FEA/tree/features/stl-import),
preserves the implementation and its full commit history. It is a research/feature
branch, not accepted v1 functionality. Main is being simplified independently.

## Why this was paused

Reliable STL analysis grew into a geometry-preparation subsystem: diagnose and
repair triangles, infer useful load/support faces, preserve material/detail,
remesh the boundary, check fidelity and then mesh the volume. Clean mechanical
STLs can work, including numerical patch tests, but arbitrary downloaded meshes
still require difficult engineering choices. Successful meshing alone does not
establish useful boundary conditions or defensible stresses. The added complexity
and maintenance cost did not fit the current CAD-centered product scope.

## Development history

History predating this branch is preserved in its ancestry. Useful checkpoints:

| Commit | Development / lesson |
| --- | --- |
| `811b668` | Initial validated STL import and analysis, durable selectable patches. |
| `f12a236` | Original-triangle meshing and bounded primitive reconstruction. |
| `8d6adb1` | Experimental surface remeshing and fidelity diagnostics. |
| `b77d224`, `0c046ed` | Larger inputs, import review and local repair proposals. |
| `22c3aeb` | Consolidated the competing STL plans into one design and plan. |
| `761c70d`, `c03de9c`, `e6af878` | Immediate invalid-surface preview; lightweight preparation; inline repair review and separate mesh settings. |
| `58b67c3`, `5a9c934`, `017488c` | Workflow/corpus checks, shared diagnostic budgets and review evidence. |
| `25084ab` | Replaced thousands of intersection-pair tasks with connected regions; identified the newly selected file immediately. |
| `10d1014` | Rebuilt planar boundaries; thickness sizing and fidelity checks for long, thin parts. |
| `d80bdb3` | Modular CGAL Alpha Wrap prototype. Could form a solid but erased unacceptable exterior detail. Superseded. |
| `05ebb05` | Replaced wrapping with exact intersection subdivision and solid-boundary extraction. |
| `1a11a5e` | Chart-free constrained surface remeshing and graded local sizing. Removed the default complex-surface chart dependency. |
| `eed2cbd` | Recognized planar engineering faces beside fillets; reviewed split/merge; corrected curvature sizing, temporary refinement limits and Firefox performance. |

The sole current [design](designs/stl-import-workflow.md), [plan](plans/29-stl-import-workflow.md),
[review](reviews/29-stl-workflow.md) and [machine-readable evidence](reviews/29-stl-followup-evidence.json)
contain algorithms, contracts, test outcomes and prior investigations. Earlier
plans remain accessible in Git history. Historical measurements are not current
release approval.

## Final implemented state

- Binary/ASCII STL preview before validation, explicit units, automatic routine
  cleanup, localized material-change proposals and exact original-file retention.
- Strict one-solid manifold, orientation, volume and intersection validation.
  Unsupported surfaces stay visible with grouped explanations.
- Separate lightweight preparation, heavy repair and surface workers. A worker's
  native heap is terminated before Gmsh starts; cancellation rejects late results.
- CGAL repair preserves unaffected exterior coordinates and facets. Small enclosed
  void filling remains an explicit material-change proposal. No whole-model wrap.
- Default analysis reconstructs exact planar regions where suitable; otherwise
  constrained triangle-surface remeshing supplies a discrete Gmsh volume boundary.
- Local thickness/curvature sizing, per-face area and volume checks, bidirectional
  sampled deviation and explicit mesh-quality warnings.
- Automatic planar-core / curved-region selection, optional connected split/merge,
  source-bound edits and stable untouched face identities. Existing assignments
  require transfer review; correction cancellation preserves the installed model.

## Known limits and ongoing problems

1. **Geometry does not determine engineering intent.** Face recognition is heuristic.
   It separates broad planes from finely tessellated fillets and keeps cylinder walls
   together, but does not recover arbitrary original CAD topology. Split partitions
   existing triangles into two connected regions; it cannot make arbitrary sketched
   surface cuts. Some downloaded/scanned objects still lack useful loading regions.
2. **Gargoyle meshes, but quality remains problematic.** Its 66,174 raw facets become
   61,448 valid repaired facets, with 57,030 original facets retained unchanged and
   identical exterior bounds. One tiny enclosed void is filled by proposal. The
   final coarse mesh has 144,736 boundary triangles / 613,123 Tet4 elements, 876
   gamma<0.1 elements, minimum gamma ~1.5e-6 and maximum edge ratio ~15,126. No
   inverted/near-zero-Jacobian elements were reported. No gargoyle solve, stress
   accuracy or convergence claim has been established.
3. **Performance headroom is limited.** Final measured gargoyle meshing: ~61 s
   Chromium 152 and ~113 s Firefox 153 on this machine, under a shared 120 s deadline.
   Slower devices or changed inputs can fail. Up to six complete surface attempts
   restart from source. A 500k-entry immutable sizing cache brought Firefox back
   within the deadline, at an observed surface WASM heap of ~207 MiB.
4. **Temporary triangulation can explode.** A 600-sided cylinder exposed skinny cap
   fans growing before collapse. Native intermediate facets are bounded at 600k;
   exported surfaces stay <=200k and heap <=512 MiB. This is bounded, not a proof
   that every admissible input fits the resource budget.
5. **Repair is intentionally incomplete.** The folded-cube intersection fixture
   previously accepted by wrapping is now blocked. Disconnected exterior bodies,
   unsupported intersection arrangements and excessive work are rejected. Never
   silently substitute a changed enclosing shape.
6. **Checks have defined scope.** Per-face areas/volume must stay within 1%; unique
   vertex, edge-midpoint and centroid distances are sampled in both directions.
   These are not Hausdorff or stress-error certificates. The 8³ local workload
   estimate is approximate; actual solver memory preflight remains necessary.
7. **Advanced paths still have limits.** Default meshing no longer needs charts;
   experimental parametrized remeshing and primitive reconstruction retain 512
   internal-surface limits. Selection groups are capped at 512, source/candidate
   files at 16 MiB and source/output facets at 200k. Manual corrections are capped
   at 64 operations. Original-surface mode can retain poor source triangles.
8. **Milestone/release acceptance is unfinished.** M29 owner acceptance, integrated
   review and exact-candidate release approval remain unclaimed. Historical resource
   records are not a fresh release-wide calibration.

## Dependency experiments and licensing

meshrepair + VCGlib were tested on the supplied gargoyle: minimal/print-ready left
1,800 intersection pairs; aggressive left 1,792. Success returned by those tools
was insufficient for our strict checks. This does not rule out a custom VCGlib
pipeline. Neither tested alternative supplied the hoped-for permissive-license exit.

The selected CGAL adapter is replaceable behind array ABIs (repair v2, surface v1).
Only native adapter files use CGAL types. CGAL 6.1.1 and Boost 1.83.0 archives are
SHA-256 pinned; exact constructions use MP_Float without GMP/MPFR. Build with pinned
Emscripten 3.1.74 via `python3 tools/build-stl-repair.py`; see the
[native guide](../native/stl-repair/README.md). The combined embedded module is
1,484,193 bytes / 482,670 gzip. Raw/gzip budgets are 2 MiB / 768 KiB.

First-party code is GPL-2.0-or-later; the CGAL-containing distribution is
GPL-3.0-or-later, with notices and exact corresponding source. Full CGAL/Boost
source archives add about 144 MiB to the source-accompanied folder, not runtime
network loading. Dependency authorization was conditional on bounded install size,
license compliance and replaceability. It was not publication authorization.

## Reproducing and resuming

1. Check out this branch. Read its README, spec section 6.1 and the linked review.
2. Run `python3 -m unittest discover -s tests`, the native FEM CTests and both native
   adapter tests documented in the native guide. Regenerate wrappers with
   `python3 tools/build-local-runtime.py`; the native build script fetches pinned
   inputs when its ignored cache is absent.
3. Run the standalone browser pages listed in README in file and HTTP modes.
   Start with `stl-workflow`, `stl-faces`, `stl-surface`, `stl-analysis`, numerical
   STL mesh/solve/convergence and the CAD corpus pages. Public procedural shapes
   exercise dense cylinders, rounded blocks, pressure resultants and support nodes.
4. The optional `stl-analysis-tests.html?fixture=gargoyle` uses the supplied
   `tests/fixtures/stl/cathedral_gargoyle.stl`. Supplied gargoyle/funnel fixtures are
   excluded from distributable source archives; inspect their provenance before
   redistribution. Ignored `build/` experiments and cached tools are not required
   product source and are not archived in Git; essential findings are recorded here
   and in the committed evidence.
5. Re-run distribution auditing and source-accompanied packaging. Do not reuse
   old artifact approval after changing a dependency or generated runtime.
6. Establish actual mesh-only mechanical-part demand and required face-editing
   workflows before expanding this subsystem. Benchmark representative CAD-exported
   STLs as well as difficult sculptures, and retain numerical acceptance gates.

Resume by updating this feature branch from the CAD-only main intentionally:
geometry/import contracts will diverge. Do not merge it wholesale into main merely
because the old tests pass. No backward compatibility is required for this alpha.
