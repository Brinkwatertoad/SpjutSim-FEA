# Local Web FEA — Development Specification

**Status:** Unreleased. The original static-analysis workflow and Plans 21–34 are implemented; the additional pre-v1 work in [the plan index](docs/plans/README.md), final usability acceptance, and Task 20 candidate audit remain open.
**Target:** v1.0 local-first browser application  
**Primary use case:** Simple static finite element simulations on homogeneous, single-body mechanical parts  
**Primary CAD sources:** STEP, IGES, and OpenCASCADE BREP
**Mesher for v1:** Gmsh + OpenCASCADE, behind a replaceable mesher interface  
**Solver:** First-party C++/WebAssembly FEM + sparse PCG solver, executed locally in a Web Worker  
**Frontend:** Plain JavaScript + internalized SpjutSim UI foundation + Three.js; classic-script-compatible baseline for direct local-file execution  
**Frontend build pipeline:** None for normal browser-source development; no React, TypeScript, Vite, npm, or Node runtime dependency  
**Baseline execution:** Direct local `file://` launch on tested desktop browsers; optional local/static HTTP uses the same serial workers. Threaded WASM is deferred.
**v1.0 release bar:** Validated static analysis and convergence, completed pre-v1 plans, owner usability acceptance, and exact-candidate audit.

This document states product and technical requirements. **Planned** sections are approved requirements awaiting implementation; their status is tracked in [docs/plans/README.md](docs/plans/README.md). Historical fixes are integrated thematically here; chronology and evidence belong in [docs/reviews](docs/reviews/requirements-history.md). Major section numbers are retained for existing references.

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
- Direct-local-file-capable application distribution and optional static HTTP serving with the same serial workers.
- Local STEP (`.step`, `.stp`), IGES (`.iges`, `.igs`), and OpenCASCADE BREP (`.brep`) import.
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
- Browser-local material and unit libraries; DOCX and text/PNG ZIP reports.
- Portable save/open with optional mesh/results and lightweight local recovery.
- Model volume/mass, easier viewport selection, discoverable advanced controls, consistent editing language, contextual errors, onboarding, and report options with complete defaults.
- **Planned:** local directions, planar sliding/symmetry supports, bearing loads, distributed moments, and offset forces.

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
- Load cases/comparison, persistent measurements/probes, and manually controlled local mesh sizing (sequenced post-v1 in Plans 39–41).
- Adaptive local error-based mesh refinement; distinct from manual local sizing.
- Remote/cloud solve service.
- GPU/WebGPU sparse solver.
- Parasolid import.
- STL, OBJ and other tessellated input formats. STL development is paused and
  archived on `features/stl-import`; it is not a v1 requirement.
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

The user selects a STEP, IGES, or OpenCASCADE BREP file.

The application:

- validates extension and basic file readability;
- imports it through the mesher/geometry worker;
- converts geometry to the application's internal SI length unit (meters);
- verifies that exactly one usable solid body is present;
- enumerates geometric faces and creates a renderable surface preview;
- computes basic geometric statistics such as bounding box and volume if available.

If import or healing fails, report a specific error and retain any previously installed analysis. Commit a new model only after validation and any required replacement review.

### Step 2 — Material

The user chooses a material from the application catalog or defines a custom
material. The material chooser defaults to **Custom** and includes the built-in
materials Steel (ASTM A36), Aluminum (6061-T6), PLA, ABS, ASA, PETG, TPU, and
Nylon. Choosing a catalog entry copies its current properties into the analysis
document; the analysis must not retain a live reference that could change when
the catalog is edited later.

Custom exposes the same property editor used for catalog entries. Saving a
valid, named custom material both applies it to the current analysis and adds it
to the browser-local material catalog for later use. Built-in entries are
immutable. User entries may be explicitly replaced or removed, but a save must
never silently overwrite an existing case-insensitive name.

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

Catalog values are engineering starting points, not certification data. The UI
must identify their source/revision and remind users to verify values against
the actual alloy, grade, filament, print orientation, and process. This is
especially important for printed polymers. TPU also requires a prominent
warning that a small-strain linear-isotropic model may be inappropriate for its
normal large-deformation behavior. Do not ship guessed placeholder values.

The active model and material have adjacent rows in the compact setup inspector.
Selecting either row opens its corresponding single editor in place; the
application must not expose competing import or material forms elsewhere in the
tools pane.

### Step 3 — Boundary conditions and loads

The user selects one or more CAD faces and adds:

- a support constraining any nonempty subset of global X/Y/Z translation, with
  zero or nonzero prescribed displacement per enabled component;
- pressure;
- distributed total force;
- gravity/body force.

Boundary-condition selections are stored against geometric face identifiers supplied by the mesher backend, not against triangle or node IDs.

Supports and loads appear immediately in the compact setup inspector with their
type, value/components, units, and face count. Selecting a row highlights its
CAD faces and opens the one corresponding editor in place.

### Step 4 — Mesh

The user selects a mesh preset or custom size and requests a mesh.

Mesh uses one compact, expandable inspector row. Only one mesh exists at a time;
the expanded row permits generation or regeneration and explicit deletion.
Deleting a mesh clears derived mesh/result state while preserving the model,
material, supports, loads, gravity, and current mesh settings.

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

The user explicitly chooses **Solve**. If preflight has not been run and is
available, Solve runs it first and continues after a valid check. Explicit
preflight remains available for inspecting the estimate before solving.

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

A result can then be labeled converged, unconverged, or indeterminate according to Section 13.

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

Which compact setup row is expanded, its focus-return target, and other
transient editor presentation belong to the UI controller. They are not
engineering state and must not be serialized into `AnalysisDocument`.

The active analysis material is engineering state and is stored as a complete
`IsotropicMaterial` snapshot. The checked-in built-in material catalog and the
browser-local user-material catalog are separate from the analysis document.
Likewise, remembered authoring choices such as the last support type and last
surface-load type are UI preferences, not solver inputs. Failure to access
browser storage must not prevent a valid custom material from being used in the
current analysis; report that it could not be retained for future sessions.

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

If remeshing is requested, recreate the mesher worker and re-import the canonical CAD source bytes. Keep the original source bytes and explicit format in application state if memory permits, otherwise retain a file handle/reference and request access as needed.

### 4.6 Runtime modes: direct local files and optional HTTP

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

#### Mode B — Local/static HTTP (optional)

`tools/serve.py` serves local static assets with correct MIME types and COOP/COEP headers. It performs no simulation computation and receives no geometry upload. Cross-origin isolation is detected, but both v1 modes use the validated serial workers. Its absence is not a startup failure.

Threading is a post-v1 optimization. Any future `threaded-hosted` artifact must be separately built, licensed, modeled for peak memory, and numerically/browser validated. It would require `SharedArrayBuffer` and cross-origin isolation; portable mode must never attempt to start pthreads as a capability probe. No UI or documentation may advertise an unimplemented acceleration path.

Run the optional server with `python3 tools/serve.py`. Conventional static hosting may provide the same headers, but hosting is not required for the baseline distribution.

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
 * @property {'step'|'iges'|'brep'} sourceFormat
 * @property {RigidOrientation} orientation
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

Material-library records wrap, rather than replace, the solver-facing
`IsotropicMaterial` contract:

```js
/**
 * @typedef {Object} MaterialCatalogEntry
 * @property {string} id Stable opaque catalog identifier
 * @property {'built-in'|'user'} origin
 * @property {string=} source Human-readable source/revision metadata
 * @property {string=} sourceUrl Safe HTTP(S) provenance link
 * @property {string=} notes Limitations or grade/process notes
 * @property {IsotropicMaterial} material
 */
```

Built-in IDs are stable across releases. Selecting any catalog entry produces a
copy of `entry.material` in the analysis document, so updating or deleting a
user catalog entry cannot mutate an already-applied analysis. Only the
`IsotropicMaterial` snapshot crosses the solver boundary.

Validation:

- `E > 0`
- `-1 < nu < 0.5`
- for ordinary engineering solids, UI should warn on values outside approximately `0 <= nu < 0.5` rather than silently rejecting mathematically valid exotic values;
- all supplied strengths/density must be positive.

Catalog architecture uses immutable factory records, stable opaque IDs, SI values, per-field source/revision metadata, a validated browser-local user library, and independent analysis snapshots. Built-in supplied properties require reviewed evidence; partial or unaudited external catalogs are not authority for added fields. Catalog updates never mutate applied materials. User-created entries default source metadata to User.

