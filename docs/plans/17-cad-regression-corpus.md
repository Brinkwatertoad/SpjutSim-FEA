# Task 17: Release CAD Regression Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the small generated-fixture set into a fixed, licensed, machine-audited CAD corpus that demonstrates supported import, topology mapping, remeshing, and useful failure classification.

**Architecture:** A versioned manifest owns fixture provenance and expected outcomes. A dedicated browser runner imports each file in a fresh disposable mesher worker, applies the declared mesh presets, and emits a compact report that a Python audit compares with bounded expectations rather than brittle exact tessellation counts.

**Tech Stack:** STEP/IGES/OpenCASCADE BREP fixtures, JSON, Python standard library, existing Gmsh worker/client, static browser tests.

**Spec:** `spec.md` Sections 3.1, 5.1, 6, 7, 16.3, Milestone 1, Sections 21–23, and Section 26.

## Global constraints

- Include only fixtures with documented redistribution permission and a SHA-256 digest; do not commit customer or private CAD.
- Valid corpus entries must contain exactly one usable closed solid in the supported v1 subset; intentional invalid/multi-solid entries must name the expected stable error code.
- Preserve SI normalization and stable CAD `FaceId` behavior across remeshing; downstream tests never depend on Gmsh wrapper objects.
- Expected mesh counts are inclusive ranges recorded per pinned runtime, not exact counts that reject harmless ordering differences.
- Run each case in a fresh worker and release imported file buffers after completion.

---

## Starting point

`tests/fixtures` contains a cube in all three formats, a cylinder, sphere,
two-solid STEP, and malformed STEP. These prove key paths but do not cover thin
features, holes, fillets, mixed scales, enough curved geometry, or a meaningful
set of troublesome supported-format files. There is no corpus manifest or
batch report.

## Implementation

- [x] **Define the corpus manifest.** Add `tests/fixtures/corpus-v1.json` with
  schema version, fixture path/hash/license/provenance, source units, geometry
  category, expected import classification, solid/face/volume/bounds ranges,
  mesh presets, element/count/quality ranges, and remesh FaceId assertions.
  Add Python structural tests that reject missing files, duplicate IDs, changed
  hashes, absent licenses, invalid ranges, and unknown stable error codes.
- [x] **Build the fixed release set.** Grow the corpus to at least 50 entries:
  18 valid STEP, 8 valid IGES, 8 valid BREP, and 16 intentional failure or
  troublesome cases. Cover tiny solids, thin ligaments, through/blind holes,
  fillets, cylinders/spheres/freeform curvature, mixed small/large scales,
  unit normalization, open shells, malformed input, and multiple solids. At
  least one valid example of each required geometry category must exist in
  every supported format where that format can represent it.
- [x] **Record fixture generation and provenance.** Add reproducible generation
  scripts under `tools/cad-fixtures/` for project-authored shapes, preserving
  seed/options and public-domain declarations. For externally sourced files,
  retain the upstream URL, author, license text, acquisition date, and original
  hash in `tests/fixtures/README.md`; exclude any file whose redistribution
  terms are ambiguous.
- [x] **Add the batch browser runner.** Create
  `tests/browser/cad-corpus-tests.{html,js}`. For each entry, create a new
  mesher worker, import, validate geometry statistics, mesh requested Tet4/Tet10
  presets, validate positive sampled Jacobians/boundary ownership/quality, then
  remesh and compare declared `FaceId` ranges. Continue after expected failures
  and emit JSON plus a readable table.
- [x] **Enforce useful diagnostics.** Require every invalid/troublesome case to
  match its declared stable code and stage. Fail the corpus when raw Gmsh or
  Emscripten text is the only user-facing message, a worker crashes without a
  structured response, or valid model state survives a failed replacement.
- [x] **Set the v1 import gate.** Require 100% agreement with the manifest:
  every valid supported-subset fixture imports and meshes within its ranges,
  and every deliberate rejection returns its expected classification. Record
  duration and peak mesher WASM size as observations, but do not tune solver
  memory thresholds from mesher data.
- [x] **Calibrate the quality warning from the corpus.** Compare gamma minimum,
  fifth percentile, edge ratio, sampled Tet10 Jacobians, and actual import/solve
  outcomes across accepted fixtures. Retain the current warning threshold when
  it separates usable from demonstrably poor meshes; otherwise change it only
  with the before/after corpus report, explicit warning semantics, and focused
  mesher/UI regression tests. Invalid Jacobians remain hard errors regardless.
- [x] **Document and audit.** Add the runner and corpus commands to `README.md`,
  publish a dated report under `benchmarks/cad-corpus/`, and change the corpus
  rows in `docs/release/v1-acceptance-audit.md` only when the committed report,
  manifest validator, and browser run all pass.

## Verification

- Run `python3 -m unittest discover -s tests` and the corpus manifest audit.
- Run the batch corpus from optional HTTP mode in current Chromium, then repeat
  all direct-local-capable entries from `file://` with the supported browser
  configuration.
- Run the existing STEP, Tet4, Tet10, preview-selection, authoring, and full
  cube vertical-slice harnesses to catch contract or FaceId regressions.
- Re-run the corpus after a clean worker/runtime rebuild and compare the report
  with the declared ranges before accepting any manifest update.

## Done when

The fixed 50-or-more-file corpus covers every Section 16.3 category, all files
have auditable redistribution rights, expected success/failure classifications
match at 100%, valid faces remain stable through remeshing, the quality warning
has recorded evidence, and the import/CAD-corpus v1 gate is reproducible.
