# Local Web FEA — Development Specification

**Status:** Initial development specification  
**Target:** v1.0 local-first browser application  
**Primary use case:** Simple static finite element simulations on homogeneous, single-body mechanical parts  
**Primary CAD source:** STEP exported from Onshape  
**Mesher for v1:** Gmsh + OpenCASCADE, behind a replaceable mesher interface  
**Solver:** First-party C++/WebAssembly FEM + sparse PCG solver, executed locally in a Web Worker  
**Frontend:** Plain JavaScript + internalized SpjutSim UI foundation + Three.js; classic-script-compatible baseline for direct local-file execution  
**Frontend build pipeline:** None for normal browser-source development; no React, TypeScript, Vite, npm, or Node runtime dependency  
**Baseline execution:** Direct local `file://` launch where supported by the tested browser; optional local/static HTTP mode enables threaded WASM acceleration  
**v1.0 release bar:** Result post-processing and mesh-convergence workflow complete and validated

---

## 1. Product Goal

Build a browser-based finite element analysis application that lets a user:

1. Import a 3D CAD part.
2. Define a homogeneous isotropic material.
3. Select CAD faces and apply supports and static loads.
4. Generate a tetrahedral volume mesh automatically.
5. Review mesh quality and estimated solve memory before committing to a solve.
6. Solve a small-strain, linear-static elasticity problem locally using WebAssembly.
7. Visualize deformation and scalar result fields on the part.
8. Report maximum displacement, stress metrics, reactions, and factor of safety where sufficient material strength data is available.
9. Perform mesh-convergence studies so the user can distinguish a numerically stable result from an unconverged or singular peak stress.

The product should favor **useful, defensible engineering feedback over solver feature breadth**. The first release is intentionally not a general-purpose FEA package.

### 1.1 Guiding principles

- **Local-first:** geometry and simulation data should remain on the user's machine for v1.
- **Zero-server baseline:** the distributed application should, on the primary supported desktop browser, be able to launch by opening its local `index.html` directly without requiring a web server. HTTP serving is an optional compatibility/performance mode, not the definition of "runs locally."
- **Trust before speed:** mesh quality, convergence, constraints, units, and singularity warnings are first-class product behavior.
- **Modular numerics:** geometry/meshing, FEM assembly/solve, and post-processing should have explicit interfaces so implementations can be replaced.
- **Browser-aware:** the application must estimate peak memory and computational size before allocating the largest solve structures.
- **CAD-aware boundary conditions:** supports and loads attach to geometric faces, not ephemeral mesh node selections.
- **No false precision:** displayed results should make smoothing, convergence, and likely stress singularities visible to the user.
- **Dependency restraint:** prefer browser standards and first-party project code. Add a third-party runtime dependency only where reimplementing the capability would create disproportionate complexity or reliability risk.
- **No frontend framework/build dependency:** the browser application should remain directly understandable as HTML, CSS, classic-compatible JavaScript, workers, and WASM without a JavaScript package manager or bundler. ES modules may be used only where they do not compromise the direct-local execution target.
- **Internal UI foundation:** SpjutSim-UI-kit source is copied into and maintained with this project, not consumed as an external package. The simulation owns its state; UI helpers own presentation and interaction behavior only.

---

## 2. v1 Scope and Explicit Non-Goals

### 2.1 Included in v1.0

- Desktop web application implemented with plain HTML/CSS/JavaScript.
- SpjutSim UI foundation incorporated directly into the repository.
- No React, TypeScript, Vite, npm, or runtime Node.js requirement.
- Direct-local-file-capable application distribution, plus optional static HTTP serving for enhanced/threaded mode.
- Local STEP import (`.step`, `.stp`).
- One closed solid body per analysis.
- Homogeneous isotropic linear-elastic material.
- 3D solid tetrahedral elements.
- Gmsh + OpenCASCADE geometry import and volume meshing.
- Tet4 support for early development and verification.
- Tet10 support required for v1.0 release.
- Static loads and prescribed supports/displacements.
- Sparse linear solve in WebAssembly.
- Deformed-shape visualization.
- Displacement, von Mises stress, principal stress, and factor-of-safety visualization/reporting.
- Reaction-force calculation.
- Mesh-quality reporting.
- Pre-solve memory estimate and user warning system.
- Global mesh-convergence study.
- Warnings for likely underconstraint, poor mesh quality, and likely stress singularities.

### 2.2 Deferred until after v1.0

- Direct Onshape API/OAuth integration.
- Reading Onshape material metadata automatically.
- Orthotropic or anisotropic material models.
- 3D-print build direction, raster direction, or inter-layer strength models.
- Plasticity, nonlinear material response, contact, large deformation, buckling, modal, fatigue, thermal, transient, or dynamic analysis.
- Multi-body assemblies.
- Bonded/contact interfaces between bodies.
- Shell, beam, truss, or cohesive elements.
- Explicit modeling of infill or print roads.
- Adaptive local error-based mesh refinement.
- Remote/cloud solve service.
- GPU/WebGPU sparse solver.
- Parasolid import.
- IGES support in the UI, even though the selected meshing stack may technically support it.
- Mobile-device support.

### 2.3 v1 analysis assumptions

The solver assumes:

- infinitesimal strain;
- linear elasticity;
- quasi-static loading;
- a single homogeneous isotropic material;
- no contact or geometric nonlinearity;
- a valid solid domain;
- boundary conditions that remove rigid-body modes.

The application must display these assumptions in the analysis summary and exported result metadata.

---

## 3. User Workflow

The canonical v1 workflow is:

### Step 1 — Import

The user selects a STEP file.

The application:

- validates extension and basic file readability;
- imports it through the mesher/geometry worker;
- converts geometry to the application's internal SI length unit (meters);
- verifies that exactly one usable solid body is present;
- enumerates geometric faces and creates a renderable surface preview;
- computes basic geometric statistics such as bounding box and volume if available.

If import or healing fails, the user receives a specific import error and no simulation state is created.

### Step 2 — Material

The user enters material data.

Required:

- Young's modulus `E`;
- Poisson's ratio `nu`.

Optional:

- density `rho`;
- tensile yield strength;
- compressive yield strength;
- ultimate tensile strength;
- ultimate compressive strength;
- material name/label.

Density becomes required if gravity is enabled.

Strength data is not required to solve; it is required for corresponding factor-of-safety calculations.

### Step 3 — Boundary conditions and loads

The user selects one or more CAD faces and adds:

- fixed support;
- prescribed displacement;
- pressure;
- distributed total force;
- gravity/body force.

Boundary-condition selections are stored against geometric face identifiers supplied by the mesher backend, not against triangle or node IDs.

### Step 4 — Mesh

The user selects a mesh preset or custom size and requests a mesh.

The application:

- creates the volume mesh;
- maps boundary elements back to geometric faces;
- computes mesh-quality metrics;
- computes counts relevant to memory estimation;
- shows a mesh preview;
- estimates peak solve memory before starting the solver.

### Step 5 — Preflight

Before solve, show:

- element type;
- node count;
- element count;
- total degrees of freedom;
- estimated nonzeros in the stiffness matrix;
- estimated peak solve memory;
- available device-memory hint if the browser exposes one;
- constraint/load summary;
- mesh-quality warnings;
- memory warning level.

The user explicitly chooses **Solve** after this preflight.

### Step 6 — Solve

The solver executes in a dedicated Web Worker.

The UI remains responsive and shows coarse-grained progress states:

- preparing system;
- assembling stiffness/load vectors;
- applying constraints;
- solving;
- recovering stresses/results;
- preparing visualization data.

Cancellation must be supported by terminating the solver worker. Partial results are discarded.

### Step 7 — Results

The user can inspect:

- undeformed geometry;
- deformed geometry;
- displacement magnitude;
- displacement components;
- von Mises stress;
- maximum principal stress;
- minimum principal stress;
- factor of safety when available;
- mesh overlay;
- supports and load glyphs.

The result panel reports extrema and their locations, reaction totals, mesh statistics, solve statistics, and warnings.

### Step 8 — Convergence

The user can request a convergence study. The app solves a sequence of globally refined meshes, subject to memory limits, and plots convergence of selected metrics.

A result can then be labeled converged, unconverged, or indeterminate according to Section 12.

---

## 4. Technical Architecture

### 4.1 High-level architecture

```text
Browser main thread
  |
  |-- SpjutSim UI shell + application controller/state
  |-- Three.js viewport/rendering
  |
  |-- Geometry/Meshing Worker
  |     |-- Gmsh WASM
  |     `-- OpenCASCADE inside the selected Gmsh build
  |
  `-- Solver Worker
        `-- first-party FEM + sparse solver C++ -> WASM
```

The main thread owns application state, DOM/UI coordination, and visualization only. CPU-heavy meshing, assembly, iterative solve, and stress recovery must not run on the main thread.

The browser code should be ordinary JavaScript organized into small, dependency-explicit source files. The baseline distribution must not depend on native ES-module loading from `file://`; classic scripts and documented load ordering are acceptable and preferred where they improve direct-local compatibility. Numerical bulk data should cross worker/WASM boundaries as typed arrays and transferable `ArrayBuffer`s rather than large graphs of JavaScript objects.

### 4.2 Frontend direction

