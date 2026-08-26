# Task 9: Implement the trusted Tet4 solver and preflight model

## Outcome

Implement and validate the first-party native Tet4 linear-elastic solver plus
the topology and memory calculations needed to decide whether a solve is safe
before allocating the global matrix.

## Implementation

- Implement Tet4 geometry/Jacobian checks, constant-strain `B` matrices,
  isotropic constitutive response, element stiffness, consistent pressure and
  total-face-force integration, body force, and fixed/prescribed constraints.
  Keep strain/shear conventions and numerical tolerances explicit.
- Build a deterministic 32-bit scalar-CSR sparsity graph directly from mesh
  connectivity, with stable assembly lookup and no giant triplet allocation.
  Count adjacency edges and exact nonzeros before allocating matrix values.
- Implement symmetric constraint application, Jacobi-preconditioned PCG,
  relative residual convergence, iteration limits, cancellation checkpoints at
  coarse boundaries, and stable diagnostics for non-finite/non-SPD/stagnant
  solves rather than returning plausible-looking output.
- Recover displacement vectors/magnitudes, constant Tet4 strain/stress, von
  Mises and principal stresses, reactions, total reactions, strain energy, and
  force-balance residual. Preserve raw element extrema separately from any
  surface-smoothed visualization values.
- Define the narrow C API and versioned result/error structures used by native
  tests and later WASM. Reject invalid sizes, indices, unsupported element
  types, underconstraints detected pre-solve, and equilibrium failures.
- Add a versioned peak-memory estimator using the same graph/allocation counts
  as the solver. Report DOFs, adjacency edges, exact `nnz`, modeled allocations,
  safety multiplier, WASM cap, device-memory hint classification, and the
  explicit 8 GiB confirmation state without claiming certainty.

## Verification

- Add element patch tests for rigid motion, constant strain/stress, symmetry,
  positive energy, pressure/force conservation, prescribed displacement, and
  reaction equilibrium with justified tolerances.
- Add native end-to-end axial bar/cube benchmarks for displacement and stress,
  singular/underconstrained cases, malformed meshes, nonconvergence, and
  deterministic repeated results. Meet the initial analytical acceptance
  targets from `spec.md`.
- Cross-check estimator byte categories against actual native allocations and
  add graph-size cases that detect 32-bit overflow before allocation.

## Done when

Native tests demonstrate a numerically correct Tet4 solve and diagnostic
failure behavior, and preflight can classify a mesh from exact topology counts
before any large stiffness allocation occurs.
