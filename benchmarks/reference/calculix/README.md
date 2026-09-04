# CalculiX 2.21 reference runs

These operator-only references were generated with the Ubuntu 24.04
`calculix-ccx` 2.21-1 package (CalculiX CrunchiX 2.21, single-process Spooles
direct solver). CalculiX is GPL-2.0-or-later and is not part of the SpjutSim
browser runtime.

Regenerate the deterministic C3D8 decks from the repository root:

```sh
python3 tools/generate-calculix-reference.py benchmarks/reference/calculix
```

Run each case with `ccx case` from its case directory. For example:

```sh
cd benchmarks/reference/calculix/axial-traction
ccx case
```

The committed `case.dat` is the original text output. Normalized records retain
SHA-256 hashes of both `case.inp` and `case.dat`. Displacements are extracted
from the `XMAX` node print, reactions from the printed constrained-node totals,
and stresses from all integration points in the one-element `PROBE` set. The
notch comparison uses the integration point nearest `[1.5, 0.5, 0.1]` m and
computes von Mises stress directly from the six raw components. For gravity,
the printed bottom reaction is augmented by the exactly integrated body load
on bottom constrained nodes; this accounts for CalculiX reporting applied nodal
body loads at constrained nodes separately from reaction force.

The cantilever uses a 64 x 4 x 8 mesh, the notch study uses a 60 x 20 x 4 mesh,
and the simple cubes use 8 elements per axis. These meshes are independent of
the tetrahedral Gmsh meshes used by SpjutSim.
