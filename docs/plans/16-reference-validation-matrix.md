# Task 16: Reference Validation Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible analytical and independent-solver evidence for every v1 benchmark class and enforce the numerical tolerances in `spec.md`.

**Architecture:** Keep benchmark definitions, solver provenance, raw reference outputs, and normalized comparison records separate. A dependency-free Python validator checks schemas, units, probe identities, convergence evidence, and tolerances; the browser harness produces SpjutSim records from the same case definitions without embedding release claims in UI code.

**Tech Stack:** JSON, Python standard library, CalculiX operator tooling, existing Gmsh/FEM workers, plain JavaScript browser harnesses.

**Spec:** `spec.md` Sections 8, 11.1–11.3, 11.7–11.8, 12, 13, 16.1–16.2, Milestones 3–4, and Section 26.

## Global constraints

- All stored engineering values use SI units and every probe is defined by stable geometry plus coordinates, not a viewport click.
- Independently generated reference data must name the solver, exact version, input deck, element formulation, mesh sequence, and extraction method.
- Apply the Section 16.2 limits: axial displacement/stress <= 1%, reaction balance <= 0.1%, converged cantilever displacement <= 3%, strain energy <= 3%, and nonsingular local stress <= 5%.
- Never tolerance-test a mathematically singular peak or compare a smoothed SpjutSim value with a raw reference value.
- CalculiX remains operator-only benchmark tooling; it is not an application or release runtime dependency.

---

## Starting point

Native Tet4/Tet10 patch and equilibrium tests pass, and
`benchmarks/validation/tet10-axial-convergence.json` records one analytical
Tet10 axial study. There is no versioned validation schema, no independent
solver input/output in the repository, and no complete cantilever,
pressure/symmetry, gravity, or nonsingular stress-concentration record.

## Implementation

- [x] **Define the benchmark record contract.** Add
  `benchmarks/validation/schema-v1.md`, case manifests under
  `benchmarks/validation/cases/`, and a normalized result shape containing case
  revision, geometry hash, material/load/support values, mesh level, raw and
  smoothed field identity, probe coordinates, reactions, strain energy,
  convergence deltas, solver provenance, tolerances, and pass/fail details.
  Migrate the existing axial record without changing its measured values.
- [x] **Add dependency-free record validation.** Create
  `tools/validate-validation-records.py` and `tests/test_validation_records.py`.
  Reject non-finite values, missing SI units, unknown case revisions, probe or
  field mismatches, unverifiable external-solver provenance, limits looser than
  Section 16.2, and a passing claim without the required converged levels.
- [x] **Commit reproducible independent-solver inputs.** Add small CalculiX
  decks and extraction instructions under `benchmarks/reference/calculix/` for
  an axial prism, slender cantilever, uniformly pressured cube, gravity-loaded
  cube, and an extruded notched plate. Pin the
  CalculiX version used and store original text outputs beside normalized JSON;
  identify all nonsingular probes by coordinates and geometric feature.
- [x] **Run the matching SpjutSim studies.** Add
  `tests/browser/validation-benchmark-tests.{html,js}` to load the case
  manifests, execute deterministic Tet10 refinement through disposable workers,
  and export normalized records. Capture displacement probes, reactions,
  strain energy, raw recovery-sample stress, and convergence status for each
  case while keeping full result buffers only for the active level.
- [x] **Evaluate every acceptance limit.** Compare axial displacement and
  stress with closed form and external results; cantilever displacement with
  beam theory and CalculiX; pressure and gravity cases with symmetry,
  equilibrium, energy, and reference results; and the notched-plate probe with
  the independent nonsingular stress. Record explicit reasons for any failure
  rather than weakening a tolerance or selecting a more favorable field.
- [x] **Publish the evidence index.** Expand `benchmarks/README.md` with one row
  per case, exact reproduction commands, hashes of external inputs/raw outputs,
  measured errors, and links to normalized records. Update
  `docs/release/v1-acceptance-audit.md` only after the validator and complete
  matrix pass.

## Verification

- Run `python3 -m unittest discover -s tests` and
  `python3 tools/validate-validation-records.py`.
- Configure/build/CTest with the README commands, then run the validation
  browser harness in the same Chromium `file://` and optional HTTP modes used
  by the production workflow.
- Regenerate every normalized record twice and require byte-identical case
  identity/provenance plus numerically tolerance-equivalent results.
- Inspect every comparison to confirm raw/smoothed field parity and that no
  singular location carries a fixed pass tolerance.

## Done when

All five benchmark classes have reproducible analytical and independent-solver
evidence, the committed validator enforces the specified limits, every result
passes without relaxed tolerances, and the analytical/reference-validation row
in the v1 acceptance audit can truthfully change to Pass.
