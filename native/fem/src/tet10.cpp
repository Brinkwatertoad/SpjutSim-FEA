#include "spjutsim/tet10.hpp"

#include <algorithm>
#include <cmath>

namespace spjutsim::fem {
namespace {
constexpr std::array<std::array<double, 4>, 4> kTetPoints{{
    {kTet10QuadratureA, kTet10QuadratureB, kTet10QuadratureB,
     kTet10QuadratureB},
    {kTet10QuadratureB, kTet10QuadratureA, kTet10QuadratureB,
     kTet10QuadratureB},
    {kTet10QuadratureB, kTet10QuadratureB, kTet10QuadratureA,
     kTet10QuadratureB},
    {kTet10QuadratureB, kTet10QuadratureB, kTet10QuadratureB,
     kTet10QuadratureA}}};
constexpr std::array<std::array<int, 2>, 6> kEdges{{
    {0, 1}, {1, 2}, {2, 0}, {0, 3}, {2, 3}, {3, 1}}};
constexpr double kDL[4][3] = {
    {-1, -1, -1}, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}};

std::array<std::array<double, 3>, 10>
reference_derivatives(const std::array<double, 4> &l) noexcept {
  std::array<std::array<double, 3>, 10> derivatives{};
  for (int node = 0; node < 4; ++node)
    for (int axis = 0; axis < 3; ++axis)
      derivatives[node][axis] = (4 * l[node] - 1) * kDL[node][axis];
  for (int edge = 0; edge < 6; ++edge) {
    const int first = kEdges[edge][0], second = kEdges[edge][1];
    for (int axis = 0; axis < 3; ++axis)
      derivatives[edge + 4][axis] =
          4 * (kDL[first][axis] * l[second] +
               l[first] * kDL[second][axis]);
  }
  return derivatives;
}

double determinant(const double matrix[3][3]) noexcept {
  return matrix[0][0] *
             (matrix[1][1] * matrix[2][2] -
              matrix[1][2] * matrix[2][1]) -
         matrix[0][1] *
             (matrix[1][0] * matrix[2][2] -
              matrix[1][2] * matrix[2][0]) +
         matrix[0][2] *
             (matrix[1][0] * matrix[2][1] -
              matrix[1][1] * matrix[2][0]);
}

void inverse(const double matrix[3][3], double determinant_value,
             double out[3][3]) noexcept {
  const double scale = 1.0 / determinant_value;
  out[0][0] = (matrix[1][1] * matrix[2][2] -
               matrix[1][2] * matrix[2][1]) * scale;
  out[0][1] = (matrix[0][2] * matrix[2][1] -
               matrix[0][1] * matrix[2][2]) * scale;
  out[0][2] = (matrix[0][1] * matrix[1][2] -
               matrix[0][2] * matrix[1][1]) * scale;
  out[1][0] = (matrix[1][2] * matrix[2][0] -
               matrix[1][0] * matrix[2][2]) * scale;
  out[1][1] = (matrix[0][0] * matrix[2][2] -
               matrix[0][2] * matrix[2][0]) * scale;
  out[1][2] = (matrix[0][2] * matrix[1][0] -
               matrix[0][0] * matrix[1][2]) * scale;
  out[2][0] = (matrix[1][0] * matrix[2][1] -
               matrix[1][1] * matrix[2][0]) * scale;
  out[2][1] = (matrix[0][1] * matrix[2][0] -
               matrix[0][0] * matrix[2][1]) * scale;
  out[2][2] = (matrix[0][0] * matrix[1][1] -
               matrix[0][1] * matrix[1][0]) * scale;
}

constexpr std::array<std::array<double, 3>, 3> kTriPoints{{
    {2.0 / 3.0, 1.0 / 6.0, 1.0 / 6.0},
    {1.0 / 6.0, 2.0 / 3.0, 1.0 / 6.0},
    {1.0 / 6.0, 1.0 / 6.0, 2.0 / 3.0}}};
constexpr double kTriWeight = 1.0 / 6.0;
constexpr double kTriDL[3][2] = {{-1, -1}, {1, 0}, {0, 1}};
constexpr std::array<std::array<int, 2>, 3> kTriEdges{{
    {0, 1}, {1, 2}, {2, 0}}};

std::array<double, 6>
tri6_shape(const std::array<double, 3> &l) noexcept {
  std::array<double, 6> shape{};
  for (int node = 0; node < 3; ++node)
    shape[node] = l[node] * (2 * l[node] - 1);
  for (int edge = 0; edge < 3; ++edge)
    shape[edge + 3] = 4 * l[kTriEdges[edge][0]] * l[kTriEdges[edge][1]];
  return shape;
}

std::array<std::array<double, 2>, 6>
tri6_derivatives(const std::array<double, 3> &l) noexcept {
  std::array<std::array<double, 2>, 6> derivatives{};
  for (int node = 0; node < 3; ++node)
    for (int axis = 0; axis < 2; ++axis)
      derivatives[node][axis] = (4 * l[node] - 1) * kTriDL[node][axis];
  for (int edge = 0; edge < 3; ++edge) {
    const int first = kTriEdges[edge][0], second = kTriEdges[edge][1];
    for (int axis = 0; axis < 2; ++axis)
      derivatives[edge + 3][axis] =
          4 * (kTriDL[first][axis] * l[second] +
               l[first] * kTriDL[second][axis]);
  }
  return derivatives;
}

bool tri6_point(const std::array<double, 18> &x,
                const std::array<double, 3> &barycentric,
                std::array<double, 6> &shape,
                std::array<double, 3> &area_vector,
                Diagnostic &diagnostic) {
  shape = tri6_shape(barycentric);
  const auto derivatives = tri6_derivatives(barycentric);
  double tangent[2][3]{};
  for (int node = 0; node < 6; ++node)
    for (int reference_axis = 0; reference_axis < 2; ++reference_axis)
      for (int physical_axis = 0; physical_axis < 3; ++physical_axis)
        tangent[reference_axis][physical_axis] +=
            x[node * 3 + physical_axis] *
            derivatives[node][reference_axis];
  area_vector = {
      tangent[0][1] * tangent[1][2] - tangent[0][2] * tangent[1][1],
      tangent[0][2] * tangent[1][0] - tangent[0][0] * tangent[1][2],
      tangent[0][0] * tangent[1][1] - tangent[0][1] * tangent[1][0]};
  const double magnitude = std::sqrt(
      area_vector[0] * area_vector[0] + area_vector[1] * area_vector[1] +
      area_vector[2] * area_vector[2]);
  if (!(magnitude > 0) || !std::isfinite(magnitude)) {
    diagnostic = {ErrorCode::mesh_invalid_jacobian,
                  "A quadratic boundary face is degenerate.", {}, true};
    return false;
  }
  diagnostic = {};
  return true;
}
} // namespace

