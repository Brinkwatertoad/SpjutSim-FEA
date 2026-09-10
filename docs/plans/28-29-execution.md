# Plans 28–29 execution

Branch: `feat/28-29-stl-import`, based on `fed435a`.

Execute in the current agent; no new application dependencies. The owner's
request authorizes work on both plans. Any material supported-subset or runtime
decision still needs concrete evidence and an owner decision.

1. Probe the pinned runtime and generate reproducible valid/rejected STL fixtures.
2. Build an experimental units/patch demo and fresh-worker Tet4/Tet10 harness;
   measure geometry preservation, mesh quality, resources, and cancellation.
3. Document validation, persistent identity, module boundaries, supported limits,
   and the M28 decision. Ask about material choices with the evidence available.
4. Implement the accepted production adapter, transactional review, reconstruction,
   orientation/replacement, and analysis integration with behavioral tests first.
5. Extend corpus/packaging documentation; run Python/native/browser, numerical,
   corpus, resource, and distribution checks; review the complete diff and prepare
   the M29 owner walkthrough. Do not mark manual gates accepted automatically.

Baseline: 77 Python tests passed. Initial browser probe on the pinned artifact
successfully imported/classified an ASCII cube and generated Gmsh type 11 Tet10.
Reparametrization produced eight Gmsh surfaces for six physical cube faces: user
patch identity must be independent of those internal subdivisions.
