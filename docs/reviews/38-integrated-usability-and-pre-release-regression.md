# Plan 38 — integrated regression and owner review packet

- Status: **Automated regression verified; owner walkthrough/acceptance pending.**
- Implementation: uncommitted `feature/bearing-moments-integrated-review` based
  on `bfc2b3e`, reviewed 2026-10-02–03. The owner requested implementation of
  36–38 and grouped walkthroughs afterward. No acceptance is inferred.
- Platform: Linux x86_64, headless Chromium **152.0.7977.75** and patched
  Playwright Firefox **153.0** feature automation, plus non-headless desktop
  Firefox **155.0.1** resource calibration. File-mode Firefox uses the documented test preference
  permitting local fixture reads; WebGL is enabled. Safari is unverified.
- App: [direct-local entry](../../web/index.html), or `python3 tools/serve.py`
  and `http://127.0.0.1:8000/web/` with cross-origin isolation.
- Packet: [full owner checklist](38-owner-walkthrough-checklist.md), four
  [portable projects and expected values](fixtures/36-38/expected-values.json),
  [bearing editor](evidence/38-bearing-hole.png) and
  [moment editor](evidence/38-torsion-shaft.png).
- Owner response/date: **Not yet received.** V1 remains unreleased; Task 20 follows acceptance.

## Current verification

The final solver runtime SHA-256 is
`ac3037522380eecb0ab0873768103f7ba5ee552fcaa9e9e901e2ae3f996db064`.
The source inventory includes the new native operators/tests. Generated workers
and embedded WASM are built through existing reproducible scripts, with no new
application dependency or vendor edit.

| Check | Current scope/result |
| --- | --- |
| Python | 79 tests pass, including independent bearing quadrature/reference validation and framework/source boundaries |
| Native CTest | 12 tests pass, including Tri3/Tri6 resultants, bearing orientation/refinement, pure moments, offset/reference invariance, preflight and additive C ABI |
| Chromium file | All 54 applicable browser harnesses pass; CAD/validation/resource benchmarks are additional separate runs |
| Chromium isolated HTTP | 10 focused feature/integration harnesses pass at 2× DPR |
| Firefox file | Eight focused bearing/moment/editor/project/local-support/report/worker/integration harnesses pass |
| CAD corpus | 50/50 expected classifications in fresh file and HTTP runs |
| Existing numerical matrix | Five analytical/CalculiX cases pass in both file and HTTP; normalized records validate |
| New numerical loads | Bearing: three Tet10 refinements and independent CalculiX; torsion: Tet4/Tet10 analytical displacement/shear and Tet10 refinement; offset beam: analytical displacement and reference/equivalent-wrench invariance |
| Resource remeasurement | 36 successful repetitions across Chromium file/HTTP and desktop Firefox 155 file; worst WASM/model ratio 0.991363; existing 1.5 safety multiplier/cap retained |
| Repeated workflow | Three asymmetric-bracket open → unit switch → mesh → solve → DOCX → cached reopen → recovery cycles in Chromium file/HTTP and Firefox |
| Presentation/accessibility | Four themes, keyboard pane resize, narrow/short windows and equivalent 125%/200% available sizes; HTTP 2× DPR and reduced-motion integration also pass |
| Failure contracts | Existing bounded underconstraint, stale/cap preflight, ≥8 GiB confirmation, storage denial, failed import, malformed cache and cancellation/retry harnesses pass; new malformed-load and degenerate-distribution regressions pass |

[Retained numerical/browser evidence and reproduction](../../benchmarks/validation/plans36-38/README.md)
includes browser versions, runtime identities, raw independent-solver output and
per-check status. The complete native/Python logs are retained in ignored
`build/plans36-38-native-final.log` and `build/plans36-38-python-final.log`.
Historical accepted reviews remain historical; these runs verify current changed paths.

## Section 26 coverage and remaining gates

