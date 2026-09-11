# Task 28: STL feasibility and surface patch contract implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current agent. Follow repository AGENTS.md; do not dispatch subagents. Stop at the M28 feasibility/design decision before Task 29.

**Goal:** Prove a supported STL-to-Tet10 path and define durable selectable patches before implementing production import.

**Architecture:** An experimental adapter uses the pinned disposable Gmsh worker to classify tessellated surfaces and create a volume. A format-neutral geometry contract exposes persistent patches to authoring, meshing, replacement, and orientation; the native solver remains unaware of STL.

**Tech Stack:** Existing Gmsh/WASM artifact, JavaScript typed arrays, reproducible fixture generators, static browser harnesses.

**Spec:** `spec.md` Sections 2.1–2.2, 6, 7, 15.11, 16.3, 18–20, and 26.

## Dependencies and constraints

- Requires accepted M27. This is a bounded feasibility/design package, not a promise that arbitrary STL files are analyzable.
- Bounded binary/ASCII STL for one closed solid is in the revised pre-v1 scope. A failed feasibility review keeps that gate open; only the owner can explicitly narrow or defer it.
- OBJ, general mesh repair, multi-body/shell analysis, and new third-party runtime libraries remain out of scope.
- No silent runtime upgrade, source modification, welding tolerance, or automatic hole filling. Proposed dependency/runtime changes require an explicit decision at M28.

## Investigation and contract work

### 1. Exercise the pinned runtime independently of production import

**Create:** `tools/cad-fixtures/generate-stl-fixtures.py`, `tests/fixtures/stl/README.md`, `tests/browser/stl-feasibility-tests.{html,js}`, `docs/designs/stl-import-contract.md`.
**Inspect:** `workers/mesher-worker.js`, `web/js/workers/mesher-client.js`, `web/js/geometry/geometry-model.js`, `tools/build-gmsh-local-runtime.sh`.

- [x] Generate deterministic public-domain binary/ASCII cubes plus curved, thin-feature, disconnected, open, nonmanifold, reversed-normal, degenerate, and malformed examples. Retain hashes, dimensions, and expected outcomes; never use private CAD as fixtures.
- [x] Probe actual pinned wrapper access to mesh import, surface classification, geometry creation, volume construction, and Tet4/Tet10 extraction. Use Gmsh tutorial t13 as the upstream reference, but record actual callable wrapper names and outputs rather than assuming Python API availability in JavaScript.
- [x] Run the successful cube and representative curved case in fresh workers under direct `file://` and optional HTTP. Measure input/preview/mesh buffers, WASM peak, duration, cancellation, and disposal. Check positive sampled Jacobians and volume, and quantify faceted curved-surface error separately from Tet10 solution error.
- [x] Keep probes in clearly labeled test/experimental paths; do not add STL to the production file chooser until Task 29 validates the path.

### 2. Specify validation, units, and persistent patch semantics

**Modify in the design:** geometry import request/result contracts, worker protocol, replacement mapping, source metadata, and mesh boundary ownership; point each proposed field to its producer and consumers.

- [x] Specify explicit user-selected STL length units and preview dimensions before installation. Preserve original bytes and record the unit scale and import options needed to reconstruct the same model in a fresh worker.
- [x] Define one closed connected manifold solid: finite coordinates, positive scale, nondegenerate triangles, paired manifold edges, consistent orientation, positive enclosed volume, and self-intersection checks. Specify actionable stable failure codes and whether each issue is rejected or offered as an explicit normalization action.
- [x] Define deterministic angle/adjacency patch grouping, user review of grouping, and stable opaque IDs. IDs must survive remeshing/reconstruction with the same source/options; do not use transient Gmsh entity numbers or raw triangle numbers as durable identity.
- [x] Explain how grouping changes invalidate assignments and require explicit remapping. Preserve Task 25 face-set drafting for patches, orientation behavior, geometry replacement transfer, and load integration. Define feature boundaries for Task 24 edge rendering.
- [x] Document preprocessing complexity and bounds: bulk work in workers, typed data, bounded allocations, and spatial acceleration for intersection tests rather than an all-pairs triangle scan.
- [x] Record the exact production module/file boundary recommended for Task 29 and any required version/build changes. Update the spec with the approved contract only after M28; keep current support claims unchanged.

## Manual review M28 — STL decision, about 20 minutes

Contract accepted by the owner on 2026-09-11 (“yes, accept.”); see
[the decision record](../reviews/28-stl-contract.md). Individual walkthrough actions were not observed.

- [x] Provide the reproducible feasibility report, working patch-selection demo, supported/rejected examples, measured costs, and the proposed contract in `docs/designs/stl-import-contract.md`.
- [ ] Owner checks units/dimensions, identifies a usable curved/planar patch, adjusts grouping, and evaluates a rejected file's explanation.
- [x] Obtain explicit acceptance of the supported subset and patch interaction, plus any necessary runtime/dependency change. Record rejected approaches and their concrete limitation only where they explain the decision.
- [ ] If infeasible with the allowed stack, stop dependent work and present concrete options; do not silently enable preview-only import as analysis support or mark v1 ready.

## Done when

Feasibility has reproducible evidence and the owner accepts a concrete STL contract at M28. Production support remains pending Task 29.
