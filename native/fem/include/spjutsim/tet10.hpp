#pragma once

#include "spjutsim/tet4.hpp"

namespace spjutsim::fem {

inline constexpr double kTet10QuadratureA = 0.5854101966249685;
inline constexpr double kTet10QuadratureB = 0.1381966011250105;

struct Tet10PointData {
  double jacobian_determinant = 0.0;
  double reference_weight = 1.0 / 24.0;
  std::array<double, 4> barycentric{};
  std::array<double, 180> b{};
};

struct Tet10Data {
  double volume_m3 = 0.0;
  std::array<Tet10PointData, 4> points{};
};

std::array<double, 10>
tet10_shape_functions(const std::array<double, 4> &barycentric) noexcept;

bool build_tet10_data(
    const std::array<double, 30> &coordinates, Tet10Data &out,
    Diagnostic &diagnostic,
    double relative_tolerance = kDefaultJacobianRelativeTolerance);

std::array<double, 900>
tet10_stiffness(const Tet10Data &element,
                const std::array<double, 36> &constitutive);

std::array<double, 30>
tet10_body_force(const Tet10Data &element, double density,
                 const std::array<double, 3> &acceleration);

std::array<double, 6>
tet10_strain(const Tet10PointData &point,
             const std::array<double, 30> &displacement);

double tri6_area(const std::array<double, 18> &coordinates,
                 Diagnostic &diagnostic);

std::array<double, 18>
tri6_pressure_force(const std::array<double, 18> &coordinates, double pressure,
                    Diagnostic &diagnostic);

std::array<double, 18>
tri6_total_force(const std::array<double, 18> &coordinates, double total_area,
                 const std::array<double, 3> &total_force,
                 Diagnostic &diagnostic);

} // namespace spjutsim::fem
