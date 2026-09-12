#include "spjutsim/tet10.hpp"
#include "test_support.hpp"

#include <array>
#include <cmath>
#include <numeric>

using namespace spjutsim::fem;

int main() {
  const std::array<double, 30> x{
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1,
      .5, 0, 0, .5, .5, 0, 0, .5, 0, 0, 0, .5, 0, .5, .5, .5, 0, .5};
  const std::array<std::array<double, 4>, 10> nodes{{
      {1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 1},
      {.5, .5, 0, 0}, {0, .5, .5, 0}, {.5, 0, .5, 0},
      {.5, 0, 0, .5}, {0, 0, .5, .5}, {0, .5, 0, .5}}};
  for (std::size_t point = 0; point < nodes.size(); ++point) {
    const auto shape = tet10_shape_functions(nodes[point]);
    require(near(std::accumulate(shape.begin(), shape.end(), 0.0), 1.0),
            "Tet10 shape functions did not partition unity");
    for (std::size_t node = 0; node < shape.size(); ++node)
      require(near(shape[node], node == point ? 1.0 : 0.0),
              "Tet10 Kronecker interpolation failed");
  }

  Diagnostic diagnostic;
  Tet10Data data;
  require(build_tet10_data(x, data, diagnostic),
          "unit Tet10 geometry failed: " + diagnostic.message);
  require(near(data.volume_m3, 1.0 / 6.0), "unit Tet10 volume wrong");
  for (const auto &point : data.points)
    require(near(point.jacobian_determinant, 1.0),
            "affine Tet10 Jacobian was not constant");

  std::array<double, 30> rigid{};
  for (int node = 0; node < 10; ++node) {
    rigid[node * 3] = 2;
    rigid[node * 3 + 1] = -3;
    rigid[node * 3 + 2] = 4;
  }
  for (const auto &point : data.points)
    for (double strain : tet10_strain(point, rigid))
      require(std::abs(strain) < 1e-13,
              "rigid Tet10 translation created strain");

  std::array<double, 30> displacement{};
  for (int node = 0; node < 10; ++node) {
    const double px = x[node * 3], py = x[node * 3 + 1], pz = x[node * 3 + 2];
    displacement[node * 3] = .01 * px + .02 * py + .03 * pz;
    displacement[node * 3 + 1] = -.01 * px + .04 * py + .05 * pz;
    displacement[node * 3 + 2] = .08 * px + .06 * py + .07 * pz;
  }
  const std::array<double, 6> expected{.01, .04, .07, .01, .11, .11};
  for (const auto &point : data.points) {
    const auto strain = tet10_strain(point, displacement);
    for (int component = 0; component < 6; ++component)
      require(near(strain[component], expected[component], 1e-11, 1e-13),
              "Tet10 constant-strain patch failed");
  }

  std::array<double, 30> quadratic{};
  for (int node = 0; node < 10; ++node) {
    const double px = x[node * 3];
    quadratic[node * 3] = px * px;
  }
  for (const auto &point : data.points) {
    const auto strain = tet10_strain(point, quadratic);
    require(near(strain[0], 2 * point.barycentric[1], 1e-11, 1e-13),
            "Tet10 quadratic displacement field was not differentiated exactly");
  }

  const auto constitutive = isotropic_constitutive_matrix({200e9, .3, 0});
  const auto stiffness = tet10_stiffness(data, constitutive);
  for (int row = 0; row < 30; ++row)
    for (int column = 0; column < 30; ++column)
      require(near(stiffness[row * 30 + column],
                   stiffness[column * 30 + row], 1e-12, 1e-3),
              "Tet10 stiffness was not symmetric");

  const auto body = tet10_body_force(data, 24, {0, 0, -10});
  double body_z = 0;
  for (int node = 0; node < 10; ++node)
    body_z += body[node * 3 + 2];
  require(near(body_z, -40, 1e-11, 1e-11),
          "Tet10 body-force resultant was not conserved");

  const std::array<double, 18> face{
      0, 0, 0, 1, 0, 0, 0, 1, 0, .5, 0, 0, .5, .5, 0, 0, .5, 0};
  const auto pressure = tri6_pressure_force(face, 12, diagnostic);
  double pressure_z = 0;
  for (int node = 0; node < 6; ++node)
    pressure_z += pressure[node * 3 + 2];
  require(diagnostic.code == ErrorCode::none && near(pressure_z, -6),
          "Tri6 pressure resultant was not conserved");
  const auto total = tri6_total_force(face, .5, {2, 3, 4}, diagnostic);
  for (int axis = 0; axis < 3; ++axis) {
    double sum = 0;
    for (int node = 0; node < 6; ++node)
      sum += total[node * 3 + axis];
    require(near(sum, 2 + axis), "Tri6 total force was not conserved");
  }

  auto inverted = x;
  for (int axis = 0; axis < 3; ++axis) {
    std::swap(inverted[3 + axis], inverted[6 + axis]);
    std::swap(inverted[12 + axis], inverted[18 + axis]);
    std::swap(inverted[24 + axis], inverted[27 + axis]);
  }
  require(!build_tet10_data(inverted, data, diagnostic) &&
              diagnostic.code == ErrorCode::mesh_invalid_jacobian,
          "inverted Tet10 was accepted");
  return 0;
}
