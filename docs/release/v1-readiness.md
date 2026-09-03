# v1.0 readiness evidence

Status: **not ready for public distribution**.

The production Tet10 `file://` vertical slice and a deterministic two-level
axial convergence study pass in Chromium 151. Native kernel, equilibrium,
failure, and C-ABI tests pass. Reproducible records are under `benchmarks/`.

Remaining release gates:

- Run and record the supported non-headless browser/resource matrix at larger
  representative sizes, including external process peak memory.
- Add independent reference-solver records for bending, pressure/symmetry, and
  a nonsingular stress concentration; current native analytical tests are not
  substitutes for every reference case in spec section 16.
- Expand the CAD corpus beyond the generated cube/cylinder/sphere, malformed
  input, and multi-solid fixtures.
- Resolve redistribution rights. The checked-in Gmsh/GMSH-JS payload is GPL;
  the repository root currently grants no redistribution permission. Public
  release therefore requires either a compatible project license approved by
  the copyright holder or a suitable commercial Gmsh license.

No unchecked gate in `spec.md` section 26 should be interpreted as passing.