PLA includes 62 MPa tensile yield and 70.8 MPa compressive yield; ABS includes 46.1 MPa compressive yield. These bulk reference values retain mixed-source limitations and do not represent certified printed-part allowables. See [material strength evidence](docs/material-strengths.md). TPU's small-strain limitations remain visible.

### 5.3 Boundary-condition model

Use plain component-based support objects and discriminated load objects:

```js
// Support; omitted global components are unconstrained. Fixed is all zeros.
{
  type: 'support',
  faceIds: ['face-id', ...],
  componentsM: { x: 0.0, z: 0.001 }
}

// Pressure; positive means compression into the body
{
  type: 'pressure',
  faceIds: ['face-id', ...],
  pressurePa: 1.0e6,
  direction: 'surface-normal'
}

// Component mode: total distributed global force vector over selected faces
{
  type: 'total-force',
  faceIds: ['face-id', ...],
  forceN: [1000, 0, 0]
}

// Default force mode: sum of local force magnitudes, distributed by area
{
  type: 'total-force', faceIds: ['face-id', ...],
  direction: 'surface-normal', magnitudeN: 1, sense: 'push' // or 'pull'
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
await mesher.importGeometry({ sourceName, sourceFormat, sourceBytes });
await mesher.generateMesh(meshRequest);
await mesher.dispose();
```

`VolumeMeshResult` must contain everything the solver needs without knowing the source mesher:

```js
{
  elementType: 'tet4', // or 'tet10'
  nodePositionsM: Float64Array,
  elementConnectivity: Uint32Array,
  boundaryFaces: {
    solverElementType: 'tri3', // or 'tri6'
    solverConnectivity: Uint32Array,
    solverFaceRanges: /* FaceId ranges into solverConnectivity */,
    triangleConnectivity: Uint32Array,
    faceRanges: /* matching FaceId ranges for display/picking triangles */
  },
  geometryFaceMap: /* FaceId -> boundary range/index mapping */,
  statistics: { /* node/element counts, sizes */ },
  quality: { /* quality summary */ },
  memoryInputs: { /* topology values used by estimator */ }
}
```

Quadratic meshes must retain their six-node boundary faces for load integration.
Rendering, picking, and glyph placement consume a separate linear-triangle
subdivision so those presentation systems do not need element-specific logic.

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

### 5.6 Portable projects and recovery — Plans 30–31

A project defaults to embedded CAD plus the complete committed engineering setup:
source name/format/bytes and identity metadata, orientation, material snapshot
and provenance, supports, loads, gravity, mesh/solve settings, names/IDs, and
project metadata. A user can explicitly include compatible mesh/results and
convergence data. Transient drafts, workers, prepared preflight, undo buffers,
DOM state, and global browser libraries are not saved. Compact project display
choices may be retained separately from global preferences.

Use a versioned manifest with binary entries for source and optional typed
arrays, reusing or extracting the existing stored-ZIP packaging where appropriate.
Declare byte counts, typed-array layouts, units, dependency fingerprints, and
producer/protocol/schema identities. Validate limits and entries before large
allocations; reject unknown required versions, malformed references, nonfinite
engineering values, truncated buffers, and invalid connectivity. No JSON/base64
expansion of large numerical arrays is required.

Open is transactional. Decode and validate in isolation, import the embedded
source, and validate face identity before replacing the current analysis.
Exact source bytes and matching face count alone do not establish a safe mapping.
Require matching per-face identity evidence; ambiguous/revised-engine mappings
use explicit replacement review or fail without changing the installed project.
Never silently guess assignment targets or alter load/support meaning.

Optional mesh/results are reusable only when source/orientation, definitions,
mesh/solver settings, numerical schemas, and producer compatibility all match.
Otherwise explain which cached data cannot be used and reopen validated setup
without it. Restored results are read-only derived state until a relevant edit;
restoring data never restores a worker, check readiness, or a claim of new
numerical validation. Saving does not clear engineering history or invalidate
results. Mark dirty state using persistence changes, including metadata-only
edits, independently of numerical analysis revision.

Recovery uses the same validated setup snapshot, with prompt writes after
committed changes. Store CAD once per source identity and update small setup
records; exclude mesh/results, undo, and half-entered drafts. Startup automatically reopens the previous part/setup. Manual recovery copies
and discard remain under File; conflicts or failures are shown without silently
replacing another active tab.
Maintain bounded records and transactional replacement so interrupted writes
leave a usable prior snapshot. Handle quota/unavailable storage and competing
tabs explicitly, while retaining manual portable save/open on `file://` and HTTP.
Browser recovery is best effort and never reported as a saved portable file.

Version 1 uses the bounded stored-ZIP format in [docs/project-format.md](docs/project-format.md):
2 GiB archive, 512 MiB CAD, 512 MiB total decoded cache, 8 MiB manifest/directory,
2,048 entries. Source SHA-256 and canonical ordered per-face tessellation evidence
must match. Dispose the CAD worker before cache allocation; keep the installed
project until candidate validation completes. Cache results must match the actual
saved mesh; a displayed convergence result from another mesh requires setup-only
save or a fresh solve on the current mesh. No prepared check is restored.

Recovery coalesces synchronous changes into a next-task write, retains four records
and at most 512 MiB referenced CAD, and uses source-keyed Blobs plus transactional
owner/generation checks. Browser Web Locks coordinate record reuse across reloads
and protect live tabs. When full, retirement of the oldest unlocked record and
the new snapshot share one transaction. Automatic restore reuses a record; manual
Open copy creates an independent unsaved working copy. File → New waits for the
latest committed recovery, resets the analysis and records an empty startup state
while preserving preferences/libraries. Open/Save use Ctrl on PC and Cmd on Mac
with O/S; New has no shortcut. No beforeunload warning is installed. Download status describes a request,
not verified disk persistence. Browser/origin storage limitations and allocation
costs are documented with the file format.

### 5.7 Planned engineering extensions and invalidation

Plans 35–37 extend support/load definitions through the same controller,
assignment draft, history, project validation, worker protocol, and report paths.

- Local rectangular frames use validated orthonormal axes and explicit origin/
  ownership. A direction may be global or tied to a supported CAD reference;
  rotation/replacement has a documented transformation and repair rule.
- Planar sliding/symmetry constrains normal translation while tangential motion
  remains free. Symmetry means the modeled symmetry assumption; it does not
  automatically scale loads or represent arbitrary contact.
- Bearing loads declare their cylindrical faces, axis, transverse resultant,
  distribution and sign; the application explains the approximation.
- Distributed moments and offset forces declare target faces, resultant force,
  resultant moment, reference point, and the chosen load-distribution model.

These are planned schemas, not valid existing worker payloads. Exact schemas
are versioned and tested within the owning plan. Missing/incompatible references
block use or enter explicit review. Preflight, constraint rank, equilibrium,
history replay and optional cached-result fingerprints include the new inputs.

Load cases, persistent measurements, and local sizing are post-v1 schema
extensions. Their plans evolve persistence with explicit migration/rejection
rules; collapsed UI never excludes active engineering data.

## 6. CAD Import and Geometry Handling

### 6.1 Supported input

v1 accepts these neutral CAD formats:

- `.step`
- `.stp`
- `.iges`
- `.igs`
- `.brep`

Use Gmsh's OpenCASCADE geometry kernel for import.

The implementation should set OpenCASCADE's target unit so the imported model is normalized to meters before meshing. Do not infer units from filename or UI assumptions.

### 6.2 Import workflow and validation

Selecting a supported file imports and displays the solid directly, without a
repair, unit-assumption or face-recognition review. Preserve CAD face ownership
for loads and supports. Unsupported formats fail before reading the file or
starting geometry work, while retaining the installed analysis. Superseded reads
and worker completions cannot replace a newer import. Replacement of an authored
model retains the explicit support/load mapping review.

For accepted CAD geometry:

1. Confirm at least one 3D volume exists.
2. Require exactly one selected/usable solid for v1.
3. Reject an analysis containing multiple disconnected solids.
4. Check that a closed volume mesh can in principle be generated.
5. Record all geometric surfaces and their IDs.
6. Generate a lightweight preview triangulation associated with those surface IDs.

Preview tessellation must be validated on curved as well as planar CAD. Its
scale-aware chordal/angular quality must be sufficient for selection and visual
inspection, normals/winding must be consistent, and visible CAD feature edges
must not be inferred from incidental preview-triangle edges.

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

