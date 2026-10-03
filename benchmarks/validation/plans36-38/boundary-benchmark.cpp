// Standalone measurement driver; no volume stiffness assembly or solve.
#include "spjutsim/bearing_load.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>

using namespace spjutsim::fem;

void make_band(unsigned segments, unsigned nodes_per_face, Mesh &mesh,
               SurfaceLoad &load) {
  for (unsigned i = 0; i < segments; ++i) {
    const double angle = 2 * std::acos(-1.) * i / segments;
    for (double z : {0., 1.})
      mesh.node_positions_m.insert(mesh.node_positions_m.end(),
                                   {.5 * std::cos(angle), .5 * std::sin(angle), z});
  }
  for (unsigned i = 0; i < segments; ++i) {
    const auto a = 2 * i, b = 2 * ((i + 1) % segments);
    for (auto triangle : {std::array<unsigned, 3>{a, b, b + 1},
                          std::array<unsigned, 3>{a, b + 1, a + 1}}) {
      load.triangle_connectivity.insert(load.triangle_connectivity.end(),
                                        triangle.begin(), triangle.end());
      if (nodes_per_face == 3) continue;
      for (auto edge : {std::array<unsigned, 2>{0, 1}, {1, 2}, {2, 0}}) {
        Vector3 middle{};
        for (int axis = 0; axis < 3; ++axis)
          middle[axis] = (mesh.node_positions_m[triangle[edge[0]] * 3 + axis] +
                          mesh.node_positions_m[triangle[edge[1]] * 3 + axis]) / 2;
        const double radius = std::hypot(middle[0], middle[1]);
        middle[0] *= .5 / radius;
        middle[1] *= .5 / radius;
        load.triangle_connectivity.push_back(mesh.node_positions_m.size() / 3);
        mesh.node_positions_m.insert(mesh.node_positions_m.end(), middle.begin(), middle.end());
      }
    }
  }
}

int main() {
  for (bool bearing : {false, true}) {
    for (unsigned segments : {64u, 256u, 1024u}) {
      for (unsigned nodes : {3u, 6u}) {
        Mesh mesh;
        SurfaceLoad load;
        load.type = bearing ? SurfaceLoadType::bearing : SurfaceLoadType::resultant;
        load.nodes_per_face = nodes;
        load.total_force_n = {100, 0, 0};
        load.moment_nm = bearing ? Vector3{} : Vector3{0, 0, 100};
        load.reference_m = {0, 0, .5};
        load.cylinder_axis = {0, 0, 1};
        load.radius_m = .5;
        load.band_length_m = 1;
        make_band(segments, nodes, mesh, load);
        std::vector<double> rhs(mesh.node_positions_m.size()), times;
        Diagnostic diagnostic;
        SurfaceResultants result;
        for (unsigned repetition = 0; repetition < 11; ++repetition) {
          std::fill(rhs.begin(), rhs.end(), 0);
          const auto start = std::chrono::steady_clock::now();
          const bool ok = bearing
              ? integrate_bearing_load(mesh, load, &rhs, result, diagnostic)
              : integrate_resultant_load(mesh, load, &rhs, result, diagnostic);
          const auto end = std::chrono::steady_clock::now();
          if (!ok) { std::cerr << diagnostic.message; return 1; }
          if (repetition)
            times.push_back(std::chrono::duration<double, std::milli>(end - start).count());
        }
        std::sort(times.begin(), times.end());
        const double median_ms = (times[4] + times[5]) / 2;
        std::cout << (bearing ? "bearing" : "resultant") << ',' << nodes << ','
                  << 2 * segments << ',' << median_ms << ','
                  << load.triangle_connectivity.capacity() * sizeof(unsigned) << ','
                  << 6 * sizeof(double) << '\n';
      }
    }
  }
}
