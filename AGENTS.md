# Development guide

This file governs the repository unless a more specific `AGENTS.md` exists deeper in the tree. Read `README.md` for setup and commands, and treat `spec.md` as the source of truth for product requirements, architecture, numerical methods, performance targets, and milestone scope.

## Working approach

- For normal feature work, make a concise implementation plan and execute it directly in the current agent. Omit obvious mechanical steps.
- Do not use brainstorming for small, well-specified changes.
- Do not use subagent-driven development unless the user explicitly requests it.
- Do not dispatch separate spec-review or code-quality-review agents for straightforward changes.
- Prefer one final review of the complete diff over per-task reviews. Repeat review only when tests fail or a concrete defect is found.
- Use test-driven development where behavior is nontrivial. Do not create trivial tests solely to satisfy the workflow.
- Make reasonable, low-risk assumptions when the repository provides enough context. Ask before choices that materially change product behavior, architecture, dependencies, or scope.
- Keep diffs focused, preserve unrelated user changes, and avoid opportunistic rewrites.

## Design and organization

- Organize code into cohesive, reasonably sized modules. Split a file when it owns distinct responsibilities or independently testable subsystems, not to meet an arbitrary line count.
- Avoid both catch-all files and tiny pass-through modules. Keep tightly coupled helpers and constants with their primary consumer until they have genuine reuse or a separate responsibility.
- Prefer straightforward functions and explicit data flow over abstraction for hypothetical future use.
- Preserve the dependency boundaries in `spec.md` section 18: UI and rendering consume application data contracts; analysis state and invalidation belong in the model/controller; the native solver is independent of Gmsh; generic `/web/ui` helpers are independent of simulation internals.
- Treat vendored and generated code as separate from first-party source. Do not hand-edit it unless the task specifically requires that, and keep generated outputs reproducible.

## Performance and platform

- Prefer non-pessimized code: avoid unnecessary work, allocations, copies, parsing, DOM updates, and cross-boundary calls.
- For code that scales with mesh or result size, consider algorithmic complexity, data locality, allocation count, and peak memory. Optimize measured or obviously hot paths without sacrificing clarity or numerical correctness.
- Use typed arrays for bulk numerical data and transfer `ArrayBuffer` ownership across worker boundaries when safe. Keep worker messages coarse-grained and versioned.
- Keep meshing, assembly, solving, and stress recovery off the main thread. Preserve the separate mesher/solver worker lifecycle and memory preflight required by `spec.md`.
- Batch high-frequency UI work and avoid repeated full-mesh passes when an existing pass can safely produce the needed result.
- Preserve the dependency-free browser stack and direct `file://` execution path. Do not add React, TypeScript, npm, Node-based application tooling, frontend bundlers, native ES-module requirements, runtime CDN fetches, or other dependencies without explicit approval.
- Ordinary JavaScript must remain usable without a frontend build step. Narrow, reproducible packaging steps for workers and WASM are allowed.

## Correctness and verification

- FEA results require numerical evidence, not visual plausibility. Use the validation layers and acceptance criteria in `spec.md` section 16 as the implementation matures.
- Add or update tests for changed nontrivial behavior, bug fixes, public data contracts, state invalidation, worker protocols, and numerical kernels. Bug fixes should normally include a regression test.
- Keep numerical tolerances explicit and physically justified. Preserve validation, convergence checks, diagnostics, units, precision, and determinism while optimizing.
- Validate inputs at user, worker, WASM/native, geometry, mesh, and solver boundaries. User-visible failures need stable, actionable errors; solver actions and fallbacks must not be silent.
- Run focused tests during implementation and the complete applicable suite before handoff. Follow `README.md` for commands, and test direct `file://` startup when changing asset loading, workers, WASM packaging, or script ordering.
- `web/assets/icons/fea.svg` is synchronized with the central SpjutSim website. After editing either copy, run `npm run sync:icons` from the sibling `SpjutSim` checkout.
- Review the complete diff once for correctness, unnecessary work, peak-memory regressions, boundary violations, error handling, accessibility, and unintended vendor/generated changes.
- Update `spec.md` when changing requirements, architecture, protocols, numerical methods, performance targets, or acceptance criteria. Update `README.md` when setup, build, run, or test instructions change.