std::array<double, 10>
tet10_shape_functions(const std::array<double, 4> &l) noexcept {
  std::array<double, 10> shape{};
  for (int node = 0; node < 4; ++node)
    shape[node] = l[node] * (2 * l[node] - 1);
  for (int edge = 0; edge < 6; ++edge)
    shape[edge + 4] = 4 * l[kEdges[edge][0]] * l[kEdges[edge][1]];
  return shape;
}

bool build_tet10_data(const std::array<double, 30> &x, Tet10Data &out,
                      Diagnostic &diagnostic, double relative_tolerance) {
  if (!(relative_tolerance > 0) || !std::isfinite(relative_tolerance) ||
      !std::all_of(x.begin(), x.end(),
                   [](double value) { return std::isfinite(value); })) {
    diagnostic = {ErrorCode::invalid_argument,
                  "Tet10 coordinates or tolerance are invalid.", {}, true};
    return false;
  }
  double max_edge_squared = 0;
  for (int first = 0; first < 4; ++first)
    for (int second = first + 1; second < 4; ++second) {
      double length_squared = 0;
      for (int axis = 0; axis < 3; ++axis) {
        const double difference =
            x[second * 3 + axis] - x[first * 3 + axis];
        length_squared += difference * difference;
      }
      max_edge_squared = std::max(max_edge_squared, length_squared);
    }
  const double scale3 =
      max_edge_squared * std::sqrt(max_edge_squared);
  Tet10Data built;
  for (std::size_t point_index = 0; point_index < kTetPoints.size();
       ++point_index) {
    auto &point = built.points[point_index];
    point.barycentric = kTetPoints[point_index];
    const auto derivatives = reference_derivatives(point.barycentric);
    double jacobian[3][3]{};
    for (int node = 0; node < 10; ++node)
      for (int physical_axis = 0; physical_axis < 3; ++physical_axis)
        for (int reference_axis = 0; reference_axis < 3; ++reference_axis)
          jacobian[physical_axis][reference_axis] +=
              x[node * 3 + physical_axis] *
              derivatives[node][reference_axis];
    point.jacobian_determinant = determinant(jacobian);
    if (!(point.jacobian_determinant > relative_tolerance * scale3)) {
      diagnostic = {
          ErrorCode::mesh_invalid_jacobian,
          point.jacobian_determinant <= 0
              ? "The mesh contains an inverted Tet10 element."
              : "The mesh contains a degenerate Tet10 element.",
          "Tet10 determinant did not exceed the scale-relative Jacobian "
          "tolerance at every stiffness quadrature point.",
          true};
      return false;
    }
    double inverse_jacobian[3][3]{};
    inverse(jacobian, point.jacobian_determinant, inverse_jacobian);
    for (int node = 0; node < 10; ++node) {
      double gradient[3]{};
      for (int physical_axis = 0; physical_axis < 3; ++physical_axis)
        for (int reference_axis = 0; reference_axis < 3; ++reference_axis)
          gradient[physical_axis] +=
              derivatives[node][reference_axis] *
              inverse_jacobian[reference_axis][physical_axis];
      const int column = node * 3;
      point.b[0 * 30 + column] = gradient[0];
      point.b[1 * 30 + column + 1] = gradient[1];
      point.b[2 * 30 + column + 2] = gradient[2];
      point.b[3 * 30 + column] = gradient[1];
      point.b[3 * 30 + column + 1] = gradient[0];
      point.b[4 * 30 + column + 1] = gradient[2];
      point.b[4 * 30 + column + 2] = gradient[1];
      point.b[5 * 30 + column] = gradient[2];
      point.b[5 * 30 + column + 2] = gradient[0];
    }
    built.volume_m3 += point.jacobian_determinant * point.reference_weight;
  }
  out = built;
  diagnostic = {};
  return true;
}

