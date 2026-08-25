# Task 3: Implement STEP import and the geometry contract

## Outcome

Import one STEP file into the mesher worker and return a validated,
mesher-independent `GeometryModel` in SI units. Preserve the source STEP bytes
so a later remesh can recreate the disposable worker.

## Implementation

- Add JSDoc contracts and runtime validators for import requests, structured
  errors, `GeometryModel`, bounding boxes, and preview surface buffers. Centralize
  protocol rules instead of duplicating checks across UI and worker code.
- Add a `MesherClient` that owns request IDs, progress/error routing,
  cancellation by termination, and worker disposal. Keep canonical STEP bytes
  in application state and transfer a dedicated copy to each disposable worker.
- In the worker adapter, write STEP bytes to Gmsh's virtual filesystem, import
  with OpenCASCADE, synchronize, normalize the target unit to meters, and remove
  temporary files/state on completion or failure.
- Require exactly one usable 3D solid. Return stable codes for unreadable STEP,
  no solid, multiple solids, and invalid/non-closed geometry. Do not expose raw
  Gmsh exceptions as the user message.
- Map each CAD surface entity to an opaque per-import `FaceId`. Extract a light
  preview as indexed positions plus face-group ranges/IDs, a bounding box in
  meters, and volume when available. Consumers must not interpret `FaceId`.
- Add controller commands for import success/failure and geometry replacement.
  Replacing geometry must clear boundary conditions, loads, mesh metadata, and
  results. DOM elements remain views, not state.
- Wire the existing Import STEP control to a local `.step`/`.stp` file picker and
  display progress and actionable diagnostics. No drag/drop is required.

Likely new modules: `web/js/geometry/geometry-model.js`,
`web/js/workers/mesher-client.js`, and an import adapter beside the mesher worker.

## Fixtures and verification

- Check in a small, clearly licensed/generated STEP cube fixture with known
  dimensions, plus invalid-text and two-solid fixtures if their size is modest.
- Test protocol validation, stale response handling, controller invalidation,
  extension filtering, SI bounds/volume, solid-count errors, opaque unique face
  IDs, and typed-array length/index consistency.
- Run all repository tests and import the cube from both `file://` and HTTP.
  Confirm the canonical file bytes remain available after the import worker exits.

## Done when

Importing the cube produces a valid geometry document with meter-based bounds,
one volume, six selectable face identities, and grouped preview buffers; all
expected failures are recoverable without reloading the page.
