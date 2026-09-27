# Usability priorities

Status: Implemented and automatically verified; owner walkthrough pending.

Working tree based on `a57b30e`, 2026-09-26.

Authorized sequence: three priorities, then remaining review improvements,
then resume Plan 36 onward. The owner selected the cantilever beam example.

Implementation:

- Primary results show displacement, unaveraged stress and yield FoS with
  adjacent interpretation and direct actions. Secondary values are expandable;
  solver warnings remain visible. Numerical arrays and acceptance criteria are
  unchanged.
- Engineering edits keep a visible results-cleared reminder through subsequent
  edits and Undo/Redo. It identifies whether another mesh is needed and stays
  visible with both side panes closed. Initial authoring and renames do not
  falsely announce invalidation. Save guidance distinguishes local recovery
  from downloaded files.
- A reproducibly generated 200 × 20 × 10 mm cantilever adds fixed-end support,
  a 20 N downward tip load, illustrative steel and a 4–5 mm Tet10 mesh. The
  original setup's beam-theory tip displacement is 0.16 mm. Guidance and report
  notes explain mesh convergence and fixed-end stress concentrations. No yield
  strength is assumed. The cube remains available.

Verification:

- Chromium 152.0.7977.75: all 47 applicable browser harnesses passed under
  direct `file://` with local-file access, including CAD, real worker solves,
  project/recovery, reports, units, selection and layout. The unchanged CAD
  corpus, resource matrix and full validation-matrix benchmark runs were not
  repeated for this UI/example change.
- The priority workflow, result presentation, immediate editing and workspace
  layout also passed under isolated HTTP at 2× device scale.
- The cantilever mesh has 4,038 nodes and 2,056 Tet10 elements. Mean tip Z
  displacement is −0.159008606 mm versus −0.16 mm beam theory (0.62% error,
  within the explicit 3% acceptance limit). Reaction Z is 19.999999976 N;
  equilibrium relative residual is 2.63e−11. This check validates displacement
  and equilibrium, not the mesh-sensitive fixed-end peak stress.
- All 77 Python tests and all 10 freshly built native CTest tests passed.
- Distribution audit, reproducible example generation and `git diff --check`
  passed. No native kernels, worker protocols or vendor files changed.
- Inspected opening, solved/deformed beam and edit feedback at 1440 × 900 and
  850 × 600. Local screenshots and detailed run logs are under ignored
  `build/usability-*` paths.
- Reviewed the complete diff for numerical meanings, state ownership,
  invalidation/Undo, accessible actions, layout, memory and reproducibility.
  Feedback stores no result/mesh buffers; result presentation leaves SI data
  unchanged.

Owner walkthrough:

1. Open `web/index.html`, start a new project if recovery reopens another part,
   and choose Open Cantilever Example. Generate/inspect the mesh and Solve, or
   use the explicit Mesh and solve button.
2. Review the three primary results. View deformation uses Auto scaling; mean
   tip displacement should be near 0.159 mm. Review convergence opens its tab.
   Review material opens the optional strength field without changing results.
3. Change the end load. The persistent notice identifies the cleared results
   and asks for another solve. Undo restores the load but retains that reminder;
   a successful new solve clears it. Changing mesh settings asks for Mesh and
   solve. The notice remains visible when both side panes are closed.
4. Save project explains the difference between a downloaded file and browser
   recovery. Numerical details remain expandable; warnings remain visible.

The next authorized pass covers convergence-chart clarity, targeted readability
and browser-suite automation/documentation, then development resumes at Plan 36.
Owner acceptance has not been recorded.

## Follow-up: example orientation

The owner requested +90° about X for the complete cantilever example. The existing
geometry orientation path now rotates the example before authoring its support
and load. The fully fixed end remains on X-min; the 20 N load rotates from −Z to
+Y, preserving bending about the original weak axis. Global dimensions become
200 × 10 × 20 mm. Guide/report notes follow the rotated setup. Existing saved
projects retain their authored orientation.

The updated real-worker workflow verifies bounds, rotation sense, force direction,
mean tip displacement +0.159008606 mm (0.62% from theory), reaction Y
−19.999999952 N and force-balance residual 3.16e−11. The usability-priorities,
contextual-workflow, project-cad and project-resume browser suites pass under
direct `file://`. Inspected the solved view; `git diff --check` passes.

An additional three-mesh experiment recorded these results in ignored
`build/beam-rotation-evidence.json`:

| Target size (mm) | Max displacement (mm) | Raw peak (MPa) | Smoothed peak (MPa) |
| --- | --- | --- | --- |
| 5 | 0.159124 | 10.680 | 9.894 |
| 3.5 | 0.159234 | 11.160 | 10.281 |
| 2.45 | 0.159302 | 12.144 | 11.000 |

Peak locations approach edges of the fixed end. This is consistent with clamp
sensitivity, but three meshes alone do not establish an unbounded singularity.
No stress recovery or smoothing behavior was changed.
