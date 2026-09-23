# Plans 30–34 implementation verification

Date: 2026-09-22. Branch: `features/project-workflow-30-34`, based on `23a1f1e`.
Evidence applies to the working tree, not a committed release artifact. Existing
owner documentation changes (plan renumbering and post-v1 plans) were preserved.
No release, merge or publication is authorized by this record.

## Scope and result

Portable CAD/setup files and opt-in caches, local recovery, contextual advanced
controls/editing/onboarding, volume/mass and viewport face access, and optional
report customization are implemented. The single workspace, toolbar arrangement,
Tet10 default, Stress/Deformation interaction and plain offline browser stack are
preserved. Practical load/support extensions remain Plans 35–37; advanced studies
remain Plans 39–46. Owner acceptance of this batch is **pending**.

## Automated evidence

Environment: Linux, Google Chrome for Testing 151.0.7922.34, headless Playwright
installed only under ignored build tooling. No runtime application dependency was
added. First-party native kernels, vendored assets and worker/WASM packaging were
not changed.

- All 41 applicable browser harnesses pass using direct `file://` access. Coverage
  includes the eight new project/recovery/contextual/info/face harnesses plus
  existing CAD import, drafts/history, units, workspace, worker, Tet4/Tet10,
  solver, convergence, result, report and numerical benchmark regressions.
- Focused HTTP checks at 2× device pixel ratio cover project codec, actual CAD,
  interface, recovery, face access, solved report workflow and workspace layout.
- Python unittest suite: 77 tests passed. Native CMake/CTest: 8 tests passed.
- Independent Python project inspection validates stored ZIP/CRC, source SHA-256
  and typed-array lengths/hashes. The actual solved cube package contains 33
  binary arrays, totaling 3,379,508 bytes, plus 3,023 source bytes. Independent DOCX
  inspection passes with five default scene captures.
- Four themes × three effective CSS viewport sizes (100%/125%/200% equivalents),
  at 2× DPI with reduced motion: 12 cases without page overflow. These are
  viewport equivalents, not physical browser zoom or manual assistive testing.

Reproducible browser entry points and build commands are listed in README. Local
run records are `build/plans30-34-browser-final.json`,
`build/plans30-34-browser-final.log`, `build/plans30-34-http.log`,
`build/plans30-34-visual.json`, `build/plans30-34-python.log` and
`build/plans30-34-native.log`. Memory samples are in
`build/plans30-34-memory.json`. They are ignored artifacts, not required source.

The full 50-model CAD corpus and broad resource/platform benchmark were not
repeated: importer/solver kernels and packaged workers are unchanged. Actual
STEP/IGES/BREP project round trips, cylinder and through-hole fixtures, the
analytical post-reopen solve and ordinary validation benchmark were run. Full
cross-platform/resource and exact-artifact acceptance remain Plans 38/20.

## Performance and allocation evidence

A measured file-mode run saved setup-only STEP/IGES/BREP cube files in 1.2/1.0/0.7 ms;
source sizes were 3,023/12,394/2,516 bytes, packages 5,191/14,721/4,840 bytes.
These small-fixture timings are observations, not large-model performance claims.
Cylinder (5,944 triangles) and through-hole (7,128 triangles) previews each ran
100 distinct-face ray picks in 25.6/28.7 ms in that run. No full geometry copies
are made per pointer event. Visibility changes update existing material groups.

Real IndexedDB tests retain four records sharing one source, coalesce an edit
burst into one write, reject stale ownership generations, and roll back an
injected failure after queuing a source write. Numerical buffers are absent from
recovery snapshots. Small synthetic source bytes prove transaction/dedup behavior;
large-source storage throughput has not been benchmarked.

The bounded project reader slices Blobs, validates aggregate array allocations,
and disposes the CAD worker before cache decoding. Shared ZIP writing retains
Blob/image parts rather than redundant pixel byte arrays. The old project remains
resident until atomic replacement. Allocation bounds and browser-copy caveats are
in [the format document](../project-format.md). Fresh browser processes were sampled every 100 ms during two complete cube
workflows (1500×1000 CSS viewport, 1× DPI). Summed RSS across the browser and all
its descendants peaked at 1,611,423,744 bytes for setup save/open (791,887,872-byte
blank-page baseline) and 1,674,768,384 bytes for the solved/default-and-customized
report plus optional-cache workflow (796,196,864-byte baseline). These include
browser, GPU, renderer, CAD/solver work and shared-page double counting; they are
not isolated codec heap measurements. Sampling can miss short-lived peaks.
Process peak memory at maximum archive/cache limits remains unmeasured; Plan 38
must retain large-model stress checks. No maximum-size memory pass is claimed.

## Review and remaining owner checks

Complete changed-source review includes persistence/worker boundaries, assignment
invalidation, recovery transactions, optional-cache compatibility, keyboard/dialog
handling and report restoration. Concrete review fixes have regression coverage:
editing suppressed definitions preserves suppression; prescribed-displacement-only
setups can request Mesh and solve; incompatible cached result/mesh pairs are
rejected; export cancellation restores presentation.

Use each Plan 30–34 owner walkthrough with an actual bracket/curved part. Remaining
manual checks include natural discovery of options, novice first use, real browser
zoom and keyboard/screen-reader behavior, larger CAD responsiveness, and visual
inspection of editable DOCX in the owner's Office viewer. Automated screenshots
and XML inspection do not substitute for those responses. No owner response has
been recorded for this implementation.


## Owner-requested workflow revision, 2026-09-22

The owner approved automatic reopen, File → New without a shortcut, Ctrl/Cmd+O/S,
no unload warning, a remembered dismissible guide, a prepared cube example and
shared options icons. This supersedes the original explicit-recovery picker and
global advanced-control disclosure design. Approval is of the design; a final
visual owner walkthrough is still pending.

- `project-resume-tests.html` drives the real app through the prepared example,
  verifies 1 kPa axial stress (±0.2 Pa) and −1,000 N reaction (±0.001 N), exercises
  shortcuts and direct mesh options, dismisses the guide, reloads automatically,
  verifies record reuse, reenables the guide through Help, and checks New followed
  by another reload remains empty. It also checks the placeholder cube is absent,
  the mesh icon is contained by its row, and New closes the File menu.
- Recovery tests cover active-tab Web Lock conflicts, closed-session adoption,
  remembered empty state, bounded retirement of inactive copies, and rollback
  that retains all old snapshots when the replacement transaction fails.
- Current verification: 42 applicable direct-file browser harnesses, 77 Python
  tests and 8 native tests pass. Focused HTTP/2× DPI checks cover the revised flow,
  recovery, projects, real CAD and reports. Records: `build/revision-browser.json`,
  `build/revision-http.log`, `build/revision-python.log`, `build/revision-native.log`.
- The shared UI Kit icon catalog is now selectively adopted and pinned in
  `UI_FOUNDATION.md` and the artifact manifest. Its generator check passes. This
  supersedes the earlier statement that no UI foundation assets changed; native
  kernels and packaged workers remain unchanged. No release audit is claimed.

Recovery persists committed state promptly, but cannot guarantee the last edit
survives a crash during a write or unavailable/cleared browser storage. No unload
prompt is used. Mesh/results and unapplied drafts remain outside automatic recovery.
