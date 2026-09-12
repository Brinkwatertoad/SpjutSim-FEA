# Experimental funnel surface remeshing

Follow-up on `feat/28-29-stl-import`, 2026-09-11. The owner asked to try an
alternative for larger STL files while keeping the current methods intact.

## What is implemented

The new **Remesh STL surfaces (experimental)** option creates parametrized
discrete surfaces and regenerates the surface and volume mesh. A selection group
can own several surfaces. On the supplied funnel, 17 groups own 30 surfaces at a
40-degree remesh feature angle. All source triangles are accounted for before
parametrization, and all selection groups survive fresh-worker meshing.

This is a working remeshing alternative, **not** general smooth CAD reconstruction.
The source-reference geometry stays faceted; the finite-element boundary
approximates it. Existing original-triangle and bounded primitive-reconstruction
modes remain available. The new mode does not advertise a CAD deviation bound or
silently fall back between methods. General shared-boundary spline fitting is
still unimplemented.

## Reproduce

Place the owner-supplied funnel in `tests/fixtures/stl/`; it remains untracked and
is not part of the redistributable fixture corpus. In the application, import it
with millimeter units, select experimental remeshing, keep the selection angle
at 40 degrees, and set the **remesh feature angle to 40 degrees**. Review/apply
the source and map any existing assignments explicitly. Generate a mesh normally.

The default remesh feature angle is 5 degrees to retain more creases. That setting
passes the numerical cylinder checks, but this funnel's additional tiny surface
charts produce intersecting curve meshes and no usable volume. The application
reports the failed mesh; it does not automatically broaden the feature angle.

The optional browser diagnostic is
`tests/browser/funnel-solve-tests.html?surfaceMode=remesh`, with
`&preset=normal` or `&preset=fine` for refinement. It fixes all displacement
components on the lowest-z patch and applies 1 MPa pressure to the highest-z
patch, with ABS (E = 2.4 GPa, Poisson ratio 0.37). The owner's original exact face
choices are unknown, so these are not identical reproductions of the reported
30-minute solve.

## Measured results

[Compact numerical evidence](../../benchmarks/stl-remeshing/funnel-chromium-152.json)
records direct-file Chromium 152 runs using Gmsh 5.0.0 and the unchanged solver.
Times vary with machine load. Meshing includes restoring the parametrization;
solver time is the PCG stage rather than import, assembly or stress recovery.

| Mesh | Nodes | Meshing | Solving | Volume error vs STL | Max displacement | Raw peak von Mises |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Coarse | 5,911 | 25.4 s | 2.76 s | 1.40% | 11.03 µm | 0.997 MPa |
| Normal | 13,095 | 87.7 s | 9.71 s | 0.636% | 9.961 µm | 0.831 MPa |
| Fine | 39,610 | 118.9 s | 42.4 s | 0.122% | 9.695 µm | 0.889 MPa |

All three solves reached residual ≤1e-8 and passed the 1e-6 equilibrium gate.
The original-triangle reproduction had 99,232 nodes, 50,964 Tet10 elements,
minimum gamma about 1.52e-9 and 14,738 poor elements. The experimental coarse
mesh has minimum gamma about 5.56e-5 and 339 poor elements; it is improved but
still carries the low-quality warning.

These results do **not** establish stress accuracy. Normal-to-fine peak stress
changes by about 7%; displacement changes by about 2.7%. The pressure patch's
source area is 17.7824 mm². At 1 MPa the source resultant is 17.7824 N, while the
coarse/normal/fine meshes apply approximately 19.3765 / 18.0766 / 17.8313 N.
Thus coarse boundary approximation changes the actual pressure resultant by
about 9%, despite a small global volume error. Refinement reduces this error to
about 0.275% on fine. Force balance checks equilibrium against each discretized
load; it does not certify fidelity to the source surface.

The application now records source/remeshed areas for every patch and warns when
any patch area changes by more than 1%. The timing/refinement table above was
captured before that reporting addition; meshing and numerical settings are
unchanged. The warning is propagated into solver preflight diagnostics.
The fresh coarse warning trial flagged patch 17 at 38.1% area change; that is a
different patch from the pressure cap above. This is another reason that global
volume agreement cannot establish fidelity of every small feature.

The fine meshing run is close to the existing 120-second per-operation limit.
A slower machine can time out. No operation, convergence or validity limit was
weakened to accept these results.

## Rejected probes

- Raising the number of nodes on each discrete curve did not reliably repair
  difficult surface-chart boundaries; the trial produced no usable volume.
- Projecting quadratic edge nodes onto the parametrized funnel produced inverted
  elements. The normal Jacobian gate rejected them.
- High-order optimization of that projected mesh exceeded the 120-second limit.

These variants stay in ignored diagnostic files; none is enabled in the app.
The installed experimental route uses straight quadratic edges, explicit feature
angle choice, fresh boundary meshing and the existing numerical validity gates.

## Verification scope

`stl-remesh-tests.html` covers dense planar input, holes, multiple surfaces per
selection, feature-angle identity, corrupted reports, stale assignment rejection
and cancellation. `stl-workflow-tests.html` exercises the actual review controls.
`stl-mesh-solve-tests.html?surfaceMode=remesh` retains the existing strict cube
and 16/32/64-sided-cylinder numerical checks at a 5-degree feature angle.
The optional funnel diagnostic separates convergence evidence from geometric
and refinement evidence. Source bytes remain untouched.

Final verification: 79 Python tests, 8 native tests, 41 direct-file browser
configurations (including the 68-case CAD/STL corpus and the optional coarse
funnel solve), and 4 HTTP browser configurations passed. The normal/fine funnel
refinement trials also passed their convergence checks. Distribution artifact
hashes and the complete diff were checked; no owner acceptance or release is
implied by these checks.