The v1 frontend stack is intentionally small:

- HTML;
- CSS;
- modern JavaScript;
- classic-script-compatible first-party browser code for the baseline local-file distribution;
- SpjutSim UI source copied into this repository;
- Three.js copied/pinned in this repository in a delivery format that works in the tested `file://` configuration;
- Web Workers;
- WebAssembly.

Explicitly do **not** introduce React, TypeScript, Vite, webpack, Rollup, npm-based application dependency management, or a Node.js application server for v1.

JavaScript source should use JSDoc where editor/type assistance materially improves maintainability, especially for analysis data contracts and worker messages. Prefer standard browser APIs and plain classes/functions over framework abstractions.

Do not make document import maps or native ES-module loading a baseline requirement. They may be used later in HTTP-only development modes if useful, but the normal distributed application must retain a direct-local execution path. All production runtime assets must be stored with the application rather than fetched from a public CDN.

For Three.js, vendor a pinned browser-consumable artifact that can be loaded from the local project tree without a package manager. If the selected upstream release is module-only, producing a pinned classic/global browser artifact at third-party-update time is acceptable; this does not create an application-time bundling requirement.

### 4.3 SpjutSim UI integration

The uploaded SpjutSim-UI-kit is the starting UI foundation. Treat it as **first-party project source**, not as a separately versioned runtime package.

Current integration model:

- adapt the shell markup directly into `index.html`; do not fetch or mount `shell.html` as a second application shell;
- keep the shell's title/menu region, primary-action region, tools pane, canvas pane, results pane, splitters, settings dialog, and accessibility roles as the baseline layout;
- preserve the existing dependency-free UI helpers for menus, settings navigation, custom selects, action controls, tooltips/help, overflow menus, and color schemes where they fit the application;
- copy the CSS token/style rules into the project and extend them with simulation-specific styles rather than introducing a second design system;
- preserve the existing semantic color roles for geometry, selection, tension, compression, loads, and supports where practical;
- use the shell behavior model for tools visibility, results modes, split ratio, responsive stacking, and active result tabs;
- keep simulation/application state outside the UI helper files.

The current portable UI helpers attach APIs such as `PortableUIShellBehaviors`, `PortableUICustomSelect`, and related helpers to `globalThis`/`self`. For v1 it is acceptable to retain that pattern and load the copied scripts in a documented order before `app.js`. Converting those internal files to ES modules later is allowed, but is **not required** and must not become a prerequisite for simulation development.

The UI source is expected to evolve with this application. Changes that are generally useful to SpjutSim applications may be made in the copied UI foundation, but simulation-specific logic belongs under the application's `/js/ui` or feature modules rather than inside generic controls.

### 4.4 Application state ownership

Do not use DOM elements or UI controls as the authoritative analysis state.

Maintain one explicit application/document state containing, at minimum:

```text
geometry
material
boundary conditions
loads
gravity
mesh settings
mesh metadata
solve settings
results
convergence study
UI preferences
```

Recommended top-level responsibilities:

- `AnalysisDocument`: serializable engineering/model state;
- `AppController`: commands, invalidation, orchestration, and worker lifecycle;
- `ViewportController`: Three.js scene, picking, selection, overlays, result fields;
- `UIController`: binds SpjutSim UI controls to application commands and renders state into the DOM;
- `MesherClient`: coarse-grained worker interface;
- `SolverClient`: coarse-grained worker interface.

Changing geometry invalidates mesh and results. Changing material, loads, or constraints invalidates results. Changing mesh settings invalidates mesh and results. These rules belong in the application controller/model layer, not in individual UI widgets.

### 4.5 Worker lifecycle is a memory-management feature

Meshing and solving should use **different workers**.

Reason: Gmsh + OpenCASCADE is a large WASM workload and uses its own WebAssembly memory. Keeping the mesher alive while allocating a large stiffness matrix can unnecessarily increase browser peak memory.

Required lifecycle:

1. Start mesher worker.
2. Import geometry and mesh.
3. Extract only required topology, mesh, surface mapping, and display buffers.
4. Transfer those buffers out of the worker.
5. Terminate the mesher worker before a large solve when geometry operations are no longer needed.
6. Start solver worker.
7. Transfer mesh/material/BC data into solver worker.
8. Terminate solver worker when results are no longer needed or a new solve invalidates them.

If remeshing is requested, recreate the mesher worker and re-import the source STEP bytes. Keep the original STEP file bytes in application state if memory permits, otherwise retain a file handle/reference and request access as needed.

### 4.6 Runtime modes: direct local files and optional HTTP acceleration

v1 should support two execution modes.

#### Mode A — Portable direct-local mode (baseline)

The primary distribution goal is that a user can extract/copy the application folder and open `index.html` directly with a tested desktop browser using a `file://` URL.

This mode must:

- perform all computation locally;
- require no local server process;
- require no network connection after the application has been obtained;
- use single-threaded WASM builds that do not require `SharedArrayBuffer` or cross-origin isolation;
- avoid runtime `fetch()` dependencies for `.wasm` payloads where `file://` browser rules would block them;
- avoid making native ES modules/import maps a requirement;
- keep expensive meshing and solving off the UI thread using a file-safe worker-loading strategy.

WASM payloads intended for this mode should be packaged self-contained where practical. For the first-party FEM module, prefer a generated artifact that embeds the WASM payload in its loader or otherwise permits instantiation from locally available bytes without HTTP fetch. Gmsh should likewise have a pinned single-threaded local-file-compatible packaging path. The selected baseline target is `serial-local`: Gmsh and OpenCASCADE are compiled without OpenMP/pthreads and the WASM bytes are embedded into the generated mesher-worker payload. Its larger artifact is an intentional distribution tradeoff for serverless, offline startup.

Worker loading under `file://` is browser-sensitive. Do not assume `new Worker('./worker.js')` is portable. The project should provide a file-safe worker bootstrap, such as a generated Blob-worker payload or equivalent self-contained worker artifact. Keep human-maintained worker source separate from generated embedded payloads so the worker logic remains readable and testable.

If the current browser cannot execute the supported local-file worker path, the application must show a clear compatibility diagnostic and recommend optional HTTP mode; it must not silently move meshing/solving onto the main UI thread.

Direct-local behavior is an explicit compatibility test target, not an assumption. The primary v1 browser is only considered supported when the full import -> mesh -> solve path has been exercised from `file://`.

#### Mode B — Local/static HTTP high-performance mode (optional)

Threaded WASM builds may use browser shared memory/pthreads. These require `SharedArrayBuffer` and cross-origin isolation in normal web deployment.

When threaded mode is enabled, the serving environment should provide at least:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The application should detect `crossOriginIsolated` and expose threaded acceleration only when the environment supports it. Lack of cross-origin isolation is **not** a startup failure; it selects the portable single-threaded path.

Any future threaded Gmsh target is a separate `threaded-hosted` artifact. It may reuse a pinned upstream browser package, but it must never be loaded or feature-detected by attempting to start pthreads in portable mode.

Provide an optional repository-local Python server, e.g. `tools/serve.py`, for developers/users who want the HTTP/threaded mode. It should:

- serve the static web tree;
- supply correct MIME types for `.js` and `.wasm`;
- emit COOP/COEP headers;
- perform no application computation and receive no geometry upload.

Example optional command:

```bash
python tools/serve.py
```

A conventional static host may provide the same headers for hosted/threaded use. The application architecture must not require such hosting for the baseline local distribution.

### 4.6.1 File-safe packaging strategy

The preferred source layout remains many readable JavaScript files plus separate native/WASM source. Distribution/build tooling may generate a small number of self-contained artifacts specifically to bridge browser `file://` restrictions.

Acceptable examples include:

- Emscripten `SINGLE_FILE`-style output or an equivalent embedded WASM payload for the FEM solver;
- a pinned single-threaded Gmsh/OpenCASCADE build whose WASM bytes are available without runtime HTTP fetch;
- generated worker-source wrappers consumed through `Blob` URLs when direct local worker script loading is restricted;
- a small Python or native build utility that embeds generated worker/WASM output without transpiling application JavaScript.

Generated local-runtime wrappers should be reproducible from checked-in source/build scripts and clearly separated from hand-authored application code. This packaging step is allowed; it is not a React/Vite/npm-style frontend build pipeline.

### 4.7 JavaScript/build-tool policy

There is no framework/transpile frontend build step. Editing ordinary browser source files and reloading the page should normally be a valid development loop.

A narrow packaging/regeneration step is allowed for generated local-file worker/WASM wrappers because browser security rules may otherwise prevent `file://` workers or WASM fetches. Keep this tooling simple and repository-local; prefer Python, Make/CMake, or native/Emscripten build scripts rather than JavaScript package tooling.

Do not require:

- `package.json`;
- `node_modules`;
- npm/yarn/pnpm;
- a Node development server;
- generated frontend bundles.

C++ -> WASM compilation uses Emscripten. Emscripten itself may internally use a bundled Node executable as part of its compiler implementation; that is acceptable and is not an application/runtime dependency. Developers should interact with it through `make`, CMake, or a repository build script rather than through an npm toolchain.

### 4.8 Third-party code policy

Planned third-party runtime code for v1 should be limited to:

1. **Gmsh + OpenCASCADE** for CAD import and tetrahedral meshing.
2. **Three.js** for 3D viewport rendering and interaction support.

Everything practical beyond those capabilities should be implemented in-project, including the FEM formulation, sparse matrix representation, iterative solver, memory estimator, result processing, state model, and UI orchestration.

Pin vendored third-party source/binaries to explicit versions in a small `THIRD_PARTY.md` or equivalent manifest, including source URL, version/commit, license, and local modifications/build flags.

### 4.9 Browser target

v1 is a **desktop-browser application**.

Primary test target:

- current Chromium-based desktop browsers.

Secondary targets:

- current Firefox desktop;
- Safari desktop only after explicit compatibility testing.

Do not rely on the Device Memory API for correctness because it is not universally available.

---

## 5. Core Data Model and Interfaces

All numerical values use SI units internally:

- length: m
- force: N
- pressure/stress/modulus: Pa
- density: kg/m^3

The UI may display mm, MPa, GPa, etc.

Use plain JavaScript objects for configuration/state and typed arrays for bulk numerical data. Use JSDoc typedefs for important contracts so editors can provide completion/checking without a TypeScript compilation step.

### 5.1 Geometry model

```js
/** @typedef {string} FaceId */

/**
 * @typedef {Object} GeometryModel
 * @property {string} geometryId
 * @property {string} sourceName
 * @property {'step'} sourceFormat
 * @property {FaceId[]} faceIds
 * @property {Object} boundingBoxM
 * @property {number=} volumeM3
 * @property {SurfaceMesh} preview
 */
```

`FaceId` is opaque to consumers. The Gmsh implementation may derive it from OpenCASCADE/Gmsh entity tags, but other code must not depend on that encoding.

### 5.2 Material

```js
/**
 * @typedef {Object} IsotropicMaterial
 * @property {string=} name
 * @property {number} youngsModulusPa
 * @property {number} poissonsRatio
 * @property {number=} densityKgM3
 * @property {number=} tensileYieldPa
 * @property {number=} compressiveYieldPa
 * @property {number=} ultimateTensilePa
 * @property {number=} ultimateCompressivePa
 */
```

Validation:

- `E > 0`
- `-1 < nu < 0.5`
- for ordinary engineering solids, UI should warn on values outside approximately `0 <= nu < 0.5` rather than silently rejecting mathematically valid exotic values;
- all supplied strengths/density must be positive.

### 5.3 Boundary-condition model

Use discriminated plain objects:

```js
// Fixed support
{ type: 'fixed', faceIds: ['face-id', ...] }

// Prescribed displacement; omitted components are unconstrained
{
  type: 'prescribed-displacement',
  faceIds: ['face-id', ...],
  uxM: 0.0,
  uyM: undefined,
  uzM: undefined
}

// Pressure; positive means compression into the body
{
  type: 'pressure',
  faceIds: ['face-id', ...],
  pressurePa: 1.0e6,
  direction: 'surface-normal'
}

// Total distributed force vector over selected faces
{
  type: 'total-force',
  faceIds: ['face-id', ...],
  forceN: [1000, 0, 0]
}
```

Gravity is analysis-level state:

```js
{
  enabled: true,
  accelerationMS2: [0, 0, -9.80665]
}
```

Default Earth gravity may be `[0, 0, -9.80665]`, but the user controls orientation.

### 5.4 Mesher interface

The application/orchestrator must depend on an abstract mesher contract rather than Gmsh APIs directly. This is a behavioral contract, not a requirement to implement a formal JS class hierarchy.

```js
// Conceptual MesherBackend API
await mesher.importGeometry(stepBytes, importOptions);
await mesher.generateMesh(meshRequest);
await mesher.dispose();
```

`VolumeMeshResult` must contain everything the solver needs without knowing the source mesher:

```js
{
  elementType: 'tet4', // or 'tet10'
  nodePositionsM: Float64Array,
  elementConnectivity: Uint32Array,
  boundaryFaces: /* typed-array boundary representation */,
  geometryFaceMap: /* FaceId -> boundary range/index mapping */,
  statistics: { /* node/element counts, sizes */ },
  quality: { /* quality summary */ },
  memoryInputs: { /* topology values used by estimator */ }
}
```

No solver code may import or depend on Gmsh-specific types or entity tags.

### 5.5 Runtime contract validation

Because the project uses JavaScript rather than TypeScript, validate worker/API boundary payloads at runtime where corruption or a version mismatch could produce an unsafe numerical interpretation.

Requirements:

- version each coarse-grained worker protocol;
- validate required scalar fields before starting expensive work;
- verify typed-array lengths against node/element counts;
- verify connectivity indices are in range;
- reject unsupported element types explicitly;
- use assertions aggressively in native debug/test builds;
- avoid expensive deep validation of large arrays on every internal function call once a trusted boundary has been crossed.

## 6. CAD Import and Geometry Handling

### 6.1 Supported input

v1 accepts STEP only:

- `.step`
- `.stp`

Use Gmsh's OpenCASCADE geometry kernel for import.

The implementation should set OpenCASCADE's target unit so the imported model is normalized to meters before meshing. Do not infer units from filename or UI assumptions.

### 6.2 Geometry validation

After import:

1. Confirm at least one 3D volume exists.
2. Require exactly one selected/usable solid for v1.
3. Reject an analysis containing multiple disconnected solids.
4. Check that a closed volume mesh can in principle be generated.
5. Record all geometric surfaces and their IDs.
6. Generate a lightweight preview triangulation associated with those surface IDs.

### 6.3 Healing

Gmsh/OpenCASCADE geometry healing may be attempted when initial import/meshing indicates common defects such as:

- degenerate edges;
- tiny edges/faces;
- unsewn surfaces;
- non-solid shells.

Healing must be conservative. The user should be told if geometry was modified during healing.

Maintain the original import as the source of truth so the operation can be retried with different tolerances.

### 6.4 Face identity

Face identity is critical because loads/supports attach to CAD faces.

For a given imported geometry instance:

- each OpenCASCADE/Gmsh surface entity is mapped to an opaque `FaceId`;
- preview triangles carry the corresponding `FaceId` for hit-testing;
- mesh boundary elements carry the corresponding `FaceId` after each remesh;
- all BC definitions reference `FaceId`.

A remesh must not invalidate face selections.

v1 does **not** promise that face identifiers survive editing/re-exporting the source CAD model. A future project-file format may add geometric-signature remapping.

---

## 7. Meshing

### 7.1 Selected backend

Use **Gmsh + OpenCASCADE** for v1.

Prefer an internally reproducible, pinned Gmsh/OpenCASCADE WASM build produced from upstream sources with Emscripten, with only the minimal generated JavaScript loader needed by the worker. A prebuilt community browser package may be used temporarily for the initial feasibility spike, but it should not become an additional permanent runtime dependency without a concrete reason. Record the exact Gmsh, OpenCASCADE, Emscripten, build flags, and any wrapper source in `THIRD_PARTY.md`; do not introduce an npm lockfile solely for this purpose.

Do not expose Gmsh APIs outside the mesher worker/backend adapter.

### 7.2 Element types

Development sequence:

- **Tet4:** first implementation, patch tests, boundary-condition plumbing, solver verification.
- **Tet10:** required for v1.0 release and default production analysis element.

Tet4 may remain available as an advanced/debug option and for very coarse previews, but normal user-facing solves should use Tet10 once supported.

Reason: first-order tetrahedra are simple and robust but can be excessively stiff in bending and require substantially more refinement for useful accuracy.

### 7.3 Mesh controls

User-facing presets:

- Coarse
- Normal
- Fine
- Custom

The UI should avoid exposing the full Gmsh option set.

Recommended initial relative target sizes, expressed against the model bounding-box diagonal `D`:

- Coarse: target maximum size about `D / 15`
- Normal: about `D / 30`
- Fine: about `D / 60`

These are starting values, not guaranteed element sizes.

Enable geometry-aware size behavior so curved regions and geometric boundaries are represented more finely than a pure uniform grid would provide. Establish minimum/maximum size bounds to prevent tiny CAD details from creating uncontrolled element counts.

The custom mode should initially expose:

- target maximum element size;
- minimum element size;
- element order.

### 7.4 Mesh generation stages

The mesher backend should conceptually perform:

1. Geometry import/synchronize.
2. Optional healing.
3. Surface sizing setup.
4. 3D tetrahedral generation.
5. Optional conversion to second order.
6. Mesh optimization.
7. Extraction of nodes/elements.
8. Extraction of boundary triangles by geometric surface entity.
9. Quality computation.
10. Solver-memory input computation.

### 7.5 Mesh quality

At minimum compute/report:

- element count;
- node count;
- minimum and distribution of a normalized tetrahedral quality metric;
- inverted/negative-Jacobian count;
- near-zero Jacobian count;
- extreme edge-length ratio/aspect indicators;
- minimum and maximum characteristic element size.

The exact Gmsh quality metric used must be documented in code and surfaced by name in developer diagnostics.

Release behavior:

- inverted elements: hard failure;
- degenerate/near-zero-Jacobian elements: hard failure or explicit no-solve state;
- poor but valid elements: warning, not necessarily failure.

### 7.6 Future mesher replacement

A replacement backend must be able to provide:

- a valid volume mesh;
- boundary surface elements;
- persistent mapping from boundary elements to geometric `FaceId`s;
- mesh statistics/quality;
- enough topology information for memory estimation.

Potential future backends include Netgen or a server-side robust mesher. No frontend or solver API should require changes when replacing the mesher.

---

## 8. FEM Formulation

### 8.1 Governing problem

Solve small-strain static linear elasticity:

```text
K u = f
```

where:

- `K` is the global stiffness matrix;
- `u` is the displacement vector;
- `f` is the applied nodal-load vector.

Each node has three translational degrees of freedom.

### 8.2 Isotropic constitutive law

Use Young's modulus `E` and Poisson's ratio `nu` to construct the isotropic 3D elasticity matrix `D`.

Use one clearly documented Voigt ordering throughout the codebase, for example:

```text
[xx, yy, zz, xy, yz, zx]
```

Do not mix engineering shear strain and tensor shear strain conventions between element routines and stress recovery.

### 8.3 Tet4 implementation

Tet4 is the first development element.

Requirements:

- constant-strain tetrahedron;
- correct volume/Jacobian validation;
- 12x12 element stiffness;
- body-force contribution;
- face traction integration;
- exact patch-test behavior within floating-point tolerance.

### 8.4 Tet10 implementation

Tet10 is required for v1.0.

Requirements:

- quadratic shape functions;
- numerical integration appropriate for stiffness and stress recovery;
- quadratic triangular boundary-face integration for pressure/traction;
- correct mapping from Gmsh's Tet10 node ordering into the solver ordering;
- validation against analytical and reference solutions.

Keep element-specific logic behind an element implementation interface so Tet4 and Tet10 share assembly/post-processing infrastructure.

### 8.5 Loads

#### Pressure

Pressure is integrated over selected boundary faces in the local outward normal direction.

The sign convention must be explicit in the UI. Prefer positive pressure meaning compression into the body.

#### Total force on faces

A requested total force vector is distributed over the selected faces consistently by surface integration. Do not simply divide by the number of mesh nodes.

The integrated equivalent nodal forces should sum to the requested total force within numerical tolerance.

#### Gravity

Gravity is applied as a body force:

```text
b = rho * g
```

and therefore requires density.

### 8.6 Supports and prescribed displacement

Fixed support constrains all three displacement components of every node belonging to the selected geometric face(s).

Prescribed displacement may constrain any subset of `ux`, `uy`, `uz`.

Duplicate constraints must be consolidated. Conflicting prescribed values on the same DOF are a preflight error.

### 8.7 Constraint application

Use a method that preserves the symmetric positive-definite structure when appropriate.

Acceptable v1 strategies:

- elimination/reduced system; or
- symmetric row/column modification with consistent RHS adjustment.

Do not use a large penalty factor as the default constraint method.

---

## 9. Sparse Assembly and Solver

### 9.1 Implementation language and ownership

Implement the FEM core and sparse solver in modern C++ and compile it to WebAssembly with Emscripten.

The numerical core should also be buildable as a native command-line/test binary so automated tests can run without browser overhead.

The v1 solver should not depend on Eigen, PETSc, SuiteSparse, or another external sparse linear-algebra library. Own the small subset of sparse operations actually required by this application so memory representation, allocation order, and failure behavior are predictable.

Prefer the C++ standard library plus first-party numerical code. If a future benchmark demonstrates a compelling need for another numerical dependency, add it only through an explicit architecture/license review.

### 9.2 Sparse matrix representation

Avoid a production assembly strategy that stores one scalar triplet for every local tetrahedral stiffness entry. The transient triplet list can dominate browser memory.

Baseline v1 approach:

1. Build node adjacency from element connectivity.
2. Expand it into a symmetric scalar DOF sparsity graph.
3. Build CSR row pointers and column indices once.
4. Allocate the `double` value array once.
5. Assemble element contributions directly into those preallocated entries.

Use 32-bit indices unless a supported problem size demonstrably requires otherwise. Refuse a mesh whose graph cannot be represented by the configured index type.

A 3x3 block-CSR representation is a future optimization because connected node pairs naturally form dense displacement-coupling blocks. Do not require it for the first trusted solver; scalar CSR is easier to validate and makes the first memory model explicit.

### 9.3 Assembly lookup

Direct assembly needs an efficient way to map `(row, column)` to a CSR value location.

Acceptable first-party approaches include:

- sorted CSR columns with binary search during assembly;
- a temporary per-row lookup map built during graph construction and released before solve;
- precomputed element-to-CSR index maps when their memory cost benchmarks favorably.

Choose based on measured peak memory first and assembly time second. Any temporary lookup structure must be included in the memory estimator if it overlaps the solve phase.

### 9.4 Solver choice

The constrained linear-elastic stiffness matrix should be symmetric positive definite for a properly constrained model.

Default v1 solver:

- first-party preconditioned conjugate gradient (PCG).

Required initial preconditioner:

- diagonal/Jacobi.

A first-party IC(0) or similar stronger SPD preconditioner should be added before v1.0 only if representative Tet10 benchmarks show Jacobi cannot meet reasonable convergence/performance targets. Do not add a third-party sparse package solely to obtain a preconditioner before measuring this.

A tiny dense/direct reference solver may exist only in tests for very small systems; it is not the browser production path.

### 9.5 PCG operations

Keep the production solver small and explicit. It needs approximately:

- CSR symmetric matrix-vector multiply;
- vector dot product;
- vector axpy/update operations;
- residual norm;
- preconditioner setup/application;
- finite-value checks;
- cancellation/progress checks at controlled intervals.

All solver work arrays should be preallocated once per solve where practical.

### 9.6 Convergence criteria

Solver convergence must consider a relative residual norm, for example:

```text
||K u - f|| / max(||f||, reference) < tolerance
```

Initial default tolerance should be on the order of `1e-8` for well-scaled linear systems, with a maximum iteration count tied to problem size and benchmark results.

Record:

- iteration count;
- final relative residual;
- solve duration;
- whether convergence was achieved;
- reason for termination.

If PCG detects non-finite values, a non-positive curvature quantity, or other behavior inconsistent with an SPD system, report a likely constraint, mesh, conditioning, or implementation problem rather than returning a normal result.

### 9.7 Scaling

Poor unit scaling should be minimized by using SI consistently.

If iterative convergence proves problematic across material magnitudes and geometry scales, add matrix diagonal scaling/preconditioning before changing the physical formulation.

### 9.8 WASM/native API boundary

Expose a deliberately small C-compatible interface from the numerical core. Do not bind individual C++ classes or STL containers into JavaScript.

Conceptual API:

```cpp
FemContext* fem_create();
void fem_destroy(FemContext* ctx);

int fem_load_mesh(FemContext* ctx, /* typed buffers/counts */);
int fem_set_material(FemContext* ctx, /* isotropic properties */);
int fem_set_boundary_conditions(FemContext* ctx, /* compact BC buffers */);

FemMemoryEstimate fem_estimate_memory(FemContext* ctx);
int fem_solve(FemContext* ctx, const FemSolveSettings* settings);
int fem_get_result_info(FemContext* ctx, FemResultInfo* out);
```

The exact ABI can evolve, but the goals are fixed:

- few crossings between JavaScript and WASM;
- bulk typed-buffer transfer;
- predictable ownership/lifetimes;
- native and WASM builds exercise the same FEM/solver code;
- the memory estimator uses the same representation assumptions as the actual solver.

---

## 10. Pre-Solve Memory Estimation and Resource Safety

Memory estimation is a v1 feature, not a later optimization.

### 10.1 User-facing objective

Before allocating the global stiffness matrix, the app must display an estimated peak memory requirement and classify the solve as:

- **Likely safe**
- **Caution**
- **Likely insufficient memory**

The user should always be able to inspect the estimate. A warning should not silently reduce mesh resolution.

### 10.2 Estimate after meshing, before solve

After the mesh exists, compute:

- `N` = node count;
- `T` = tetrahedral element count;
- `DOF = 3N`;
- `E_mesh` = number of unique node-to-node adjacency edges created by element connectivity;
- estimated scalar nonzero count `nnz`.

For a full scalar matrix with dense 3x3 blocks per node adjacency, an initial structural estimate is:

```text
nnz ~= 9*N + 18*E_mesh
```

This should be replaced by an exact sparsity count once the graph builder exists, but the graph count itself must happen before large matrix allocation.

### 10.3 Peak-memory model

Maintain a versioned empirical memory model. It should include at least:

```text
mesh storage
+ sparse matrix values
+ sparse matrix indices/pointers
+ assembly work arrays
+ load/displacement/residual/search vectors
+ preconditioner storage
+ stress/result arrays
+ WASM runtime overhead margin
```

For the v1 first-party scalar CSR representation, the base matrix estimate begins with:

```text
matrixValuesBytes  = 8 * nnz
matrixIndexBytes   = 4 * nnz
rowPointerBytes    = 4 * (DOF + 1)
```

Then add explicit estimates for the Jacobi diagonal, PCG work vectors, graph/assembly lookup structures that coexist with the solve, result storage, and WASM allocator/runtime margin. Because the solver representation is first-party, the estimator should eventually calculate these allocations from the same counts/helpers used by the actual allocator rather than maintaining an unrelated approximation.

