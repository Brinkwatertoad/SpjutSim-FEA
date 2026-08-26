#pragma once

#include "spjutsim/fem_context.hpp"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

inline void require(bool condition, const std::string &message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}
inline bool near(double actual, double expected, double relative = 1e-10,
                 double absolute = 1e-12) {
  return std::abs(actual - expected) <=
         std::max(absolute,
                  relative * std::max(std::abs(actual), std::abs(expected)));
}
inline spjutsim::fem::Mesh cube_mesh() {
  return {
      {0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1},
      {0, 1, 3, 7, 0, 3, 2, 7, 0, 2, 6, 7, 0, 6, 4, 7, 0, 4, 5, 7, 0, 5, 1, 7}};
}
inline std::vector<spjutsim::fem::PrescribedDof> axial_constraints() {
  return {{0, 0}, {6, 0}, {12, 0}, {18, 0}, {1, 0}, {2, 0}, {8, 0}};
}
inline spjutsim::fem::Loads axial_loads(double force_n = 1000.0) {
  spjutsim::fem::Loads loads;
  spjutsim::fem::SurfaceLoad load;
  load.type = spjutsim::fem::SurfaceLoadType::total_force;
  load.triangle_connectivity = {1, 3, 7, 1, 7, 5};
  load.total_force_n = {force_n, 0, 0};
  loads.surface_loads.push_back(load);
  return loads;
}
inline void configure_axial(spjutsim::fem::Context &context,
                            double force_n = 1000.0) {
  require(context.load_mesh(cube_mesh()), "cube mesh rejected");
  require(context.set_material({1.0e9, 0.25, 1000}), "material rejected");
  require(context.set_constraints(axial_constraints()),
          "axial constraints rejected");
  require(context.set_loads(axial_loads(force_n)), "axial loads rejected");
}