| Requirement group | Current evidence | Acceptance boundary |
| --- | --- | --- |
| CAD formats, one solid, orientation, remeshing/face identity | 50-part corpus; CAD workflow, replacement, Tet4/Tet10 and authoring harnesses | Existing accepted scope; new cylindrical metadata tested on real split STEP |
| Solver, force balance, sparse PCG, Tet10, diagnosed failures | Native suite, five-case matrix, result/WASM/vertical-slice harnesses | Current numerical tolerances preserved |
| File/HTTP, local assets, workers, cancellation, preflight/cap/confirmation | Python source checks; worker/solve/convergence harnesses; file and HTTP matrices | Serial production path; optional threading remains deferred |
| Contours, deformation, peaks, FoS, convergence/singularity interpretation | Existing full browser suite plus real bearing refinement | M21–27 acceptance is historical; grouped current walkthrough supplied |
| Responsive UI, gizmo, display/legend, drafts, checks, undo | Full browser suite, 2× DPR, themes/size/keyboard and reduced-motion cycles | Actual physical zoom/display usability remains owner work |
| Material/units, projects/recovery, selection/volume, reports | Full suite and repeated local-frame bracket cycles | Plans 28–34 implemented; grouped owner review pending |
| Local frames/sliding supports | Native/WASM rotated constraints and current browser local-frame checks | Plan 35 implemented; owner walkthrough pending |
| Bearing and moment/offset loads | [36](36-bearing-loads.md), [37](37-moments-and-offset-forces.md), numerical/reference/native/worker/persistence/UI evidence and resource remeasurement | Implemented; owner walkthrough pending |
| Distribution rights/source accompaniment | Existing GPL decision, refreshed artifact audit and newly staged source-accompanied package | No new publication approval; final candidate approval belongs to Task 20 |
| M38 integrated acceptance and exact release identity | Runnable packet and current changed-path evidence | Both remain open; no release/tag/deployment performed |

The bracket has 4,563 nodes, maximum displacement **0.188667 mm**, and each of
three cycles retained **53 renderer geometries**, one recovery record and one
CAD source. Reports restore the camera and engineering revision; unit changes
preserve SI load definitions. Reopening validates the transformed CAD identity
against canonical source before accepting caches. Missing new-load diagnostics
cause explicit setup-only recovery. Discard releases the test recovery source.
These bounded observations do not measure a hardware-wide maximum process RSS.

## Resource and packaging scope

The fresh three-mode resource measurements are documented separately in
[resource calibration](../../benchmarks/resource/README.md). They retain each
measurement's runtime SHA and do not relabel earlier build phases as the final
runtime. The late source changes reserve exactly six doubles per new load and
validate/copy new surface inputs; the existing calibration cases contain no new
surface load, so their PCG kernel and allocation categories are unchanged; the final bounding-box fold
changes only the pass organization, with identical reported numerical values.
The retained boundary-only native measurement driver records ten integrations
after warmup over 128–2,048 Tri3/Tri6 faces and the 48-byte per-load result
category; its timings are scoped separately from browser calibration.
Task 20 still binds the complete matrix to the final accepted candidate.

Headless patched Firefox 153 hit the application's existing **600,000 ms**
limit on the largest mixed-scale case; an explicit **1,800,000 ms** diagnostic
retry also timed out. Its first two cases were about six times slower than desktop
Firefox and Chromium. Both attempts, including the retry's two successful rows,
are retained in `plans36-38-firefox-153-timeouts.json`; they do not count toward
resource acceptance. The resource matrix uses desktop Firefox 155, matching
the previously calibrated platform, at the normal **600,000 ms** limit. Production
defaults remain unchanged. This evidence does not claim that the large workload
passes in the patched headless Firefox 153 environment.

WASM and file-safe wrapper reproducibility and source-accompanied distribution
checks are recorded with the retained evidence. The local stage is
`build/plans38-distribution-stage`; the artifact and staged-source audits verify
actual file/source contents without requiring renewed publication approval. Staging is a local development
check and does not authorize publication or claim an approved final manifest.

## Review findings and limitations

The complete diff review corrected an incomplete native bearing band that
retained its wrench, a split-cylinder seam-rounding rejection, malformed-load
transfer losing its actionable error, and a missing per-load
result-buffer preflight category. Regression tests reproduced each issue before
the fixes. Native quadrature is streaming; resultants are integrated into the
existing RHS, and solver transfer includes only true new-load boundary connectivity.
Bounding-box collection shares the existing reaction/force pass; moment balance needs one
additional linear node pass with constant storage.
Loaded-half overlays share existing geometry buffers, detach before disposal and
refresh on visibility/display changes. No new surface stiffness, main-thread force
assembly, duplicated full-mesh result pass, or vendor modification is introduced.

Bearing targets require a backend-recognized full circular Cylinder band with
compatible axis/radius/extent. Unknown analytic backend types, partial/conical or
mixed bands and axial bearing force are rejected. Moment/offset traction is a
minimum-norm flexible transfer idealization. Contact, preload, friction, rigid
connectors and follower loads are outside the model. Local vector frames do not
change the explicitly global reference/application point coordinates.

Automation covers equivalent viewport sizes and 2× DPR; it does not certify
physical display readability or actual browser zoom. Headless timings are scoped
to these versions and this machine. The [owner checklist](38-owner-walkthrough-checklist.md)
records those remaining checks, ordinary/advanced workflows and severity-ranked
feedback. Correct any reported blockers before recording M38 acceptance, then
proceed to Task 20. Plans 39–46 remain planned.