Face identifiers are not promised to survive editing/re-exporting source CAD. Project reopen must validate the embedded source and face identity before installing assignments; an ambiguous mapping must enter explicit review or fail safely. Never silently attach a saved load/support to the nearest face. See Section 5.6.

### 6.5 Model orientation

The geometry model owns an orthonormal, determinant-one, row-major 3x3 rotation
and a concise operation history. Imported geometry begins at identity. Users can
rotate the part about global X, Y, or Z by an adjustable signed angle (90 degrees
by default), reset to the imported frame, or align one selected preview-face
normal to a signed global axis. Curved or faceted faces use an area-weighted
preview normal and produce a warning when triangle normals vary materially; a
face with no stable normal is rejected.

Orientation transforms preview positions, normals, feature edges, and final
mesh coordinates without changing opaque `FaceId` values or mutating canonical
source bytes. It invalidates mesh, preflight, and results. Material, supports,
loads, gravity, and selections remain attached and expressed in the global
coordinate frame.

### 6.6 Replacing an authored model

Importing over an authored model opens a side-by-side transfer review. The old view highlights each referenced support/load; the replacement view lets the user map faces or explicitly drop the assignment. Material, gravity, mesh/solve settings, and orientation transfer. The full replacement is installed only after the completed summary is accepted; cancellation preserves the old analysis. Use nearly the available viewport for the two views and show original, mapped, and current-preview glyphs in their respective views.

### 6.7 Model information and selection — Plan 33

Show undeformed bounding dimensions and validated CAD volume in Model, with mass equal to volume times active density when both are available. Missing volume or density is shown as unavailable, never zero. No solve is required; changing presentation or units does not invalidate results. Retain original dimensions in Results and include volume/mass in reports.

Improve small/obscured-face picking directly in the viewport. A contextual pick-through action may cycle the distinct CAD faces under the pointer; temporary Model/Mesh hide/isolate is presentation-only and has an obvious Show all action. Existing support/load rows locate assigned faces. Do not add a long CAD-face catalog. Draft toggle/background/Escape behavior remains as specified in Section 15.6.

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
- near-zero Jacobian count, using `abs(det J) <= 1e-12 * longestCornerEdge³`
  to match native Tet4/Tet10 validation (four quadrature samples for Tet10);
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

For component mode, integrated equivalent nodal forces sum to the requested
vector within numerical tolerance. In normal mode, positive `magnitudeN` is the
sum of distributed local force magnitudes, not necessarily the net vector norm.
Use uniform pressure ±magnitude/selected area, positive for Push and negative for
Pull. Opposing local normals may cancel. In the solver worker, Tri3 uses triangle
area and Tri6 uses the same three-point surface quadrature as native `tri6_area`.
This normalization then calls the unchanged native pressure integration. The
surface-load record (introduced in protocol 2, retained in protocol 4) adds optional normal magnitude/sense; normal loads
omit the preview-only equivalent nodal force array (`null`). No native API or
WASM binary change is needed. Malformed magnitudes and degenerate areas fail
with actionable errors.

#### Gravity

Gravity is applied as a body force:

```text
b = rho * g
```

and therefore requires density.

### 8.6 Component supports

Every support constrains any nonempty subset of global X, Y, and Z displacement
at every unique node belonging to its selected geometric faces. Each enabled
component carries a finite prescribed value in meters. Fixed is an authoring
shortcut for `{x: 0, y: 0, z: 0}`, not a separate engineering data type.

Duplicate constraints must be consolidated. Conflicting prescribed values on the same DOF are a preflight error.

### 8.7 Constraint application

Use a method that preserves the symmetric positive-definite structure when appropriate.

Acceptable v1 strategies:

- elimination/reduced system; or
- symmetric row/column modification with consistent RHS adjustment.

Do not use a large penalty factor as the default constraint method.

### 8.8 Local supports and additional loads — planned

Plans 35–37 must preserve the symmetric positive-definite system assumed by PCG
for a valid constrained linear-elastic model. A local constraint is a linear
condition on nodal translation, not an approximate choice of the nearest global
component. Resolve intersecting local/global constraints per node, rejecting
inconsistent prescribed values and retaining independent constraint directions.
Test rigid-mode removal, transformed displacements, reaction recovery and
equilibrium in global coordinates.

Bearing loading distributes compression on the loaded region of supported
cylindrical faces to produce the requested transverse resultant. The initial
plan explicitly bounds supported cylinder geometry and load distribution;
it is not a contact/friction/bolt-preload model. Verify integrated resultant,
moment, direction, and Tet4/Tet10 boundary quadrature.

A moment/offset load uses a documented surface-traction distribution with the
requested force and moment about its reference point. An offset force produces
the moment `(applicationPoint - referencePoint) × force`. It does not silently
rigidize the surface. Degenerate target regions fail actionably. Tests verify
force and moment balance, reference-point invariance, and mesh convergence;
the UI/report names the loading idealization.

New formulation work requires native and WASM analytical evidence, not only
glyph orientation or a visually plausible contour.

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

The automatic iteration limit remains `max(1000, 10 * DOF)` (saturated to the
32-bit index limit). Every solve also has a default ten-minute PCG elapsed-time
budget, checked between iterations (assembly and recovery are separate).
The browser's optional `solveSettings.maxDurationMs` accepts finite values from
1,000 to 3,600,000 ms; missing values use 600,000 ms for older documents. The
Checks panel lets the user choose 1–60 minutes. This runtime preference survives
setup transfer, does not invalidate accepted physical results, and cannot change
during a worker operation or assignment draft. Native C++ callers can set a
positive finite `max_duration_ms`; the additive C API `fem_set_time_limit`
configures the same budget without changing version-2 structure layouts.
Exhausting either budget returns `SOLVER_NOT_CONVERGED` and publishes no results.
`TIME_LIMIT` is appended to the termination-reason enum without renumbering existing
values. These bounds prevent an ill-conditioned mesh from running millions of
iterations; they do not establish that such a mesh is solvable.

Optional native iteration callbacks report iteration count, relative residual and
elapsed milliseconds initially, no more than once per 250 ms during iteration, and on
convergence or budget exhaustion. A converged report uses the freshly recomputed
residual. The additive `fem_set_iteration_callback` C API leaves version-2 structure
layouts unchanged. WASM callbacks post existing versioned worker progress messages;
the message text includes count, residual, target and elapsed time. Assembly and
recovery status must follow actual native phase transitions, and cancellation by
worker termination remains available throughout.
The controller marks progress-only notifications as `solve-progress` or
`convergence-progress`; the UI
updates status text while the viewport skips geometry, selection and overlay
rebuilds. Engineering state changes still trigger normal rendering.

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

Calibrated v1 policy:

```text
estimatedPeakBytes = 1.5 * modeledPeakBytes
```

The 36-record Chromium/Firefox calibration matrix retained this multiplier.
The maximum measured WASM/model ratio was 0.991525; a 0.25 absolute margin
rounded upward would permit 1.3, but v1 keeps 1.5 because the matrix does not
include successful near-cap allocations and whole-browser overhead is not part
of the solver-only model. See `benchmarks/resource/README.md`.

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

The production build sets a 3.5 GiB practical upper bound for the
single-threaded solver WASM memory and surfaces that limit in preflight. This
stays below the 32-bit WebAssembly address-space ceiling while leaving room for
browser/runtime allocations outside the solver heap. The v1 browser matrix did
not exercise a successful near-cap allocation, so calibration retains this cap.

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
Measured smoothed extrema/ranges use only nodes referenced by the rendered boundary
topology, not unused interior nodes. Stress smoothing takes the mean of recovery
samples within each element, then the unweighted mean of adjacent element
values at each node; this method is unchanged. A sampled peak is not an exact
continuum maximum. Whole-volume recovery
peaks remain unchanged. Clearly identify sample versus surface locations and
retain uncapped engineering FoS independently of the contour mapping.

The von Mises legend and color mapping span zero to the whole-model unaveraged
solver-sample peak. This presentation range is separate from boundary-only range
metadata; the smoothed surface may never reach the top color. Keep the legend title concise and use the selected stress unit. Put the surface maximum and smoothing explanation in the legend tooltip and Results details; adaptive ticks follow Section 11.5.

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

