# Funnel solve investigation

Follow-up on `feat/28-29-stl-import`, 2026-09-11. The owner reported ABS,
one fixed face and 1 MPa pressure on another, stuck at “Solving the sparse
system…”. Exact faces were not identified. The reproduction assumes millimeters,
fixes all displacement components on the bottommost patch and applies pressure
to the topmost patch, using coarse Tet10 and original-triangle import.

## Findings

The 17 selectable patches are triangle groups, not reconstructed geometry.
Original mode retains all 31,426 STL triangles and creates 50,964 Tet10 elements,
99,232 nodes and 297,696 displacement DOFs. Of these elements, 14,738 trigger the
gamma quality warning. The minimum corner edge is 4e-8 m; minimum gamma is
approximately 1.52e-9. This mesh passes the local Jacobian validity check but is
severely ill-conditioned in the measured solve.

The worker previously posted assembly, constraints and solve status immediately
before one synchronous native call containing all three stages. Native assembly
takes about one second here; the remaining delay is PCG iteration. The previous
automatic budget permitted 2,976,960 iterations, without iteration progress.

With an explicit two-minute trial budget, ABS (2.4 GPa, Poisson ratio 0.37) and
1 MPa pressure, the production Jacobi
solver reached a relative residual of 9.80361 after 6,752 iterations and
120,007.5 ms of PCG time (121,006 ms including assembly). The target is 1e-8.
The exact count and time depend on the machine and other running work.

The owner subsequently confirmed that the original run **did converge**:
100,359 iterations, relative residual 9.546e-9, force-balance residual 3.311e-11,
and 1.779e6 ms (29.65 minutes). That mesh had 99,998 nodes / 51,758 Tet10 elements
and reported 0.3181 GiB WASM memory with low-gamma warnings. It is slightly
different from the coarse reproduction above. These are owner-reported results,
not a rerun of the exact supports/loads. The issue is slow convergence; the
short diagnostic does not establish that the funnel cannot converge given time.

Throwaway first-party shifted IC(0) trials did not establish a solution. In
natural ordering, shifts 0.001 and 0.1 encountered nonpositive pivots; shift 0.2
reached residual 2.60983 after 2,000 iterations in about 84 seconds. Reverse
Cuthill–McKee node ordering still needed shift 0.2 and reached residual 4.00752
after 1,000 iterations in about 42 seconds. These experiments are not shipped.

## Implemented response

- The import option reads **Keep STL triangles (no simplification)**. Help and
  review status distinguish selection grouping from geometry reconstruction and
  explain that the current reconstruction path does not mix recovered surfaces
  with retained original triangles.
- Native progress now drives actual assembly/solve/recovery transitions.
  Iteration count, residual, tolerance and elapsed time are reported at controlled
  intervals while WASM is running. Progress-only UI notifications avoid rebuilding
  geometry overlays or authoring panels, including during convergence studies.
  Cancellation still terminates the worker.
- PCG stops at a configurable elapsed-time budget checked between iterations.
  The default is ten minutes; the Checks panel offers 1–60 minutes per analysis.
  The existing automatic iteration allowance is preserved: a universal two-minute
  or 10,000-iteration cap rejects the accepted mixed-scale 150k-node case, which
  takes about eight minutes and 17,188 iterations. Budget exhaustion
  reports `SOLVER_NOT_CONVERGED`, with termination reason and diagnostics, and
  produces no accepted result. Convergence still requires the true residual and
  the existing equilibrium checks.
- Only first-party FEM runtime and worker packaging were rebuilt. No numerical
  dependency, Gmsh runtime or fixture redistribution was added.

## Reproduction and remaining work

The optional `tests/browser/funnel-solve-tests.html` harness uses the local owner
fixture, reports live progress, and checks bounded nonconvergence without stress
recovery. It is separate from the redistributed CAD/STL corpus. Native tests
cover time exhaustion, explicit iteration exhaustion and verified progress;
the browser WASM test covers budget failure followed by a successful retry.

Handoff verification: 79 Python tests, all eight native CTest executables, all
36 standard browser harnesses (including 68/68 CAD/STL corpus cases), the optional
two-minute funnel diagnostic, and HTTP worker/WASM checks passed. The complete
diff and distribution artifact hashes were reviewed. The user fixture remains
untracked and unmodified.

All four existing resource cases passed one fresh headless Chromium 152 `file://`
repetition with the rebuilt runtime and default budget: axial 725 iterations /
4.22 s wall time; cantilever 4,314 / 55.65 s; mixed-scale 150k-node case 17,188 /
465.35 s; poor-quality Tet4 6,638 / 14.18 s. Iteration counts match the prior
calibration and every residual remains below 1e-8. This is a regression check,
not a replacement for the recorded multi-browser release calibration.

Extra interior optimization was also probed with the bundled Gmsh default and
Netgen optimizers. A second default pass reduced poor elements from 14,738 to
13,966, but left minimum gamma (1.52e-9) and maximum edge ratio (65,269) unchanged.
Netgen improved the fifth-percentile gamma to 0.00338 while the worst gamma
remained about 2e-9. Neither short solve trial established a useful speedup.
The original-STL path uses discrete surfaces inside a normal GEO volume, so
Gmsh's default volume optimizer already runs. These probes do not justify
silently adding extra meshing time or changing the retained source boundary.

This change resolves misleading progress and gives control over elapsed time;
it does not yet accelerate the owner's 100,359-iteration solve. A useful next
geometry capability is tolerance-controlled surface
remeshing/simplification that removes slivers while checking deviation, topology,
sharp features and source-to-face mapping. Original mode must continue preserving
source facets. The existing primitive reconstruction cannot reconstruct four of
the funnel's 17 regions, so selecting it is not a current workaround for this
part. Any new remeshing or stronger solver path needs independent numerical
validation before claiming a faster, accurate funnel result.