Do **not** present this raw sum as a precise number. Apply a configurable safety multiplier derived from benchmark measurements.

Initial conservative recommendation:

```text
estimatedPeakBytes = 1.5 * modeledPeakBytes
```

The multiplier must be recalibrated from real browser measurements before v1.0.

### 10.4 Mesher and solver memory should not overlap unnecessarily

Terminate the meshing worker before starting the solve so its WASM heap can be reclaimed by the browser.

The displayed solve-memory estimate should be for the solver phase. Mesh-generation peak memory can be measured and reported separately if it becomes a common failure mode.

### 10.5 Device Memory API behavior

If `navigator.deviceMemory` is available, treat it only as a **coarse hint**. The API intentionally reports an approximate/coarsened amount of physical memory and has limited browser availability.

Never block a solve solely because `deviceMemory` is absent.

Recommended warning logic:

```text
if deviceMemory is available:
    deviceBytes = deviceMemoryGiB * 2^30
    ratio = estimatedPeakBytes / deviceBytes

    Likely safe:              ratio <= 0.25 and estimatedPeakBytes < 4 GiB
    Caution:                  0.25 < ratio <= 0.50, or estimatedPeakBytes >= 4 GiB
    Likely insufficient:      ratio > 0.50
else:
    Likely safe:              estimatedPeakBytes < 2 GiB
    Caution:                  2 GiB <= estimate < 8 GiB
    Strong caution:           estimate >= 8 GiB
```

These are **product heuristics**, not browser guarantees, and must be tuned with real measurements.

### 10.6 8 GiB warning

Use 8 GiB as an explicit absolute warning threshold in v1, not as the only decision rule.

For any solve estimated at or above 8 GiB:

- show a prominent warning;
- require a second explicit confirmation to start;
- explain that browser/OS/WASM allocation limits may cause termination even on a machine with more physical RAM;
- recommend a coarser mesh.

Do not promise that a solve below 8 GiB will succeed.

### 10.7 WASM address-space policy

v1 should not depend on `memory64` for correctness. Treat 64-bit WebAssembly memory as a future capability until the application has been tested across its supported browser matrix and the selected Emscripten/libraries support it reliably.

The initial production build should set an explicit practical upper bound for the solver WASM memory and surface that limit in preflight. The exact bound is an implementation/test decision, not a hidden runtime failure.

If the estimate exceeds the configured WASM heap maximum, disable Solve and require a coarser mesh.

### 10.8 Benchmarking the estimator

Add a developer benchmark that records, per browser and mesh:

- predicted peak bytes;
- observed JS heap where available;
- observed WASM memory size;
- operating-system process peak if captured in external test harness;
- whether the solve completed.

Use these measurements to fit/calibrate the safety factor before v1.0.

---

## 11. Post-Processing and Visualization

This section is part of the v1.0 release bar.

### 11.1 Required result fields

At minimum calculate:

- displacement vector `(ux, uy, uz)`;
- displacement magnitude;
- strain tensor/Voigt components;
- stress tensor/Voigt components;
- von Mises stress;
- maximum principal stress;
- minimum principal stress;
- reaction forces on constrained DOFs;
- total reaction force vector.

Optional but useful for v1 if low effort:

- maximum shear stress;
- strain energy density.

### 11.2 Stress recovery

The internal stress-recovery method depends on element type.

For Tet4:

- stress is constant within an element.

For Tet10:

- evaluate stress at documented integration/recovery points;
- use those values for raw numerical extrema;
- derive a nodal/surface-smoothed field for rendering.

### 11.3 Raw vs smoothed stress

The UI must distinguish:

- **raw numerical peak**: maximum recovered element/integration-point value;
- **displayed smoothed peak**: maximum of the interpolated/averaged surface field used for visualization.

Never silently report a smoothed contour peak as the sole "maximum stress".

### 11.4 Deformed shape

Render:

```text
x_display = x + scale * u
```

Controls:

- undeformed;
- true-scale deformation (`scale = 1`);
- auto exaggerated deformation;
- user-adjustable exaggeration.

The UI must always display the active deformation scale.

### 11.5 Color maps

Each result field needs:

- scalar range;
- legend with units;
- min/max values;
- optional automatic percentile clipping for visualization only.

If clipping is used to make the plot readable, clearly indicate it and keep reported extrema unclipped.

### 11.6 Picking and probes

The user should be able to click the rendered surface and see approximate local values for the active field, including:

- coordinates;
- displacement;
- stress metric;
- face ID for developer diagnostics.

### 11.7 Result summary

A completed analysis summary should include:

- mesh element type;
- nodes/elements/DOFs;
- solve residual and iterations;
- max displacement and location;
- raw max von Mises stress and location;
- principal stress extrema;
- minimum factor of safety if available;
- total applied force/body load summary;
- total support reaction;
- force-balance residual;
- convergence status;
- warnings.

### 11.8 Equilibrium check

Compute a global equilibrium diagnostic:

```text
sum(applied external forces) + sum(reactions) ~= 0
```

Report a normalized force-balance residual. Large imbalance is a solver/post-processing failure and must invalidate the result.

---

## 12. Factor of Safety

### 12.1 Default ductile criterion

For v1 isotropic materials, the default factor of safety uses von Mises stress and a scalar yield strength:

```text
FoS = yieldStrength / vonMisesStress
```

Strength-selection rule:

1. if both tensile and compressive yield strengths are supplied, use the smaller value for the default von Mises FoS;
2. if only one yield strength is supplied, use it and annotate the result with the source strength;
3. if no yield strength is supplied, do not show yield FoS.

### 12.2 Ultimate strengths

Ultimate strengths may be displayed as material metadata and may support an optional "ultimate margin" calculation, but the app should not substitute ultimate strength for yield strength without explicitly labeling the criterion.

### 12.3 FoS display

Show:

- minimum raw FoS;
- optionally smoothed FoS contour for visualization;
- the material strength used;
- the failure criterion used.

Values near stress singularities must inherit the singularity/convergence warning.

---

## 13. Mesh Convergence and Stress-Singularity Handling

This section is part of the v1.0 release bar.

### 13.1 Purpose

A single mesh result must not be presented as automatically trustworthy. The user needs a practical way to determine whether global quantities and local stresses have stabilized with mesh refinement.

### 13.2 v1 convergence approach

Use **global remeshing/refinement**, not local adaptive refinement.

A convergence study creates a sequence of meshes with characteristic target size reduced by a fixed factor, initially:

```text
h_next = 0.7 * h_current
```

The exact sequence may be adjusted to Gmsh behavior, but it must be deterministic and visible in the study table.

Default maximum:

- 4 solved mesh levels total, or
- stop earlier due to convergence, solver failure, user cancellation, or memory guard.

### 13.3 Metrics to track

For each mesh level record:

- node count;
- element count;
- DOFs;
- target mesh size;
- max displacement magnitude;
- total strain energy;
- raw max von Mises stress;
- optionally a high-percentile stress metric;
- minimum FoS if defined;
- solve iterations/time;
- estimated peak memory.

### 13.4 Convergence criteria

Initial default global convergence thresholds:

- max displacement relative change <= 2%;
- total strain energy relative change <= 2%;
- each criterion satisfied for the final refinement step.

Stress convergence is tracked separately:

- raw max von Mises relative change <= 5% is considered locally stable for the purpose of a simple indicator;
- do not fail global convergence solely because raw peak stress does not converge.

These values should be configurable in developer settings and may become advanced user controls later.

### 13.5 Singularity heuristic

A likely stress singularity exists when, across refinement:

- displacement and strain energy converge;
- raw peak stress continues to rise materially or fails to stabilize;
- the peak remains spatially concentrated around the same geometric feature/support/load application.

When this occurs, report:

> Global response appears converged, but peak stress is not mesh-converged and may be singular. Do not use the reported peak directly for factor-of-safety decisions without reviewing the local geometry and boundary condition.

Do not claim a mathematical singularity with certainty solely from this heuristic.

### 13.6 Convergence UI

Show a table and simple plots for:

- mesh size/DOF vs max displacement;
- mesh size/DOF vs strain energy;
- mesh size/DOF vs raw max von Mises stress.

Status values:

- **Converged** — global criteria satisfied;
- **Converged globally; stress unresolved** — global criteria pass, peak stress fails stability criterion;
- **Unconverged** — available levels do not satisfy criteria;
- **Indeterminate — resource limit** — next required mesh was blocked by memory/resource limits;
- **Failed** — meshing or solve error.

### 13.7 Memory guard during convergence

Before each refined solve:

1. generate mesh;
2. estimate solve memory;
3. apply normal memory-warning policy;
4. do not automatically run a refinement above the hard configured WASM memory limit;
5. if the estimate crosses the 8 GiB warning level, pause automatic progression and require explicit user confirmation.

---

## 14. Warnings and Preflight Validation

Warnings are part of the engineering product, not debug logging.

### 14.1 Hard errors — Solve disabled

Examples:

- geometry did not form one valid solid;
- no material `E`/`nu`;
- invalid material values;
- gravity without density;
- no supports;
- conflicting prescribed displacement;
- inverted/degenerate elements;
- memory estimate above configured solver heap maximum;
- unsupported element type;
- boundary mapping lost for a selected face.