Animation uses the same compact interaction as SpjutSim Truss-2D: a Play/Stop
control, exaggeration slider, and live `xN` readout. The displayed shape follows
`x + animationMultiplier * scale * u`, where the transient multiplier completes
a smooth cosine round trip from full deformation through undeformed and back in
2400 ms. Animation defaults off, pauses while the document is hidden, stops when
Deformation view or current results become unavailable, and never mutates the
analysis document or revision.

### 11.5 Color maps and legends

Each field has an explicit SI range and a unit-labeled legend. Numerical extrema remain unclipped. Manual bounds are finite and strictly ordered; an automatic locked uniform range may have equal endpoints. Values beyond a displayed range use endpoint colors, with clipping indicated. FoS retains its capped mapping and `10+` label.

`viewportPresentation.colorRange` contains `{mode, field, locked, minimum?, maximum?}`. It is presentation state, separate from numerical ranges. Editing either bound chooses Manual. Changing to an incompatible field resets the limits; unit conversion preserves compatible physical limits. A new solve resets limits to Automatic and unlocked.

The legend defaults to vertical, using two to seven height-aware labels; horizontal uses endpoints. Drag the title or use its arrow keys to move it; drag the corner handle or use its arrow keys to resize. Validate and persist compact per-orientation positions/sizes and clamp them to the central viewport. The color ramp fills the available legend dimension.

Use unlit contour materials with sRGB-to-linear vertex conversion so viewport and legend agree. Report captures use the same color function and explicit linear-to-sRGB output conversion. UI themes do not alter numerical colormaps.

### 11.6 Picking and probes

The user should be able to click the rendered surface and see approximate local values for the active field, including:

- coordinates;
- displacement;
- stress metric;
- face ID for developer diagnostics.

Use barycentric interpolation at the clicked rendered point, not the triangle
centroid. One selected-point marker and nearby bounded HTML detail label serve
both surface probes and Locate peak. Raw interior samples are labeled explicitly
and shown through the surface at their undeformed coordinates; surface markers
follow the current deformation. Locate peak does not change the camera. A new
point replaces the old selection; background click, Escape, a second Locate peak
click, or result invalidation clears it.

### 11.7 Result summary

A completed analysis summary should include:

- undeformed bounding dimensions in the study global axes, using selected length units;
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

### 11.9 Reports

Export is available only for current solved results with no pending draft or running operation. DOCX is the default; text/PNG ZIP remains available. Both consume shared result-summary/report content and a dependency-free stored ZIP packager. DOCX provides editable tables, headings, descriptive image text, and correctly proportioned embedded PNGs.

Default content includes model/setup parameters, units, material provenance where matched, assumptions, result and diagnostic values, warnings, and convergence status/table. Text tables use tabs between cells. Default images are assignments, mesh, von Mises stress, optional yield FoS, and Auto deformation. Each uses Reset View then Fit Model, current projection/display units and viewport resolution, automatic field limits, and clean scene output without grid/gizmo/UI chrome or transient selections.

Capture restores camera, selection, probe, overlays, presentation, and animation multiplier even on failure. Revision/result changes abort a stale export. No export mutates engineering state.

**Report customization (Plan 34):** Preserve one-action export with complete defaults. An accessible options action allows a title/notes, selection of available views, and optional current-view capture; remember compact choices and offer Restore defaults. Notes remain user-authored and are escaped as text. Applicable assumptions, units, warnings, result currency, smoothing/deformation explanations, and convergence status cannot be omitted. User-selected views include their actual field, scale, limits, and clipping. Future measurement/case content is added only when those capabilities exist.

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

FoS reverses the stress color ramp: the minimum is red and the maximum is blue,
in both the surface contour and vertical/horizontal legends. Manual or locked
limits retain this ordering; clipped values use the corresponding endpoint color.
Uniform fields retain a finite midpoint color. This is a relative display scale,
not an absolute safety threshold; numerical FoS values and the contour cap stay unchanged.

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
- use of a generic printed-polymer preset without confirmation that its values
  match the actual material and print process;
- use of TPU or another material likely to violate the small-strain,
  linear-isotropic material assumptions;
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

Construct observations of Tx, Ty, Tz, Rx, Ry, and Rz from every enabled global
support component at its constrained points. Center and scale coordinates, then
compute a deterministic rank and nullspace with an explicit tolerance. Before
meshing, use deterministic samples of selected preview faces and label the
result provisional. After meshing, recompute from actual unique constrained
nodes and carry the exact result into solve preflight.

Classify a canonical mode as free only when that axis-aligned mode lies in the
nullspace, and as constrained only when it is absent from every remaining null
mode. Otherwise label the involved axes coupled and report the coupled nullity;
do not present a false per-axis answer. Rank below six is visibly underconstrained.

Also detect near-rigid modes through failure of the SPD iterative solve,
very small or invalid pivots in preconditioner setup, or an optional low-cost
stiffness stability check.

User-facing errors should identify underconstraint as the likely cause rather than exposing only a numerical failure code.

### 14.4 Large-deformation warning

Although the solver is linear, compare maximum displacement with a characteristic model dimension.

Initial heuristic:

- warn if `maxDisplacement > 0.05 * boundingBoxDiagonal`.

This is not a validity proof; it is a warning that geometric nonlinearity may matter.

---

## 15. UI/UX Requirements

### 15.1 Main shell and workspace

Preserve the SpjutSim UI foundation. Keep Setup, Undo, Redo and Save on the left;
group Solve, Results and report format/Export/options on the right. Keep report
controls together when the toolbar wraps. Setup/Results retain
their labels and Truss action icons; toggles use accent and selection-text roles.
The Setup toggle replaces a duplicate pane title. Runtime activity and short
outcomes appear at the right of the menubar; routine history prose stays hidden.

The duplicate top View menu is removed. Keep File, Edit, and Help. Fit/reset,
signed views, and projection remain accessible through labeled, focusable
viewport controls. Preserve keyboard access and reduced-motion behavior before
removing the duplicate menu path. Save is functional through Plan 30; no
other toolbar simplification is requested.

Workspace preferences are separate from engineering state. Persist validated
version-1 pane widths/collapse choices: Setup 220–520 CSS pixels, Results 260–520,
and at least 320 pixels for the viewport in desktop split mode. Below 1000 pixels
only one pane is active; below 680 pixels drawers overlay the full-width canvas
and start closed on entry. Empty Results starts collapsed. Explicit output
commands may open it; ordinary redraws preserve the user's choice.

Canvas/grid children shrink to available space. Panes scroll independently with
stable native gutters. Setup/Results share a 17px right inset, subtracting the
measured gutter with a 2px minimum padding for wide scrollbars. Bounded gizmo,
controls, legend, and probe areas remain usable through resize, browser zoom,
and high DPI; temporary drawer overlap is allowed. Narrow-window robustness
does not imply mobile support.

`showOutputPanel(panelId)` opens a known output tab. Tabs are Checks, Results,
Convergence, and Diagnostics. Checks prioritize actionable repairs,
constraint/memory readiness, and setup links; detailed topology/runtime values
are expandable. Numerical results belong in the output pane.

### 15.2 Setup and editing

Setup is one fixed sequence: Model, Material, Supports, Loads, Mesh. Compact
summaries show source/format/face count, material E/density, and assignment
names/values/units/face counts. Model summaries omit orientation status;
Poisson's ratio remains in the material editor. An ordinary setup fits together
without page scrolling. Support/load names align left with defining values/components on the right. Empty groups offer Add support… / Add load… rows.

A row opens its single editor in place. Move the existing form node between
its stash and active row; do not clone forms or create competing editors.
Material expands independently beneath Model. Apply, cancel, removal, and Escape
return focus to the logical row or Add action. Escape closes the editor before
ordinary face deselection. Expanded editors may have bounded internal overflow.

Material selection previews properties and provenance. Applying a material stores
a snapshot. The user library has unique case-insensitive names, immutable factory
entries, and explicit user-entry replacement/removal. Storage failure does not
prevent using a valid material in the current analysis. See Sections 3 and 5.2.

Mesh is one expandable row with preset/count summary, generation/regeneration,
and deletion. Deleting a mesh preserves source, material, assignments, gravity,
and mesh settings while clearing derived data.

Expanded material/support/load/gravity editors place an action row directly below
the full-width assignment header and above fields. Left-align checkmark plus the
visible word Apply, followed by × and the visible word Cancel. Right-align shared UI Kit
trash Remove with danger styling, hiding it for new items. Keep accessible labels,
hover/focus help and adequate hit areas. Material Cancel restores committed
properties. Put pressure sign and force-direction hints beside their relevant
fields and hide them with those fields.

