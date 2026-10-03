#pragma once

#include "spjutsim/fem_types.hpp"

namespace spjutsim::fem {
using Vector3 = std::array<double, 3>;
struct SurfaceResultants {
  Vector3 force_n{}, moment_nm{};
};
struct SurfacePoint {
  Vector3 position_m{}, normal{};
  std::array<double, 6> shape{};
  double area_weight_m2 = 0;
  std::size_t connectivity_offset = 0;
};
// Visits only the selected boundary, with positive degree-five triangle weights.
// Positions and nodal moments use the same isoparametric Tri3/Tri6 shape functions.
bool visit_surface(const Mesh &, const SurfaceLoad &,
                   const std::function<void(const SurfacePoint &)> &, Diagnostic &);
Vector3 cross3(const Vector3 &, const Vector3 &);
Vector3 subtract3(const Vector3 &, const Vector3 &);
double dot3(const Vector3 &, const Vector3 &);
void accumulate_traction(const SurfacePoint &, const Vector3 &, const SurfaceLoad &,
                         std::vector<double> *, SurfaceResultants &);
bool integrate_resultant_load(const Mesh &, const SurfaceLoad &, std::vector<double> *,
                              SurfaceResultants &, Diagnostic &);
} // namespace spjutsim::fem
