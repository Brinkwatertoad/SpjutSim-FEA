# Mesh checks and Settings

Owner-directed follow-up to the usability priorities, 2026-09-26.

- Offer one finer-mesh comparison from the displayed result, with optional
  automatic execution after a normal solve. Automatic checking defaults off
  and is a browser preference in Settings → Analysis.
- Show actual displacement/energy/stress changes against the existing 2%/2%/5%
  screening defaults. A quick check is not an error bound or a design verdict.
  Keep failed, cancelled and resource-limited checks actionable without discarding
  the last completed result. Repeated checks refine from that result.
- State von Mises yielding and the governing strength's type and value beside
  yield FoS. Required FoS and displacement limits remain design inputs supplied
  by the engineer; no universal acceptance limit is invented.
- Move report title, notes and image choices into Settings → Report. The toolbar
  shortcut opens the tab. Choices remain project metadata and do not invalidate
  results. Restore defaults applies immediately.
- Correct saved convergence classification to use its recorded settings and
  stop reason. Ignore callbacks from a cancelled check after another has begun.

Threshold rationale: these are application screening choices, not prescribed
standards. [COMSOL's mesh refinement guidance](https://www.comsol.com/multiphysics/mesh-refinement)
explains quantity-specific convergence and the value of at least three successive
solutions for a trend. Its [singularity guidance](https://www.comsol.com/support/knowledgebase/1261)
explains why local peaks may not converge. [SOLIDWORKS' failure-criteria reference](https://help.solidworks.com/2026/English/SolidWorks/cworks/r_Summary_of_Failure_Criteria.htm)
describes von Mises yield criteria for ductile materials; an acceptable design FoS
is a separate requirement.

The existing project-cache restriction remains: convergence results belong to
their refined mesh, while the ordinary mesh is retained. Save CAD/setup normally;
including mesh/results requires solving the ordinary mesh again. The UI explains
this if a derived-cache save is attempted. This follow-up does not change the
project format or retain multiple volume meshes.

Verification:

- All 48 applicable browser harnesses passed in Chromium 152 under direct
  `file://` after the final changes. The unchanged CAD corpus, resource matrix
  and validation benchmark were not repeated. Log: ignored
  `build/mesh-check-browser-full.log`.
- The mesh-check and report workflows also passed under isolated HTTP at 2×
  device scale. Layout passed there as well. Tests cover one extra solve,
  repeat refinement, automatic execution without recursion, preference reload
  and storage failure, cancellation/restart, memory guards, stale baselines,
  saved-study thresholds, Report metadata and numerical report context.
- All 77 Python tests and 10 native CTest tests passed. Distribution audit and
  `git diff --check` passed. No numerical kernels or worker protocols changed.
- Inspected Results and both Settings tabs, including 850 × 600. Verified
  keyboard tab order, focus restoration and committing report title on Escape.
  Screenshots: ignored `build/mesh-check-*.png`.
- Reviewed the complete diff for state ownership, cancellation races, numerical
  meaning, memory retention, keyboard access, project/report behavior and scope.

The remaining authorized usability pass and Plan 36 onward remain in
`docs/plans/README.md`.