**Editing language:** use Apply for engineering edits, Save project for
persistence, and Save to material library for catalog storage. Distinguish the
library action from applying the active material. Preserve draft transactions,
unique-name safeguards, and existing keyboard/focus behavior.

**Assignment options:** Duplicate copies a small committed definition
with a fresh ID/name. Suppress/Include controls calculation participation;
suppressed items remain visible and serializable, are excluded from rank checks
and solver inputs, and are labeled in reports. Show/hide controls only glyph
visibility. These changes follow ordinary history, revision and project-schema
rules, including face-reference repair during geometry replacement.

### 15.3 Settings and discoverable advanced controls

Settings is reached through File and Ctrl/Cmd+, using the existing hub. Its
preferred size is 840 × 720 CSS pixels, capped to the viewport; active tab content
scrolls internally. Controls, Units, and Appearance contain preferences.
Engineering material/load/support/mesh inputs remain with their setup editors.

Use one interface with contextual options/advanced disclosures.
The Mesh row has a directly accessible options button; there is no global
advanced-controls enabling step. Formulation changes use the existing mesh
validation/invalidation path. Compact options icons must have meaningful
accessible names, hover/focus explanations, visible focus, keyboard activation,
and adequate hit areas. Menus name the available capabilities; icon color alone
must not encode state. Do not rely on hover-only discovery.

Common setup remains immediately usable. Tet10 stays the production default;
Tet4/debug formulation belongs under advanced mesh controls. Active nondefault
settings remain summarized when controls collapse. Opening a project exposes
the controls necessary to understand its active definitions. Warnings, assumptions,
and result validity remain visible regardless of disclosure preference.
Do not maintain separate simple/advanced data models, validators, or forms.

Future capabilities expose contextual entry points: load cases by Loads,
Pin measurement at a probe, and Local refinement in Mesh. Once created, their
active data stays visible. A load/support type that is physically common may
remain in the ordinary selector despite a complex numerical implementation.

### 15.4 Appearance

Resolve semantic colors from the shared theme contract: background, geometry,
hover, selection, load, support, and XYZ axes. The shared eight authored roles
are `appBackground`, `surface`, `text`, `accent`, `danger`,
`canvasBackground`, `canvasGeometry`, and `selection`. FEA adds
`load`, `support`, `axisX`, `axisY`, and `axisZ`.

Ship FEA Classic, Light Mode, Dark Mode, and Vivid. Persist the active scheme and
versioned library overlay; corrupt/unavailable storage permits in-memory use.
Portable version-3 scheme import/export uses `.spjutsim-color-scheme.json`.
Missing FEA roles receive documented Classic fallbacks. Apply changes live to
CSS and viewport materials; numerical contour colors remain unchanged.

### 15.5 Viewport navigation and presentation

Defaults are orthographic projection and an equal-angle three-face pose.
Reset view uses a cube icon without an Iso label. The signed gizmo provides
±X/±Y/±Z commands with deterministic pole-safe up vectors. Positive labels remain
visible; negative labels/circles appear on hover or focus, and always on no-hover
devices. Gizmo labels respect arrow depth.

Default left drag rotates, right drag pans, wheel/pinch zooms, and arrow keys
rotate unless a control/modal/menu owns the event. Camera gestures preserve face
selection. Suppress the browser context menu only for viewport pan interaction;
clean up pointer capture/cancellation. Rotate/pan can each use any mouse button;
choosing an occupied binding swaps the other one. Hints follow bindings.
Controls settings also allow reverse zoom, sensitivity changes and reset.

Perspective is an independent Display switch. Projection changes preserve target
and apparent scale using `2*d*tan(fov/2)` and corresponding orthographic zoom.
Fit preserves angle; its Truss zoom-to-fit icon sits below-left of the gizmo opposite Reset. Import establishes a fresh reset pose. Fit/reset/signed-view
transitions last 180 ms, honor reduced motion, and cancel on navigation.
Navigation preference version 2 retains valid version-1 bindings/sensitivities.

Model/Mesh/Stress/Deformation remain the primary modes, with contextual options
beneath the centered primary row. Keep the existing field/shape interaction;
combined stress-on-deformed-shape controls are not a committed change. Styles are
shaded, shaded with CAD part edges, and wireframe; model wireframe never exposes
preview tessellation edges. Styles apply across every available mode; Mesh offers element wireframe or edges over a shaded surface. Mesh overlay is independent in result views.
Normalize the legacy `lines` style to `shaded-edges`.

A successful independent mesh generation opens Mesh. The first solve opens von Mises stress. Later solves preserve the previously
selected mode/field/deformation mode/user scale through engineering edits,
drafts, and remeshing; incompatible/unavailable fields fall back explicitly.
Deformation opens with Auto scale; Auto recomputes for the current result.
New results reset contour limits to Automatic/unlocked. Convergence result
updates use the same rule. View changes never mutate numerical results.
Section 11 defines contours, legends, animation, and probe accuracy.

### 15.6 Face selection and assignment transactions

Normal picking supports click, additive selection, and selected-face highlighting.
Existing support/load rows locate their CAD faces. In a face-selection mode,
background click clears ordinary selection even with a modifier; a pan/orbit
gesture does not. Escape clears selection only after higher-priority controls
have declined it. Clicking other UI controls does not clear faces.
The Model editor has no separate face list or Clear selection control.

`assignmentDraft` is the sole controller-owned support/load/gravity transaction:
kind, optional item ID, face IDs, SI definition, base revision, geometry identity,
dirty state, and validation feedback. Commands begin/update/toggle/commit/cancel
the draft; the UI does not own a second engineering copy.

Draft clicks toggle faces, hover previews candidates, background clicks preserve
the set, and Escape cancels. Apply validates values, face ownership, revision,
and conflicting prescribed components before one commit/invalidation. Native
mesh checks remain authoritative for shared-node conflicts between faces.
No-op Apply and Cancel preserve revision, mesh, checks, and results.
Apply clears transient selected faces. Dirty drafts require Apply/Cancel before
changing editing tasks, checking, solving, or starting convergence. Authoring
uses a selectable view; Cancel restores the prior available presentation.
Editing suppresses duplicate old glyphs.

Assignment IDs are stable; default Support/Load numbering increases monotonically
and is never reused. Trimmed nonempty names can be changed without invalidating
numerical results. Adding/editing restores appropriate remembered type choices;
editing an existing item always shows its actual type.

Initial Force is surface-normal magnitude 1 N with Push/Pull. Component force
defaults to [0, 1, 0] N; pressure defaults to 1 MPa. Explain constant pressure
versus total force across all selected faces, including cancellation of opposing
normal directions. Gravity uses the same transaction with no face selection,
global components/presets, Apply, Cancel, and Remove. Gravity arrow visibility
is separate from calculation enablement; enabling it restores its arrow.

### 15.7 Loads/support glyphs

Use deterministic samples on actual surfaces, retaining local normals.
Planar faces use regular grids; curved/trimmed faces use bounded area-stratified
candidates and farthest-point spacing. Area and face span determine coverage,
including thin faces. Use at least six samples per nondegenerate face, target
spacing one quarter of the model's largest extent, and a 128-sample face cap.
The cap may exceed the spacing target. Cache per geometry/mesh; reuse unchanged
resources and coalesce overlay updates to one animation frame.

Arrows use thin cylinders and cone heads; load-arrow tips touch the surface.
Pressure and normal force follow local normals; component force/support glyphs
follow their defined directions. Count and size never encode magnitude.
Loads default red and supports green via theme roles. Display separately controls
load/support/gravity visibility; active valid previews remain visible. Dispose
replaced geometry/material resources.

### 15.7.1 Viewport axis triad

A labeled XYZ triad uses a dedicated orthographic overlay at the lower-left,
inverse camera rotation, cleared depth, and no picking participation. Layout
uses screen pixels: 30px axes, 21px square labels, and a safe inset keeping all
tails/heads/labels within bounds at every rotation. Navigation gizmo hit targets
are separate and never select model faces.

### 15.8 Units

Engineering state, worker input, results, and stored contour limits remain SI.
All numerical fields show adjacent units. One validated browser-local preference
owner supplies SI/USCS and named custom sets to authoring, summaries, probes,
convergence, and reports; inline force/pressure/result controls update that owner.
Do not resurrect separate load-unit persistence.

