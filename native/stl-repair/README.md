# Replaceable solid-repair adapter

Only `repair.cpp` knows CGAL types. It exposes ABI version 1: bounded normalized
Float64 vertices and Uint32 triangle indices in; a candidate indexed surface out.
Return codes are 0 (candidate), 1 (invalid input), 2 (resource/work bound), and 3
(construction failure). The worker owns serialization, strict STL validation,
provenance and user review. An adapter success is never an acceptance certificate.

CGAL 6.1.1 Alpha_wrap_3 constructs an enclosing surface directly from triangle
soup, including intersecting input. This avoids an additional intersection-splitting
or Boolean dependency. Wrapping may join components, fill gaps, and round details;
construction parameters are not an application-certified maximum deviation.

The adapter has no filesystem, network, Gmsh, solver, rendering, STL-format or UI
dependency. A future kernel can replace it while preserving the candidate protocol.
No CGAL objects or entity identifiers cross the boundary. Output facet ownership
is new; source assignments must use the normal replacement workflow.

Build with `python3 tools/build-stl-repair.py`, using pinned Emscripten 3.1.74.
The recipe verifies CGAL/Boost archive hashes and embeds a serial worker runtime.
CGAL's `CGAL_ALWAYS_ROUND_TO_NEAREST` expands interval results with `nextafter`,
without relying on unsupported WASM hardware rounding-mode changes. Exact
predicate fallback uses CGAL MP_Float. GMP and MPFR are not linked.

Limits: 200k input/output facets, 600k vertices, 100k Steiner insertions, 2 million
flood-fill steps, 512 MiB WASM ceiling. The client applies one 120-second deadline
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