std::array<double, 900>
tet10_stiffness(const Tet10Data &element,
                const std::array<double, 36> &constitutive) {
  std::array<double, 900> stiffness{};
  for (const auto &point : element.points) {
    double db[180]{};
    for (int row = 0; row < 6; ++row)
      for (int column = 0; column < 30; ++column)
        for (int component = 0; component < 6; ++component)
          db[row * 30 + column] +=
              constitutive[row * 6 + component] *
              point.b[component * 30 + column];
    const double weight = point.jacobian_determinant * point.reference_weight;
    for (int row = 0; row < 30; ++row)
      for (int column = 0; column < 30; ++column)
        for (int component = 0; component < 6; ++component)
          stiffness[row * 30 + column] +=
              point.b[component * 30 + row] *
              db[component * 30 + column] * weight;
  }
  return stiffness;
}

std::array<double, 30>
tet10_body_force(const Tet10Data &element, double density,
                 const std::array<double, 3> &acceleration) {
  std::array<double, 30> force{};
  for (const auto &point : element.points) {
    const auto shape = tet10_shape_functions(point.barycentric);
    const double weight = point.jacobian_determinant * point.reference_weight;
    for (int node = 0; node < 10; ++node)
      for (int axis = 0; axis < 3; ++axis)
        force[node * 3 + axis] +=
            shape[node] * density * acceleration[axis] * weight;
  }
  return force;
}

std::array<double, 6>
tet10_strain(const Tet10PointData &point,
             const std::array<double, 30> &displacement) {
  std::array<double, 6> strain{};
  for (int component = 0; component < 6; ++component)
    for (int dof = 0; dof < 30; ++dof)
      strain[component] += point.b[component * 30 + dof] * displacement[dof];
  return strain;
}

double tri6_area(const std::array<double, 18> &coordinates,
                 Diagnostic &diagnostic) {
  double area = 0;
  for (const auto &point : kTriPoints) {
    std::array<double, 6> shape{};
    std::array<double, 3> area_vector{};
    if (!tri6_point(coordinates, point, shape, area_vector, diagnostic))
      return 0;
    area += kTriWeight *
            std::sqrt(area_vector[0] * area_vector[0] +
                      area_vector[1] * area_vector[1] +
                      area_vector[2] * area_vector[2]);
  }
  diagnostic = {};
  return area;
}

std::array<double, 18>
tri6_pressure_force(const std::array<double, 18> &coordinates, double pressure,
                    Diagnostic &diagnostic) {
  std::array<double, 18> force{};
  if (!std::isfinite(pressure)) {
    diagnostic = {ErrorCode::invalid_argument,
                  "A quadratic pressure is non-finite.", {}, true};
    return force;
  }
  for (const auto &point : kTriPoints) {
    std::array<double, 6> shape{};
    std::array<double, 3> area_vector{};
    if (!tri6_point(coordinates, point, shape, area_vector, diagnostic))
      return {};
    for (int node = 0; node < 6; ++node)
      for (int axis = 0; axis < 3; ++axis)
        force[node * 3 + axis] -=
            pressure * shape[node] * area_vector[axis] * kTriWeight;
  }
  diagnostic = {};
  return force;
}

std::array<double, 18>
tri6_total_force(const std::array<double, 18> &coordinates, double total_area,
                 const std::array<double, 3> &total_force,
                 Diagnostic &diagnostic) {
  std::array<double, 18> force{};
  if (!(total_area > 0) || !std::isfinite(total_area) ||
      !std::all_of(total_force.begin(), total_force.end(),
                   [](double value) { return std::isfinite(value); })) {
    diagnostic = {ErrorCode::invalid_argument,
                  "A quadratic total-force face is invalid.", {}, true};
    return force;
  }
  for (const auto &point : kTriPoints) {
    std::array<double, 6> shape{};
    std::array<double, 3> area_vector{};
    if (!tri6_point(coordinates, point, shape, area_vector, diagnostic))
      return {};
    const double jacobian =
        std::sqrt(area_vector[0] * area_vector[0] +
                  area_vector[1] * area_vector[1] +
                  area_vector[2] * area_vector[2]);
    for (int node = 0; node < 6; ++node)
      for (int axis = 0; axis < 3; ++axis)
        force[node * 3 + axis] +=
            total_force[axis] / total_area * shape[node] * jacobian *
            kTriWeight;
  }
  diagnostic = {};
  return force;
}

} // namespace spjutsim::fem