Mechanical SI defaults use mm, N, MPa strength/stress, GPa modulus, and kg/m³.
USCS uses inches, lbf, psi pressure/stress, and ksi material properties.
Force input offers N/kN/lbf/kip; pressure MPa/Pa/psi/ksi; result stress
Pa/kPa/MPa/GPa/psi/ksi; displacement m/mm/in. Conversion uses the international
pound and inch with standard gravity:
`1 psi = 0.45359237 * 9.80665 / 0.0254² Pa` and `1 in = 0.0254 m`.

Changing units converts existing physical values atomically, preserves blank
draft fields, rejects invalid conversions without partial updates, and never
changes source-file interpretation, engineering revision, mesh, or valid results.
Display small values in scientific notation; do not round stored SI values.

Custom sets support Save copy, name-based save/rename, updates to the active saved
set, and Delete retaining current values as Custom. Names are unique. Invalid
stored preferences fall back safely; unavailable storage leaves session choices
usable and reports persistence failure.

### 15.9 Help, contextual feedback, and accessibility

Preserve semantic HTML and ARIA state for menus, tabs, switches, dialogs,
disclosures, and listboxes. Native inputs remain the semantic basis of enhanced
controls. Keyboard focus and reduced-motion support are required throughout.

The empty viewport offers CAD import/drop and an explained local cube example with material, three component symmetry supports, a 1,000 N axial load and normal
Tet10 mesh settings already applied. Its 1 m cube uses E = 200 GPa, ν = 0.3;
expected axial stress is 1 kPa, axial extension 5 nm. Examples are deliberately
loaded offline and never silently solved. No placeholder solid is shown.

A small guide in the viewport points to and highlights the actual next clickable
control, not section headings. The opening panel appears alone; explicitly
starting Help guidance on an empty project replaces it with guidance pointing to
the Model button. Start after CAD import, allow Back/Next and easy × dismissal,
remember dismissal, and expose Help → Show setup guide. Guide display never
steals focus or changes engineering state. Highlight an editor opener/Add while
closed. For support/load drafts with no faces, point into the model and instruct
face selection. Highlight Apply once at least one face is selected; return to face
selection if all faces are deselected. Existing assignments with faces and gravity
skip this picking phase. Highlight Add again after support/load Apply or Cancel.
Draw a separate, noninteractive highlight ring at document level around the full
button so clipped controls cannot hide its top/bottom edges. Keep the selector's
normal dividers and keyboard-focus styling. Hide the ring during model picking,
when its target is hidden/scrolled out of view, and when the guide is dismissed.
Successful material Apply immediately advances to Supports; failed Apply stays on
Material. Support/load actions change targets, not stages; routine rerenders neither scroll
Setup nor advance the guide. User-driven stage changes may reveal their target
by scrolling Setup, but do not open editors or click controls automatically.
Teach Import → Material → Supports → Loads → Generate mesh → Inspect mesh → Solve
→ Review results. Mesh guidance highlights the Mesh opener, then Generate mesh.
Beginner guidance discusses density and refinement without naming element
formulations. Inspection highlights the Mesh view button and explains refinement around holes,
small features and loads, plus convergence. The prepared cube begins at Generate
mesh. Recovered projects stay quiet. No
next-step banner or routine persistence prose belongs above Model. Report and
mesh options use shared UI Kit SVGs with 20px icons, 30px desktop targets and 44px
coarse-pointer targets.

Use concise contextual explanations for terms such as Poisson's ratio, von Mises,
mesh quality, convergence, and memory. Field errors belong beside their inputs;
assignment failures belong in the active editor; worker progress uses shared
status. Link cross-cutting errors to the repair location. A failed Apply focuses
the first invalid field; avoid repetitive alerts while a number is being typed.

Group readiness identifies the next useful action. Results lead with displacement,
stress, available yield FoS, and convergence, with numerical detail expandable.
Warnings remain visible. Do not duplicate the same error across multiple panels.

### 15.10 Solve workflow and history

`solveReadiness(document)` owns check/solve readiness and actionable explanations.
Solve opens Checks, prepares preflight, and continues when valid, opening Results during execution. A current
prepared worker, matching revision, memory cap, and required >=8 GiB confirmation
remain mandatory. Import, mesh completion, edits, display changes, and opening
reports do not independently trigger checks. Disposed/failed/cancelled workers
require fresh checks on retry. Ignore late replies from replaced workers even
at the same analysis revision.

`lastSolveCheck` retains only compact diagnostics/revision for inspection.
Engineering edits invalidate dependent state; presentation/name-only edits do
not. A stale report never authorizes execution.

When setup is complete but a mesh is missing/stale, an explicit
Mesh and solve action may perform meshing → checks → solve with visible stages,
cancellation, the same validation/memory gates, and no concurrent mesher/solver
heaps. Independent mesh generation and Run checks only remain available.

Engineering Undo/Redo stores at most 50 compact commands / 2 MiB of UTF-8
definitions, evicting oldest deterministically. An oversized command clears
incompatible history. Commands cover committed material/gravity/assignment/mesh
settings/orientation changes and preserve IDs/order. They exclude CAD bytes,
mesh/results, workers, and WASM. Undo uses ordinary validation/invalidation and
never rewinds revision or ID/name allocators. Rename replay preserves results.

New edits discard redo; no-ops/cancelled drafts add nothing. Import, replacement,
and removal clear history after validation. Drafts and worker execution disable
history. Generation/solve/convergence are not replayable commands. Edit-menu and
toolbar descriptions identify the available command; platform shortcuts respect
text editing, IME composition, modals, Settings, and unhandled browser commands.

### 15.11 Delivery and acceptance

[The plan index](docs/plans/README.md) owns sequence and review checkpoints.
Plans 21–27 have recorded owner acceptance; Plans 28–34 have implementation
verification. Approved future work is still planned, not implemented.

Each delivery supplies focused regressions, applicable full-suite evidence,
one complete-diff review, and its owner walkthrough. Grouping checkpoints is
allowed when explicitly requested by the owner. Final integrated usability
acceptance precedes Task 20's exact-artifact candidate audit. Historical test
passes cover only their original inputs; changed behavior needs fresh evidence.
No plan or documentation update grants tagging/publication permission.

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
- face-selection state, including background-click and unconsumed-`Escape`
  clearing without clearing after camera drags;
- deterministic support/load auto-naming, non-reused sequences, form/list
  ordering, and independent remembered authoring types across add/edit/cancel;
- built-in material catalog validation, catalog-to-analysis snapshot copying,
  custom-material save/replace/remove behavior, storage failure handling, and
  preservation of existing analyses when catalog entries change;
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

Maintain several small CAD + analysis fixtures with reference results generated by a mature solver such as CalculiX or another trusted FEA package.

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

Numerical release validation must reject failed benchmark outcomes, preserve
the signs of compared displacement/reaction components, and recompute relative
errors from the recorded actual and reference values. A structurally valid
failure record does not satisfy release acceptance.

### 16.3 Regression fixtures

Each solver/mesher release should run a fixed corpus containing:

- tiny simple solids;
- thin features;
- holes;
- fillets;
- highly curved surfaces;
- mixed small/large geometric scales;
- purposely troublesome STEP, IGES, and BREP files.

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

Every repetition in the release resource matrix must complete successfully,
with final relative residual at or below its recorded solver tolerance.
Failed, cancelled, or preflight-blocked runs remain diagnostic evidence and
cannot fulfill the successful-run requirement.

---

## 17. Milestones and Definition of Done

The original development milestones remain useful evidence categories:

| Milestone | Delivered capability | Required evidence |
| --- | --- | --- |
| 0 — Portable foundation | Static shell, local assets, separate file-safe workers/WASM, optional HTTP | Direct-local and HTTP startup without an application build pipeline |
| 1 — Geometry/meshing | CAD solid import, face identity, preview, tetrahedral mesh and sizing | Stable remesh selections, curved/planar geometry and classified 50-entry corpus |
| 2 — Trusted Tet4 | Isotropic elasticity, global component supports, loads, CSR/PCG, reactions | Patch/analytical tests, failure diagnostics, cancellation and memory preflight |
| 3 — Production Tet10 | Quadratic geometry/loading/recovery, bounded sparse assembly | Native/WASM reference benchmarks, quality gates and resource calibration |
| 4 — Results/trust | Contours, deformation, raw/smoothed peaks, FoS, probes and global convergence | Numerical acceptance in Section 16, singularity distinctions, stale-state handling |