### 14.2 Warnings — Solve allowed with confirmation or caution

Examples:

- unusually high/low Poisson's ratio;
- poor mesh quality;
- very coarse mesh relative to geometry;
- apparently insufficient constraint against rigid-body motion;
- concentrated loading on a very small face;
- estimated memory in caution range;
- solve estimate >= 8 GiB;
- very large deformation relative to part dimensions, which violates the small-deformation assumption;
- stress not converged;
- likely stress singularity.

### 14.3 Underconstraint detection

At minimum perform a preflight heuristic based on constrained DOFs and connected components, then rely on solver diagnostics for final detection.

A more robust v1 implementation should detect near-rigid modes through failure of the SPD iterative solve, very small/invalid pivots in preconditioner setup, or an optional low-cost stiffness stability check.

User-facing errors should identify underconstraint as the likely cause rather than exposing only a numerical failure code.

### 14.4 Large-deformation warning

Although the solver is linear, compare maximum displacement with a characteristic model dimension.

Initial heuristic:

- warn if `maxDisplacement > 0.05 * boundingBoxDiagonal`.

This is not a validity proof; it is a warning that geometric nonlinearity may matter.

---

## 15. UI/UX Requirements

### 15.1 Main shell

Use the internalized SpjutSim UI shell as the baseline application chrome:

```text
+-------------------------------------------------------------------+
| App title/status | File/View/etc menus            | primary Solve |
+----------------------+--------------------------------------------+
| Tools pane           | Canvas / Results layout                    |
|                      | +---------------------+------------------+  |
| Geometry             | |                     | Results          |  |
| Material             | |    Three.js         | / Convergence    |  |
| Supports             | |    viewport         | / Diagnostics    |  |
| Loads                | |                     |                  |  |
| Mesh                 | +---------------------+------------------+  |
| Analysis             |                                            |
+----------------------+--------------------------------------------+
```

The UI foundation already models a tools pane and a canvas/results area with resizable split behavior. Preserve the concepts of results modes (`hidden`, `split`, `expanded`), responsive stacking, a user-adjustable split ratio, and an active results tab.

The primary **Solve** action belongs in the shell's primary-actions region rather than being buried inside the tools pane.

Recommended result tabs for v1:

- Results;
- Convergence;
- Diagnostics.

The exact tab names may change, but numerical results and convergence should live in the results pane rather than competing with geometry/material setup controls.

### 15.2 Tools pane organization

Use ordinary semantic HTML controls enhanced by the internal UI helpers where useful.

Recommended sections:

- Geometry / Import;
- Material;
- Supports;
- Loads;
- Mesh;
- Solve preflight.

The analysis state model remains authoritative. Controls render the state and dispatch commands; they do not own the engineering model.

Use the copied custom-select enhancement for select-heavy controls such as units, mesh preset, result field, and deformation display mode when appropriate. Native controls must remain the underlying semantic source.

### 15.3 Settings

Use the existing SpjutSim settings dialog/hub pattern for application preferences rather than analysis inputs.

Appropriate settings include:

- display units;
- appearance/color scheme;
- help/tooltips enabled;
- tools auto-collapse behavior;
- developer/diagnostic options when enabled.

Material properties, loads, supports, and mesh settings are analysis-document data and should **not** be hidden in the global Settings dialog.

### 15.4 UI color roles

Extend the existing UI token system rather than hard-coding simulation colors in Three.js or individual widgets.

At minimum preserve/use semantic roles for:

- canvas background;
- geometry;
- hover;
- selection;
- tension;
- compression;
- load;
- support.

Three.js materials/glyphs should obtain these colors from resolved application theme values so viewport semantics remain consistent with the rest of the UI.

Result contour colormaps are separate from UI theme roles; they must remain numerically meaningful and include a legend.

### 15.5 Face selection

The viewport must support:

- click face;
- shift-click/additive selection;
- clear selection;
- selected-face highlight;
- selecting the faces associated with an existing BC from the analysis tree/tools pane.

The preview mesh must preserve a face-to-triangle map for picking.

### 15.6 Loads/support glyphs

Display:

- fixed-support symbols or highlighted faces;
- pressure arrows/normals;
- force arrows;
- gravity direction indicator.

Glyph scaling is visual only and must not imply magnitude without a numeric label.

### 15.7 Units

Provide a small unit-display preference, while storing SI internally.

Recommended defaults for mechanical CAD:

- geometry/displacement: mm
- force: N
- stress/strength: MPa
- modulus: GPa
- density: kg/m^3

Input controls must show units adjacent to values.

### 15.8 Help, tooltips, and accessibility

Use the internal tooltip/help primitives for concise control explanations and optional expanded engineering definitions. This is particularly useful for terms such as Poisson's ratio, mesh quality, von Mises stress, convergence, and memory estimates.

Maintain semantic roles/ARIA state for menus, tabs, switches, dialogs, and listboxes as the UI foundation currently does. Keyboard interaction must remain usable after simulation-specific controls are added.

### 15.9 No silent solver actions

Changing geometry, material, BCs, loads, or mesh settings invalidates dependent results.

The UI must clearly mark results stale and require a new solve.

---

## 16. Validation and Test Strategy

A visually plausible contour plot is not sufficient validation.

### 16.1 Test layers

#### Unit tests

- shape functions;
- Jacobian/volume;
- constitutive matrix;
- Tet4 stiffness;
- Tet10 stiffness/integration;
- traction integration;
- von Mises calculation;
- principal stress calculation;
- sparse graph construction;
- BC elimination;
- memory estimator.

Browser-side JavaScript logic should have a lightweight in-browser test harness rather than an npm test framework. Cover at least:

- analysis-state invalidation rules;
- worker message validation/version handling;
- memory warning classification;
- units/display conversion;
- face-selection state;
- critical SpjutSim shell behavior used by the app.

The harness may be a static `/tests/browser/index.html` page using first-party assertion helpers and can be run manually or under a configured headless browser in CI without becoming a frontend package dependency.

#### Patch tests

Required:

- rigid translation should create zero strain/stress where applicable to an unconstrained element-level test;
- constant strain state reproduced correctly;
- linear displacement field behavior appropriate to element order.

#### Analytical benchmarks

At minimum:

1. Axial prismatic bar under end traction.
   - displacement and stress against closed form.
2. Cantilever beam.
   - tip displacement against beam theory in a geometry where beam assumptions are appropriate.
3. Uniformly loaded simple solid/pressure case with known symmetry/equilibrium behavior.
4. Plate/solid with circular hole or another stress-concentration benchmark.
5. Gravity-loaded body for body-force/reaction verification.

#### External solver comparison

Maintain several small STEP + analysis fixtures with reference results generated by a mature solver such as CalculiX or another trusted FEA package.

Compare:

- displacement at probes;
- reaction forces;
- strain energy;
- representative stresses away from singular boundaries.

### 16.2 Initial numeric acceptance targets

Exact tolerances depend on benchmark and mesh, but initial targets should be explicit.

Suggested starting targets for converged Tet10 benchmarks:

- simple axial displacement/stress: <= 1% error;
- global reaction force balance: <= 0.1% relative error;
- cantilever/global displacement: <= 3% after convergence;
- strain energy: <= 3% against reference;
- local nonsingular stress probes: <= 5% after convergence.

Do not apply a fixed tolerance to mathematically singular peak stress.

### 16.3 Regression fixtures

Each solver/mesher release should run a fixed corpus containing:

- tiny simple solids;
- thin features;
- holes;
- fillets;
- highly curved surfaces;
- mixed small/large geometric scales;
- purposely troublesome STEP files.

Store expected import status, mesh counts within tolerances/ranges, quality status, and selected numerical outputs.

### 16.4 Cross-browser resource tests

For representative mesh sizes, record:

- meshing success;
- solve success;
- wall time;
- memory prediction;
- actual observed WASM memory;
- cancellation behavior;
- UI responsiveness.

These tests are required before adjusting the product's memory-warning thresholds.

---

## 17. Milestones and Definition of Done

### Milestone 0 — Repository and execution skeleton

Deliverables:

- static `index.html` using the adapted SpjutSim shell markup;
- copied/internal SpjutSim UI CSS and behavior files loaded from the repository;
- plain JavaScript application bootstrap using a direct-local-compatible script structure;
- Three.js viewport loaded from repository-local vendored files;
- mesher and solver worker shells;
- file-safe worker bootstrap/proof of concept;
- single-threaded local-file-compatible WASM loading proof of concept;
- optional cross-origin-isolated Python server for HTTP/threaded testing;
- native/WASM solver build scripts and tests;
- no npm/Node frontend dependency;
- documented double-click/open-`index.html` path plus optional HTTP command.

Done when the primary supported desktop browser can open `index.html` through `file://`, load the shell and Three.js viewport, start both worker entry paths, and instantiate a small test WASM module without blocking the UI or requiring a server. The optional `python tools/serve.py` path must also work and report `crossOriginIsolated === true` when configured for threaded testing.

### Milestone 1 — Geometry and meshing spike

Deliverables:

- STEP import through Gmsh/OpenCASCADE;
- single-solid validation;
- face IDs and face picking;
- Tet4 volume mesh;
- surface-to-CAD-face mapping;
- coarse/normal/fine/custom sizing;
- mesh-quality summary;
- corpus of at least 50 representative/problematic CAD parts if available during development.

