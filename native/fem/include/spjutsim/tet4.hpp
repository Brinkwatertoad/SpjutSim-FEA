#pragma once
#include "spjutsim/fem_types.hpp"
namespace spjutsim::fem {
struct Tet4Data {
  double volume_m3 = 0.0;
  std::array<double, 72> b{};
};
bool build_tet4_data(
    const std::array<double, 12> &, Tet4Data &, Diagnostic &,
    double relative_tolerance = kDefaultJacobianRelativeTolerance);
std::array<double, 36> isotropic_constitutive_matrix(const Material &);
std::array<double, 144> tet4_stiffness(const Tet4Data &,
                                       const std::array<double, 36> &);
std::array<double, 12> tet4_body_force(double, double,
                                       const std::array<double, 3> &);
std::array<double, 9> triangle_pressure_force(const std::array<double, 9> &,
                                              double, Diagnostic &);
std::array<double, 9> triangle_total_force(const std::array<double, 9> &,
                                           double,
                                           const std::array<double, 3> &,
                                           Diagnostic &);
std::array<double, 6> tet4_strain(const Tet4Data &,
                                  const std::array<double, 12> &);
std::array<double, 6> stress_from_strain(const std::array<double, 36> &,
                                         const std::array<double, 6> &);
double von_mises_stress(const std::array<double, 6> &) noexcept;
std::array<double, 3>
principal_stresses(const std::array<double, 6> &) noexcept;
} // namespace spjutsim::fem