These implemented milestones alone do not establish v1 readiness. The additional
pre-v1 feature plans, final integrated owner review, Section 26 checklist, and
Task 20 exact-candidate audit must also pass.

Post-v1 plans are sequenced separately in [docs/plans/README.md](docs/plans/README.md):
load cases, persistent measurements, local mesh control, interior inspection,
shells, orthotropic materials, modal analysis, and thermal expansion. Their
validation and architecture work are not v1 release gates. Onshape acquisition
and material metadata integration remain separate future candidates; no network
integration or new dependency is authorized by this specification.

---

## 18. Repository/Module Boundaries

Use cohesive modules with explicit data flow. Split distinct responsibilities,
not arbitrary line counts; avoid generic abstractions for hypothetical reuse.

| Location | Responsibility |
| --- | --- |
| `web/index.html`, `web/css` | Application markup and simulation-specific styling |
| `web/ui` | Copied generic SpjutSim controls, menus, themes and settings primitives |
| `web/js/app.js` | Application composition and operation wiring |
| `web/js/analysis` | Engineering contracts, controller/invalidation, history, material catalog, solver input, results and convergence |
| `web/js/geometry`, `web/js/mesh` | CAD/orientation contracts and typed mesh/display contracts |
| `web/js/render` | Viewport, navigation, glyphs, presentation and clean scene capture |
| `web/js/ui` | App-specific authoring, workspace, unit preferences, result/report UI |
| `web/js/workers` | Worker clients, protocol validation and local bootstrap |
| `workers` | Human-maintained mesher and solver worker entry points |
| `native/fem` | Independent C++ numerical core, C ABI and native tests |
| `native/wasm` | Browser/WASM bridge |
| `web/vendor`, `web/wasm` | Pinned third-party assets and solver runtime |
| `web/generated/local-runtime` | Reproducible file-safe worker/runtime wrappers |
| `tools`, `tests`, `benchmarks` | Packaging/audits, Python/native/browser verification, numerical/resource evidence |

Dependency rules:

- UI/rendering consume application contracts; DOM widgets do not own engineering state.
- Controller/model owns commands, invalidation, revisions, and operation lifecycle.
- Native FEM does not depend on Gmsh or CAD entity tags.
- Renderer does not depend on sparse-matrix internals.
- Generic `web/ui` helpers do not depend on simulation data.
- Worker clients own cross-boundary protocols; large buffers use explicit ownership.
- Project codecs/recovery share validation but stay separate from DOM and solving.
- Simple/expanded presentation uses the same state and controls.

Dense first-party code should be made readable when touched, with existing
behavior preserved. Shared result formatting and unit rules have one owner.
Feature plans include relevant cleanup and performance checks; avoid an unrelated
whole-repository rewrite. Vendored/generated source stays separate and is never
hand-edited to implement application behavior.

### 18.1 UI source ownership

The `/web/ui` files are a project-owned snapshot/evolution of the SpjutSim UI foundation. They are not installed from npm, loaded from a CDN, or treated as an opaque vendor dependency.

When the generic UI foundation changes:

- keep reusable shell/control behavior generic;
- place app-specific panels and commands under `/web/js/ui`;
- document non-obvious loading order between legacy/global helper files;
- update in-repository callers together when helper APIs change; this alpha has
  no backwards-compatibility requirement and needs no legacy adapters.

### 18.2 Vendored dependencies

`/web/vendor/three` and `/web/wasm/gmsh` are third-party vendored dependencies and should be kept distinct from first-party UI/application code.

`THIRD_PARTY.md` should record versions, licenses, source locations, and build flags/checksums as practical.

---

## 19. Worker Message Contracts

Worker APIs should be versioned, coarse-grained, and represented as plain JavaScript objects plus transferable buffers.

The current worker envelope protocol is version 4, as defined in
`web/js/workers/worker-protocol.js`. Mesher requests provide source bytes,
format/name, geometry identity, orientation/settings, and expected face identity
for the operation. Solver preparation transfers the validated mesh/material/
boundary/load definitions; solve runs against the prepared worker and matching
analysis revision. Cancellation/replacement invalidates that worker identity.

The executable validators and typed contracts define exact request/response
fields. Do not maintain stale schematic payload examples here as a second API.
Any change requires synchronized client/worker/native validation, protocol or
schema versioning as appropriate, regression tests, and regenerated wrappers.

Large arrays must be sent as transferable `ArrayBuffer`s where ownership can move safely instead of being structured-cloned.

Results should return visualization-ready typed buffers rather than millions of JavaScript objects.

Worker responses should include:

- `protocol`;
- `requestId`;
- a stable response/event type;
- progress stage where relevant;
- structured error data on failure.

Do not make the main thread depend on Gmsh wrapper objects or C++/Emscripten-generated class bindings.

Result schema version 2 requires `rangeMetadataVersion: 1`. Each base
rendered field range records `locationOwner: "surface-node"`, boundary-only
minimum/maximum, their node indices and SI locations. Ties use the first node
encountered in boundary connectivity. Raw extrema record
`locationOwner: "solver-sample"`, their value, sample index, owning element,
exact Float64 recovery position, and `isInterior: true` for the current Tet4
centroid/Tet10 quadrature recovery rules. `nearbyBoundaryFaceId` (also retained
as the legacy `faceId` for convergence grouping) is a nearby boundary hint, not
the sample's physical location. Displacement maximum remains a whole-volume
node extremum (`locationOwner: "volume-node"`). Validators reject contradictory
values, ownership, node/sample linkage, nonfinite positions, or range metadata.
The von Mises display range is derived separately as zero to
`extrema.rawVonMisesMax.valuePa`; it never overwrites `ranges.vonMises`.

FoS retains uncapped boundary minimum/maximum and node locations separately
from finite color-mapped values capped at 10. The FoS contour's range is the
actual capped boundary range, with clipping explicitly indicated.
Native solver values and the worker envelope protocol version remain unchanged;
older unversioned postprocessing results must be regenerated.

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

### 20.1 Performance and maintainability during expansion

Measure affected operations against a recorded baseline: import/open, committed
edit, recovery write, report capture, picking, repeated solve/replacement, and
cancellation as applicable. Record browser, fixture size, timing, retained buffers,
and peak-memory observations. Reuse current numerical/resource targets; do not
invent a universal element cap or unmeasured speed claim.

Cache data by its actual dependencies. Reuse compatible geometry/mesh for
material/load edits, bound result retention, and never persist the entire live
document on every keystroke. New result comparisons retain small summaries and
load bulk fields on demand. Do not deep-copy mesh/results for drafts/history or
advanced-panel expansion. Avoid repeated whole-mesh traversals and unnecessary
DOM/GPU rebuilds; process bulk work off-thread when it would block interaction.
Disposal/cancellation tests cover success, failure, replacement, and repeated use.

Cleanup preserves module boundaries in Section 18 and readability of first-party
source. Performance changes retain numerical tolerances, determinism, error
handling, and explicit fallback behavior. Every feature plan owns its affected
performance checks; the final review tests the combined workflow.

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

On 2026-09-06 the copyright holder approved GPL-2.0-or-later for first-party
SpjutSim FEA code and the copied UI foundation files. This does not relicense
the separate UI Kit project or override third-party notices. The decision and
final-review status are recorded in `docs/release/distribution-policy.md`.

Gmsh is GPL-2.0-or-later, and common browser WASM packages statically include Gmsh/OpenCASCADE. Distribution of that WASM artifact carries Gmsh's license obligations unless a separate commercial license is obtained.

The v1 path is GPL-compatible source accompaniment. Each browser/folder release
includes exact application source, pinned upstream source archives, notices,
and build instructions. `docs/release/artifact-manifest.json` covers all
vendor/generated assets and UI provenance. `tools/audit-distribution.py` checks
hashes, coverage, local runtime URLs, source/build references, and policy
consistency; its staged-release mode also verifies actual corresponding-source
archive contents. `tools/package-distribution.py` creates the local source-
accompanied stage. These are narrow Python packaging steps, not frontend tooling.

Wrangler serves only that stage and requires a successful audit with final owner
review bound to the artifact-manifest hash. A missing/blocked decision, missing
source package, or stale final review prevents publication through that path.
The literal URL audit is supplemented by offline browser verification. Final
owner review and Task 20's complete candidate acceptance remain separate gates.

