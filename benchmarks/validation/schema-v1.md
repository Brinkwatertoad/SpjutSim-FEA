# Validation record schema v1

Validation manifests define immutable SI benchmark inputs and stable probes.
Normalized records pair a SpjutSim Tet10 convergence study with one CalculiX
2.21 input deck and its original text output. `caseId`, `caseRevision`, and
`geometrySha256` bind a record to its manifest.

Every record contains:

- `units`: metres, newtons, pascals, and joules;
- `solver`: independent-solver version, hashes, element formulation, and the
  extraction method used for the compared value;
- `levels`: the SpjutSim mesh target, counts, displacement, strain energy, raw
  recovery stress, reactions, residual, and stable probe observations;
- `convergence`: the unmodified convergence-runner classification and deltas;
- `comparisons`: values, field identity, relative error, the applicable
  Section 16.2 limit, and the resulting boolean; and
- `passed`: true only when every comparison passes and at least two levels
  establish global convergence.

`converged-stress-unresolved` is an accepted global-convergence state only when
`globalConverged` is true and `stressStable` is false. It never claims that a
singular peak converged. Local-stress comparisons use an explicitly located,
nonsingular `raw-recovery-stress` probe; smoothed stresses are not admissible.

Run `python3 tools/validate-validation-records.py` to check the schema, hashes,
probes, finite values, provenance, convergence evidence, and tolerance limits.
