# Replaceable solid-repair adapter

Only the native adapter files know CGAL types. ABI version 2 accepts bounded normalized
Float64 vertices, Uint32 triangle indices and a local fill-width ratio. It returns
an indexed candidate, original vertex/face provenance and changed-face flags.
Codes: 0 candidate, 1 invalid input, 2 resource limit, 3 construction failure,
4 unsupported boundary or component arrangement. Adapter success is never acceptance.

CGAL 6.1.1 exact-construction intersection refinement subdivides intersecting
facets and extracts the solid boundary. Unaffected exterior facets retain their
original coordinates. A pinched vertex may be duplicated without displacement.
Only enclosed inward voids within the explicit local fill-width limit may be
filled; separate exterior bodies are never discarded. The worker restores exact
source vertices, serializes Float64 coordinates, runs every strict check, and
presents localized material changes for explicit acceptance.

The adapter has no filesystem, network, Gmsh, solver, rendering, STL-format or UI
dependency. A future kernel can replace it behind the indexed-array interface.
No CGAL objects or entity identifiers cross the boundary.

`surface.cpp` exposes independent surface ABI version 1: normalized indexed
triangles, engineering-group IDs and per-source-facet size targets in; indexed
boundary and group ownership out. Its graded BVH field matches the JavaScript
volume field. CGAL isotropic remeshing uses split/collapse/flip/projection, protects
selection seams and 40° ridges, forbids constrained-edge collapse and disables
relaxation (which introduced folds in a gargoyle probe). The worker enforces strict
checks and bounded local fidelity refinement before returning a boundary. This
worker terminates before Gmsh starts; no two meshing WASM heaps coexist.

Build with `python3 tools/build-stl-repair.py`, using pinned Emscripten 3.1.74.
The recipe verifies CGAL/Boost archive hashes and embeds a serial worker runtime.
CGAL's `CGAL_ALWAYS_ROUND_TO_NEAREST` expands interval results with `nextafter`,
without relying on unsupported WASM hardware rounding-mode changes. Exact
constructions use CGAL's rational MP_Float fallback. GMP and MPFR are not linked.

Limits: 200k input/output facets, 600k vertices, 2 million
intersection events, 512 MiB WASM ceiling. The client applies one 120-second deadline
across cleanup and reconstruction and terminates workers on cancellation.
Packaging is capped at 2 MiB raw / 768 KiB gzip for the embedded runtime.

First-party adapter source remains GPL-2.0-or-later. The linked CGAL adapter is
distributed under GPL-3.0-or-later; CGAL includes GPL-3.0-or-later and
LGPL-3.0-or-later code, and Boost uses BSL-1.0. See local notices and the exact
source-accompanied distribution procedure. No commercial license is claimed.

Native ABI regression (after fetching headers with the build recipe):

```sh
g++ -std=c++17 -O2 -DCGAL_DISABLE_GMP=1 -DCGAL_DISABLE_MPFR=1 \
  -DCGAL_DO_NOT_USE_BOOST_MP=1 -DCGAL_ALWAYS_ROUND_TO_NEAREST=1 \
  -Ibuild/stl-solid-repair/CGAL-6.1.1/include \
  -Ibuild/stl-solid-repair/boost_1_83_0 \
  native/stl-repair/repair.cpp native/stl-repair/test.cpp \
  -o build/stl-solid-repair/adapter-test
build/stl-solid-repair/adapter-test
```

Keep assertions enabled for this regression. Browser tests independently check
strict topology/intersections, worker cancellation and explicit material consent.

The surface regression uses the same compiler flags, replacing the two source
arguments with `native/stl-repair/surface.cpp native/stl-repair/surface-test.cpp`.
It checks an elongated closed box, preserved volume/groups, refined long edges,
and invalid input. The combined embedded runtime is 1,484,193 bytes (482,670 gzip).

Surface bisection permits up to 600k temporary facets before collapse, while exported
boundaries remain capped at 200k. A coordinate-keyed cache retains at most 500k
immutable size-field values; the worker heap remains capped at 512 MiB.