Keep the mesher isolated behind its backend contract. A future proprietary
release requires adequate rights to all retained code or a separately designed
backend replacement; it does not revoke rights granted for earlier GPL versions.
CAD authoring and first-party mesher/kernel replacements remain outside v1.

This licensing question is one reason the mesher abstraction is a v1 architectural requirement rather than cleanup work.

---

## 23. Security and Privacy

For v1:

- all geometry and analysis computation occurs locally;
- do not upload CAD files or meshes to an application backend;
- analytics, if added, must not include geometry or material/analysis payloads;
- in-memory imported data is released on close/replacement; local recovery retains only the explicitly managed recoverable project and provides a clear discard action;
- worker termination is the preferred cleanup mechanism for large WASM heaps.

Third-party scripts/assets should be minimized and stored with the application. Direct-local mode must not depend on remote CDNs. Optional HTTP mode should use same-origin resources so cross-origin isolation remains straightforward.

---

## 24. Decisions and Evidence

Locked numerical/runtime choices are defined in their owning sections: production
Tet10 (7–8), scalar CSR/PCG/Jacobi and solver budgets (9), calibrated 1.5 memory
multiplier/3.5 GiB WASM cap (10), and serial direct-local/HTTP execution (4).
Do not reopen them without independent numerical and resource evidence.

Further optimization of meshing algorithms/quality thresholds, block-CSR,
stronger preconditioning, broader browsers, or threading requires measurements
against the current validated path. A desktop wrapper is optional future work;
it is not needed to satisfy the local-browser requirement. Any module-loading
change must preserve direct-local operation.

New-physics plans explicitly begin with a formulation/data-contract decision and
a reproducible benchmark before production integration. Their scoped first
deliverables and exclusions belong in the plan, not an undocumented fallback.

---

## 25. Implementation Sequence and Review Ownership

[docs/plans/README.md](docs/plans/README.md) is the single sequence/status index.
Plans state their deliverable, dependencies, affected modules, validation,
performance constraints, and owner walkthrough. Implement in the current agent
under repository instructions unless the owner requests otherwise.

Completed Plans 31/32 were renumbered to 28/29 on 2026-09-22. The former STL
Plans 28/29 remain archived on `features/stl-import`; their evidence does not
apply to the newly numbered plans. The former integrated Plan 30 is now Plan 38.
Dated review records preserve original commits, test counts, browser versions,
and historical artifact paths.

Plans 30–37 deliver the agreed pre-v1 additions, then Plan 38 verifies their
integrated usability. Task 20 finally audits the exact candidate. Plans 39–46
are post-v1 and do not delay that release. Feature-local keyboard, failure,
cancellation, resource, and numerical checks run within each plan; the final
review verifies the combination and does not defer known defects.

---

## 26. v1.0 Acceptance Checklist

The project is ready to call v1.0 only when all of the following are true:

Checked items below have repository evidence summarized in
`docs/release/v1-acceptance-audit.md`. Unchecked items remain release blockers;
an implemented code path is not sufficient without the required release
evidence.

- [x] STEP, IGES, and BREP import work on the agreed CAD regression corpus at an acceptable success rate.
- [x] Axis rotation and selected-face alignment preserve global setup state and invalidate stale mesh/results.
- [x] Exactly-one-solid restriction is enforced clearly.
- [x] CAD face selections survive remeshing within an analysis session.
- [x] Tet10 is the default production element.
- [x] One-, two-, and three-axis supports, prescribed displacement, pressure, total face force, and gravity work.
- [x] Force integrations and reactions satisfy equilibrium checks.
- [x] First-party sparse assembly avoids unbounded triplet-memory growth.
- [x] Production solver does not require a third-party sparse linear-algebra library.
- [x] Frontend runs without npm, React, TypeScript, Vite, or a framework/transpile JavaScript build step.
- [x] Primary supported desktop browser completes the full import -> mesh -> solve workflow when `index.html` is opened through `file://`.
- [x] Direct-local mode does not require `SharedArrayBuffer`, cross-origin isolation, a server process, or a network connection.
- [x] Direct-local meshing and solving remain off the UI thread using the tested file-safe worker path.
- [x] Optional HTTP mode detects cross-origin isolation, retains the serial path,
  and does not advertise deferred threaded acceleration as available.
- [x] SpjutSim UI source is internalized and the application shell works from repository-local files only.
- [x] Compact Model/Material, Support, and Load summaries are visible together
  for an ordinary setup and every item can be selected and edited in place.
- [x] PCG failures are diagnosed rather than returned as plausible results.
- [x] Pre-solve memory estimate is shown for every solve.
- [x] Device-memory hints are optional and absence does not break the app.
- [x] >= 8 GiB estimated solves show an explicit high-memory warning/confirmation.
- [x] Configured WASM heap limit is enforced before solve allocation.
- [x] Solver and mesher run off the UI thread.
- [x] Worker cancellation works.
- [x] Deformed shape and required scalar contours render correctly.
- [x] Raw and smoothed stress peaks are distinguished.
- [x] Maximum displacement, stress extrema, reactions, and solver statistics are reported.
- [x] Yield-based von Mises factor of safety works when strength data is supplied.
- [x] Mesh convergence workflow is complete.
- [x] Global convergence vs unresolved peak stress are reported separately.
- [x] Likely stress singularities produce a clear warning.
- [x] Analytical and reference-solver validation tests pass agreed tolerances.
- [x] Memory-estimator calibration tests have been run on supported browsers.
- [x] Licensing/distribution posture for Gmsh has been resolved.
- [x] Responsive workspace/overlays and owner review M21 are accepted.
- [x] Boundary-only contour extrema, result explanation, and owner review M22 are accepted.
- [x] Orthographic/isometric and signed views and M23 are accepted; View-menu removal has fresh command-access checks in the Plan 32 review.
- [x] Contextual display controls, independent mesh edges, vertical/horizontal legends, and M24 are accepted.
- [x] Transactional load/support previews and M25 are accepted.
- [x] Readable setup and the reviewed check-then-solve workflow and M26 are accepted.
- [x] Bounded engineering edit undo/redo and M27 are accepted.
- [ ] Portable projects reopen complete setup with verified face identity; optional mesh/results are validated before reuse.
- [ ] Bounded local recovery handles interruption, unavailable storage and explicit restore/discard without losing the installed analysis.
- [ ] Model volume/mass and viewport selection improvements pass unit, draft, keyboard and file-mode checks.
- [ ] Contextual advanced controls preserve active-setting visibility; View-menu removal preserves all commands; editing/status language is consistent.
- [ ] Default reports remain complete, and optional customization preserves numerical context and capture restoration.
- [ ] Local directions and sliding/symmetry supports pass native/WASM constraint, rotation and reaction benchmarks.
- [ ] Bearing loads and moment/offset forces pass integrated force/moment, convergence and resource checks.
- [ ] Integrated post-change regression and owner usability review M38 are accepted.
- [ ] Task 20 binds all required evidence to the exact final candidate after the pre-v1 plans and accepted M38; release authorization is recorded.

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
| CAD format | STEP, IGES, and OpenCASCADE BREP; STL and OBJ unsupported |
| Geometry | One closed solid body |
| Geometry kernel | OpenCASCADE through Gmsh |
| Mesher | Gmsh, isolated behind replaceable interface |
| Prototype element | Tet4 |
| v1 production element | Tet10 |
| Physics | 3D small-strain linear static elasticity |
| Material | Homogeneous isotropic |
| Solver | First-party C++ -> WASM, scalar CSR + PCG |
| Execution | Dedicated serial Web Workers in both v1 launch modes; threading deferred |
| Baseline launch | Direct `file://` open on the primary supported browser |
| HTTP server | Optional Python/static server with COOP/COEP; no simulation backend |
| JS package manager | None |
| Frontend | Plain JavaScript, classic-script-compatible baseline; no bundler/transpiler requirement |
| UI foundation | SpjutSim UI source copied into project and adapted directly |
| Visualization | Vendored Three.js |
| Third-party runtime code | Gmsh/OpenCASCADE and Three.js |
| Memory | Mandatory pre-solve estimate; Device Memory API advisory only |
| High-memory warning | Explicit warning at >= 8 GiB estimate plus device-relative heuristics |
| Convergence | Global remeshing study required for v1 trust workflow |
| v1 release bar | Validated static workflow, Plans 30–37, accepted M38 and exact-candidate Task 20 |
| Onshape API | Post-v1.0 |
| Orthotropic printed-part model | Post-v1.0 |