Done when representative STEP parts can be repeatedly remeshed without losing selected geometric faces and failures are classified usefully.

### Milestone 2 — Trusted Tet4 solver

Deliverables:

- isotropic material;
- fixed/prescribed-displacement BCs;
- pressure, total force, gravity;
- Tet4 assembly;
- sparse PCG solve;
- reactions;
- core analytical tests;
- solver worker cancellation;
- initial memory estimate.

Done when patch tests and simple analytical benchmarks pass defined tolerances.

### Milestone 3 — Production element and analysis workflow

Deliverables:

- Tet10 generation and solve;
- correct quadratic face loading;
- mesh optimization/quality gates;
- stable sparse assembly without giant triplet memory spike;
- calibrated memory estimator;
- resource preflight UI;
- solver diagnostics and underconstraint handling.

Done when Tet10 reference benchmarks and memory tests pass.

### Milestone 4 — Results, trust layer, and convergence — **v1.0 release bar**

Deliverables:

- deformed-shape rendering;
- displacement fields;
- von Mises/principal stress fields;
- raw vs smoothed stress reporting;
- reactions/equilibrium residual;
- FoS calculation;
- probe tool;
- result extrema;
- global mesh-convergence workflow;
- convergence plots/table;
- stress-singularity heuristic and warning;
- stale-result invalidation;
- final benchmark suite.

**The application is considered good to use / v1.0-ready only when this milestone is complete and validation criteria are passing.**

### Post-v1.0 Milestone 5 — Onshape integration

Candidate work:

- OAuth;
- document/workspace/element/part selection;
- direct geometry acquisition/export pipeline;
- import Onshape material metadata;
- analysis provenance linked to Onshape document version.

### Post-v1.0 Milestone 6 — Printed-part anisotropy

Candidate work:

- orthotropic elastic matrix;
- material coordinate system;
- build direction and raster direction;
- directional strengths;
- anisotropic failure criteria;
- calibrated print-material profiles.

---

## 18. Repository/Module Boundaries

A suggested layout:

```text
/web
  index.html
  /css
    app.css
  /ui
    ui-tokens.css
    action-controls.js
    color-scheme-editor.js
    color-schemes.js
    custom-select.js
    overflow-menu.js
    settings-controls.js
    settings-hub.js
    tooltips.js
    shell-behaviors.js
    /reference
      shell.html              # optional source/reference fragment; not fetched at runtime
  /js
    app.js
    /analysis
      analysis-document.js
      app-controller.js
      invalidation.js
      units.js
    /geometry
      geometry-model.js
      selection.js
    /mesh
      mesh-model.js
      mesh-settings.js
    /results
      result-model.js
      convergence.js
    /render
      viewport-controller.js
      result-colors.js
      glyphs.js
    /ui
      ui-controller.js
      tools-panel.js
      results-panel.js
      settings.js
    /workers
      mesher-client.js
      solver-client.js
      worker-protocol.js
  /vendor
    /three
      ... pinned Three.js browser artifact(s) ...
  /wasm
    /gmsh
      ... pinned Gmsh/OpenCASCADE WASM + wrapper/source ...
    /fem
      ... generated FEM WASM + loader/source ...
  /generated
    /local-runtime
      ... reproducible file-safe worker/WASM wrapper artifacts ...

/native/fem
  /include
  /src
    elements/
    sparse/
    solver/
    postprocess/
  /tests

/native/wasm
  fem_c_api.cpp

/workers
  mesher-worker.js
  solver-worker.js

/tools
  serve.py                    # optional HTTP/threaded mode
  build-wasm.sh or equivalent
  build-local-runtime.py      # optional/recommended file-safe wrapper generation

/benchmarks
  /analytic
  /reference
  /cad-corpus

THIRD_PARTY.md
spec.md
```

The exact folder names may change, but preserve these dependency rules:

```text
UI/controllers -> application data contracts <- mesher client/backend
UI/controllers -> application data contracts <- solver client/backend
solver native core has no dependency on Gmsh
renderer has no dependency on sparse matrix internals
SpjutSim UI helpers have no dependency on FEM/mesh internals
```

Do not create a separate package/workspace structure merely to simulate boundaries that can be maintained with ordinary modules and directories.

### 18.1 UI source ownership

The `/web/ui` files are a project-owned snapshot/evolution of the SpjutSim UI foundation. They are not installed from npm, loaded from a CDN, or treated as an opaque vendor dependency.

When the generic UI foundation changes:

- keep reusable shell/control behavior generic;
- place app-specific panels and commands under `/web/js/ui`;
- document non-obvious loading order between legacy/global helper files;
- prefer backward-compatible changes to shared helper APIs where practical.

### 18.2 Vendored dependencies

`/web/vendor/three` and `/web/wasm/gmsh` are third-party vendored dependencies and should be kept distinct from first-party UI/application code.

`THIRD_PARTY.md` should record versions, licenses, source locations, and build flags/checksums as practical.

---

## 19. Worker Message Contracts

Worker APIs should be versioned, coarse-grained, and represented as plain JavaScript objects plus transferable buffers.

Example mesher requests:

```js
{
  protocol: 1,
  type: 'import',
  requestId: '...',
  stepBytes: arrayBuffer
}

{
  protocol: 1,
  type: 'mesh',
  requestId: '...',
  settings: meshSettings
}
```

Example solver request:

```js
{
  protocol: 1,
  type: 'solve',
  requestId: '...',
  mesh: transferableMesh,
  material: isotropicMaterial,
  boundaryConditions: boundaryConditions,
  gravity: gravityLoad,
  solverSettings: solverSettings
}
```

Large arrays must be sent as transferable `ArrayBuffer`s where ownership can move safely instead of being structured-cloned.

Results should return visualization-ready typed buffers rather than millions of JavaScript objects.

Worker responses should include:

- `protocol`;
- `requestId`;
- a stable response/event type;
- progress stage where relevant;
- structured error data on failure.

Do not make the main thread depend on Gmsh wrapper objects or C++/Emscripten-generated class bindings.

## 20. Performance Targets

These are product targets, not hard physical limits.

For v1, optimize for analyses in the approximate range of:

- tens of thousands to low hundreds of thousands of Tet10 nodes;
- solver memory comfortably below a few GiB on ordinary desktop machines.

Do not set an element-count marketing limit until benchmarks exist. Memory footprint, sparsity, convergence, and browser behavior are better control variables than raw element count.

Target behaviors:

- main UI never freezes for meshing or solve;
- cancel action visibly responds immediately by terminating worker execution;
- file import and mesh failures return useful diagnostics;
- preflight occurs before the largest memory allocation;
- analysis state can be edited after a failed/cancelled solve without reloading the page.

---

## 21. Error Handling and Diagnostics

Every worker error should return a structured failure:

```js
{
  code: 'SOLVER_NOT_CONVERGED',
  stage: 'solve', // import | mesh | preflight | assembly | solve | postprocess
  userMessage: 'The solver did not converge.',
  developerMessage: 'optional detailed diagnostic',
  recoverable: true
}
```

Do not expose raw Gmsh, Emscripten, or native solver exception/assertion text as the only UI message.

Examples of stable error codes:

- `GEOMETRY_IMPORT_FAILED`
- `MULTIPLE_SOLIDS_UNSUPPORTED`
- `GEOMETRY_NOT_CLOSED`
- `MESH_GENERATION_FAILED`
- `MESH_INVALID_JACOBIAN`
- `BOUNDARY_MAPPING_FAILED`
- `MATERIAL_INVALID`
- `CONSTRAINT_CONFLICT`
- `LIKELY_RIGID_BODY_MODE`
- `MEMORY_LIMIT_EXCEEDED`
- `SOLVER_NOT_CONVERGED`
- `EQUILIBRIUM_CHECK_FAILED`

Keep full diagnostic logs available behind a developer/debug panel.

---

## 22. Licensing and Distribution Decision

This is the only major non-technical decision that should be settled before publicly distributing v1.0.

Gmsh is GPL-2.0-or-later, and common browser WASM packages statically include Gmsh/OpenCASCADE. Distribution of that WASM artifact carries Gmsh's license obligations unless a separate commercial license is obtained.

Therefore:

- development can proceed with Gmsh now;
- keep the mesher isolated behind the backend contract;
- before proprietary distribution, decide whether the application will comply with the GPL obligations, obtain an appropriate Gmsh commercial license, or replace the meshing backend.

This licensing question is one reason the mesher abstraction is a v1 architectural requirement rather than cleanup work.

---

## 23. Security and Privacy

For v1:

- all geometry and analysis computation occurs locally;
- do not upload STEP files or meshes to an application backend;
- analytics, if added, must not include geometry or material/analysis payloads;
- imported file data should be released when the user closes/replaces the model;
- worker termination is the preferred cleanup mechanism for large WASM heaps.

Third-party scripts/assets should be minimized and stored with the application. Direct-local mode must not depend on remote CDNs. HTTP/threaded mode should use same-origin resources so cross-origin isolation remains straightforward.

---

## 24. Decisions Intentionally Left Open

These do not block implementation and should be decided using benchmark data:

1. Exact Gmsh 3D meshing algorithm/options for the default preset.
2. Exact tetrahedral quality metric and warning threshold.
3. Whether to optimize the validated scalar CSR implementation into 3x3 block-CSR before or after v1.0.
4. Whether Jacobi is sufficient for the v1 benchmark corpus or a first-party IC(0)/stronger preconditioner is required.
5. Production PCG tolerance and maximum-iteration heuristic.
6. Exact practical WASM heap cap for supported browsers.
7. Calibration factor in the memory estimator.
8. Exact browser support matrix beyond current Chromium desktop.
9. Whether to provide a downloadable/local desktop wrapper after the browser v1 is stable; it is not required to achieve direct-local browser execution.
10. Whether the copied SpjutSim UI helpers should eventually be converted from global/IIFE scripts to ES modules; this is cleanup and must not remove the baseline direct-local path.
11. Whether the solver should gain a threaded build after single-threaded WASM performance has been benchmarked; threaded acceleration is optional for v1 correctness.

Each should be resolved by a benchmark, compatibility test, or licensing/product requirement rather than by prematurely coupling the architecture.

---

## 25. Recommended First Development Tasks

Start with a framework-free vertical skeleton and the geometry/meshing path before spending time on solver UI polish.

1. Copy the current SpjutSim UI foundation into `/web/ui` and adapt the shell fragment directly into `/web/index.html`.
2. Prove the direct-local execution skeleton first: open `/web/index.html` through `file://`, load the UI and a repository-local Three.js viewport, and start a trivial Blob-backed worker.
3. Establish the local-file WASM packaging approach with a tiny test module that instantiates without HTTP `fetch()`.
4. Add optional `/tools/serve.py` for HTTP/threaded testing with COOP/COEP headers and correct WASM MIME handling.
5. Establish `app.js`, `AppController`, `UIController`, and `ViewportController` with plain JavaScript and JSDoc contracts; do not require native ES modules for the baseline path.
6. Produce/pin a single-threaded Gmsh/OpenCASCADE browser build that can initialize in the direct-local worker path using repository-local/generated assets only.
7. Import one known-good STEP cube and normalize units to meters.
8. Extract geometric surface IDs and a preview tessellation.
9. Implement face picking in Three.js and connect selection state to the tools pane.
10. Generate a Tet4 mesh and return typed-array connectivity.
11. Extract boundary triangles grouped by `FaceId`.
12. Build a small CAD regression corpus and record failures.
13. Finalize the mesher backend message contract based on information actually required by the solver/UI.
14. Implement first-party Tet4 assembly + scalar CSR graph/storage + PCG/Jacobi in native C++ tests.
15. Compile the same FEM core to single-threaded WASM and connect it through the file-safe solver worker path.
16. Verify the same vertical slice in optional HTTP mode; only then investigate pthread/threaded acceleration if benchmarks justify it.

A successful first vertical slice is:

> Import STEP cube -> click one face as fixed -> click opposite face and apply traction -> mesh -> show memory estimate -> solve in first-party WASM -> display deformed shape and axial stress -> verify against the analytical solution.

That slice exercises almost every architectural boundary without requiring the full result/convergence system.

---

## 26. v1.0 Acceptance Checklist

The project is ready to call v1.0 only when all of the following are true:

- [ ] STEP import works on the agreed CAD regression corpus at an acceptable success rate.
- [ ] Exactly-one-solid restriction is enforced clearly.
- [ ] CAD face selections survive remeshing within an analysis session.
- [ ] Tet10 is the default production element.
- [ ] Fixed supports, prescribed displacement, pressure, total face force, and gravity work.
- [ ] Force integrations and reactions satisfy equilibrium checks.
- [ ] First-party sparse assembly avoids unbounded triplet-memory growth.
- [ ] Production solver does not require a third-party sparse linear-algebra library.
- [ ] Frontend runs without npm, React, TypeScript, Vite, or a framework/transpile JavaScript build step.
- [ ] Primary supported desktop browser completes the full import -> mesh -> solve workflow when `index.html` is opened through `file://`.
- [ ] Direct-local mode does not require `SharedArrayBuffer`, cross-origin isolation, a server process, or a network connection.
- [ ] Direct-local meshing and solving remain off the UI thread using the tested file-safe worker path.
- [ ] Optional HTTP mode detects cross-origin isolation and can enable threaded acceleration when a threaded build is present.
- [ ] SpjutSim UI source is internalized and the application shell works from repository-local files only.
- [ ] PCG failures are diagnosed rather than returned as plausible results.
- [ ] Pre-solve memory estimate is shown for every solve.
- [ ] Device-memory hints are optional and absence does not break the app.
- [ ] >= 8 GiB estimated solves show an explicit high-memory warning/confirmation.
- [ ] Configured WASM heap limit is enforced before solve allocation.
- [ ] Solver and mesher run off the UI thread.
- [ ] Worker cancellation works.
- [ ] Deformed shape and required scalar contours render correctly.
- [ ] Raw and smoothed stress peaks are distinguished.
- [ ] Maximum displacement, stress extrema, reactions, and solver statistics are reported.
- [ ] Yield-based von Mises factor of safety works when strength data is supplied.
- [ ] Mesh convergence workflow is complete.
- [ ] Global convergence vs unresolved peak stress are reported separately.
- [ ] Likely stress singularities produce a clear warning.
- [ ] Analytical and reference-solver validation tests pass agreed tolerances.
- [ ] Memory-estimator calibration tests have been run on supported browsers.
- [ ] Licensing/distribution posture for Gmsh has been resolved.

---

## 27. External Technical Notes

These are implementation constraints worth keeping near the spec; they are not application requirements by themselves.

- Gmsh's OpenCASCADE API can import BREP, STEP, and IGES shapes, and provides geometry healing operations.
- Current Gmsh browser/WASM packaging can include OpenCASCADE and STEP import and may use pthreads/OpenMP.
- Browser pthread/shared-memory execution requires `SharedArrayBuffer`, which in normal web deployment requires appropriate cross-origin isolation headers; this is why pthreads are an optional acceleration path rather than a baseline runtime requirement.
- Direct `file://` operation is browser-sensitive for WASM fetches, ES modules, and Worker script URLs. The project therefore treats local-file compatibility as an explicit tested packaging target rather than relying on default loader behavior.
- Self-contained Emscripten output (for example `SINGLE_FILE`-style packaging) or equivalent embedded WASM bytes can avoid runtime `.wasm` fetches in the local-file path, at the cost of a larger JavaScript artifact and potentially different initialization-memory behavior that should be benchmarked.
- `navigator.deviceMemory` is deliberately approximate and is not supported by every major browser, so it must remain an advisory input.
- Modern WebAssembly APIs expose 64-bit memory addressing capabilities, but v1 should not depend on `memory64` until the entire selected toolchain and supported-browser matrix has been validated.
- Three.js should be vendored locally in a browser-consumable format verified under the project's `file://` test path. Native ES modules are not a baseline requirement.
- Native ES modules/import maps and ordinary Worker script URLs are more straightforward under HTTP, but baseline local execution should use packaging that does not depend on those origin behaviors.
- Emscripten may use Node internally as part of the compiler SDK, but the application itself does not use Node, npm, or a Node server.

Reference documentation consulted while preparing this specification:

- Gmsh API/reference: https://gmsh.info/doc/texinfo/gmsh.html
- Gmsh WASM packaging used for feasibility reference: https://github.com/loumalouomega/GMSH-JS
- Emscripten pthreads: https://emscripten.org/docs/porting/pthreads.html
- Emscripten settings (`SINGLE_FILE` and related packaging): https://emscripten.org/docs/tools_reference/settings_reference.html
- MDN `Navigator.deviceMemory`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
- MDN cross-origin isolation: https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
- MDN WebAssembly Memory: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory

---

## 28. Summary of Locked v1 Decisions

| Area | Decision |
|---|---|
| Product model | Local-first browser FEA |
| CAD format | STEP only |
| Geometry | One closed solid body |
| Geometry kernel | OpenCASCADE through Gmsh |
| Mesher | Gmsh, isolated behind replaceable interface |
| Prototype element | Tet4 |
| v1 production element | Tet10 |
| Physics | 3D small-strain linear static elasticity |
| Material | Homogeneous isotropic |
| Solver | First-party C++ -> WASM, scalar CSR + PCG |
| Execution | Dedicated Web Workers; single-threaded baseline, optional threaded acceleration |
| Baseline launch | Direct `file://` open on the primary supported browser |
| HTTP server | Optional Python/static server for compatibility/threaded mode with COOP/COEP |
| JS package manager | None |
| Frontend | Plain JavaScript, classic-script-compatible baseline; no bundler/transpiler requirement |
| UI foundation | SpjutSim UI source copied into project and adapted directly |
| Visualization | Vendored Three.js |
| Third-party runtime code | Gmsh/OpenCASCADE + Three.js only by default |
| Memory | Mandatory pre-solve estimate; Device Memory API advisory only |
| High-memory warning | Explicit warning at >= 8 GiB estimate plus device-relative heuristics |
| Convergence | Global remeshing study required for v1 trust workflow |
| v1 release bar | Milestone 4: post-processing + convergence complete |
| Onshape API | Post-v1.0 |
| Orthotropic printed-part model | Post-v1.0 |
