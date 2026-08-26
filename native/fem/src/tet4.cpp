#include "spjutsim/tet4.hpp"

#include <algorithm>
#include <cmath>

namespace spjutsim::fem {
namespace {
double triangle_area(const std::array<double, 9> &x) {
  const double ax = x[3] - x[0], ay = x[4] - x[1], az = x[5] - x[2];
  const double bx = x[6] - x[0], by = x[7] - x[1], bz = x[8] - x[2];
  const double nx = ay * bz - az * by, ny = az * bx - ax * bz,
               nz = ax * by - ay * bx;
  return 0.5 * std::sqrt(nx * nx + ny * ny + nz * nz);
}
} // namespace

bool build_tet4_data(const std::array<double, 12> &x, Tet4Data &out,
                     Diagnostic &diagnostic, double relative_tolerance) {
  if (!(relative_tolerance > 0.0) || !std::isfinite(relative_tolerance) ||
      !std::all_of(x.begin(), x.end(),
                   [](double v) { return std::isfinite(v); })) {
    diagnostic = {ErrorCode::invalid_argument,
                  "Tet4 coordinates or tolerance are invalid.",
                  {},
                  true};
    return false;
  }
  double j[3][3];
  double max_edge2 = 0.0;
  for (int axis = 0; axis < 3; ++axis) {
    j[axis][0] = x[3 + axis] - x[axis];
    j[axis][1] = x[6 + axis] - x[axis];
    j[axis][2] = x[9 + axis] - x[axis];
  }
  for (int a = 0; a < 4; ++a)
    for (int b = a + 1; b < 4; ++b) {
      double edge2 = 0.0;
      for (int axis = 0; axis < 3; ++axis) {
        const double d = x[b * 3 + axis] - x[a * 3 + axis];
        edge2 += d * d;
      }
      max_edge2 = std::max(max_edge2, edge2);
    }
  const double det = j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1]) -
                     j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0]) +
                     j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0]);
  const double scale3 = max_edge2 * std::sqrt(max_edge2);
  if (!(det > relative_tolerance * scale3)) {
    diagnostic = {ErrorCode::mesh_invalid_jacobian,
                  det <= 0.0 ? "The mesh contains an inverted Tet4 element."
                             : "The mesh contains a degenerate Tet4 element.",
                  "Tet4 determinant did not exceed the scale-relative Jacobian "
                  "tolerance.",
                  true};
    return false;
  }
  const double inv_det = 1.0 / det;
  double inv[3][3] = {{(j[1][1] * j[2][2] - j[1][2] * j[2][1]) * inv_det,
                       (j[0][2] * j[2][1] - j[0][1] * j[2][2]) * inv_det,
                       (j[0][1] * j[1][2] - j[0][2] * j[1][1]) * inv_det},
                      {(j[1][2] * j[2][0] - j[1][0] * j[2][2]) * inv_det,
                       (j[0][0] * j[2][2] - j[0][2] * j[2][0]) * inv_det,
                       (j[0][2] * j[1][0] - j[0][0] * j[1][2]) * inv_det},
                      {(j[1][0] * j[2][1] - j[1][1] * j[2][0]) * inv_det,
                       (j[0][1] * j[2][0] - j[0][0] * j[2][1]) * inv_det,
                       (j[0][0] * j[1][1] - j[0][1] * j[1][0]) * inv_det}};
  double g[4][3] = {};
  for (int axis = 0; axis < 3; ++axis) {
    g[1][axis] = inv[0][axis];
    g[2][axis] = inv[1][axis];
    g[3][axis] = inv[2][axis];
    g[0][axis] = -g[1][axis] - g[2][axis] - g[3][axis];
  }
  out = {};
  out.volume_m3 = det / 6.0;
  for (int n = 0; n < 4; ++n) {
    const int c = 3 * n;
    const double dx = g[n][0], dy = g[n][1], dz = g[n][2];
    out.b[0 * 12 + c] = dx;
    out.b[1 * 12 + c + 1] = dy;
    out.b[2 * 12 + c + 2] = dz;
    out.b[3 * 12 + c] = dy;
    out.b[3 * 12 + c + 1] = dx;
    out.b[4 * 12 + c + 1] = dz;
    out.b[4 * 12 + c + 2] = dy;
    out.b[5 * 12 + c] = dz;
    out.b[5 * 12 + c + 2] = dx;
  }
  diagnostic = {};
  return true;
}

std::array<double, 36> isotropic_constitutive_matrix(const Material &m) {
  std::array<double, 36> d{};
  const double lambda =
      m.youngs_modulus_pa * m.poisson_ratio /
      ((1.0 + m.poisson_ratio) * (1.0 - 2.0 * m.poisson_ratio));
  const double mu = m.youngs_modulus_pa / (2.0 * (1.0 + m.poisson_ratio));
  for (int i = 0; i < 3; ++i)
    for (int j = 0; j < 3; ++j)
      d[i * 6 + j] = lambda;
  for (int i = 0; i < 3; ++i)
    d[i * 6 + i] += 2.0 * mu;
  d[3 * 6 + 3] = d[4 * 6 + 4] = d[5 * 6 + 5] = mu;
  return d;
}

std::array<double, 144> tet4_stiffness(const Tet4Data &e,
                                       const std::array<double, 36> &d) {
  std::array<double, 144> k{};
  double db[72]{};
  for (int i = 0; i < 6; ++i)
    for (int j = 0; j < 12; ++j)
      for (int q = 0; q < 6; ++q)
        db[i * 12 + j] += d[i * 6 + q] * e.b[q * 12 + j];
  for (int i = 0; i < 12; ++i)
    for (int j = 0; j < 12; ++j)
      for (int q = 0; q < 6; ++q)
        k[i * 12 + j] += e.b[q * 12 + i] * db[q * 12 + j] * e.volume_m3;
  return k;
}

std::array<double, 12> tet4_body_force(double volume, double density,
                                       const std::array<double, 3> &a) {
  std::array<double, 12> f{};
  for (int n = 0; n < 4; ++n)
    for (int axis = 0; axis < 3; ++axis)
      f[n * 3 + axis] = density * a[axis] * volume / 4.0;
  return f;
}

std::array<double, 9> triangle_pressure_force(const std::array<double, 9> &x,
                                              double pressure,
                                              Diagnostic &diagnostic) {
  std::array<double, 9> f{};
  const double ax = x[3] - x[0], ay = x[4] - x[1], az = x[5] - x[2],
               bx = x[6] - x[0], by = x[7] - x[1], bz = x[8] - x[2];
  const std::array<double, 3> area_normal{0.5 * (ay * bz - az * by),
                                          0.5 * (az * bx - ax * bz),
                                          0.5 * (ax * by - ay * bx)};
  const double area = std::sqrt(area_normal[0] * area_normal[0] +
                                area_normal[1] * area_normal[1] +
                                area_normal[2] * area_normal[2]);
  if (!(area > 0.0) || !std::isfinite(pressure)) {
    diagnostic = {ErrorCode::invalid_argument,
                  "A pressure face is degenerate or non-finite.",
                  {},
                  true};
    return f;
  }
  for (int n = 0; n < 3; ++n)
    for (int axis = 0; axis < 3; ++axis)
      f[n * 3 + axis] = -pressure * area_normal[axis] / 3.0;
  diagnostic = {};
  return f;
}

std::array<double, 9>
triangle_total_force(const std::array<double, 9> &x, double total_area,
                     const std::array<double, 3> &total_force,
                     Diagnostic &diagnostic) {
  std::array<double, 9> f{};
  const double area = triangle_area(x);
  if (!(area > 0.0) || !(total_area > 0.0) || !std::isfinite(total_area) ||
      !std::all_of(total_force.begin(), total_force.end(),
                   [](double v) { return std::isfinite(v); })) {
    diagnostic = {ErrorCode::invalid_argument,
                  "A total-force face is degenerate or non-finite.",
                  {},
                  true};
    return f;
  }
  for (int n = 0; n < 3; ++n)
    for (int axis = 0; axis < 3; ++axis)
      f[n * 3 + axis] = total_force[axis] * area / (3.0 * total_area);
  diagnostic = {};
  return f;
}

std::array<double, 6> tet4_strain(const Tet4Data &e,
                                  const std::array<double, 12> &u) {
  std::array<double, 6> strain{};
  for (int i = 0; i < 6; ++i)
    for (int j = 0; j < 12; ++j)
      strain[i] += e.b[i * 12 + j] * u[j];
  return strain;
}
std::array<double, 6> stress_from_strain(const std::array<double, 36> &d,
                                         const std::array<double, 6> &strain) {
  std::array<double, 6> stress{};
  for (int i = 0; i < 6; ++i)
    for (int j = 0; j < 6; ++j)
      stress[i] += d[i * 6 + j] * strain[j];
  return stress;
}
double von_mises_stress(const std::array<double, 6> &s) noexcept {
  return std::sqrt(0.5 * ((s[0] - s[1]) * (s[0] - s[1]) +
                          (s[1] - s[2]) * (s[1] - s[2]) +
                          (s[2] - s[0]) * (s[2] - s[0])) +
                   3.0 * (s[3] * s[3] + s[4] * s[4] + s[5] * s[5]));
}
std::array<double, 3>
principal_stresses(const std::array<double, 6> &s) noexcept {
  double a[3][3] = {{s[0], s[3], s[5]}, {s[3], s[1], s[4]}, {s[5], s[4], s[2]}};
  for (int sweep = 0; sweep < 12; ++sweep) {
    int p = 0, q = 1;
    if (std::abs(a[0][2]) > std::abs(a[p][q])) {
      p = 0;
      q = 2;
    }
    if (std::abs(a[1][2]) > std::abs(a[p][q])) {
      p = 1;
      q = 2;
    }
    if (std::abs(a[p][q]) <=
        1e-15 * std::max({1.0, std::abs(a[0][0]), std::abs(a[1][1]),
                          std::abs(a[2][2])}))
      break;
    const double phi = 0.5 * std::atan2(2 * a[p][q], a[q][q] - a[p][p]),
                 c = std::cos(phi), sn = std::sin(phi);
    const double app =
                     c * c * a[p][p] - 2 * sn * c * a[p][q] + sn * sn * a[q][q],
                 aqq =
                     sn * sn * a[p][p] + 2 * sn * c * a[p][q] + c * c * a[q][q];
    for (int r = 0; r < 3; ++r)
      if (r != p && r != q) {
        double arp = a[r][p], arq = a[r][q];
        a[r][p] = a[p][r] = c * arp - sn * arq;
        a[r][q] = a[q][r] = sn * arp + c * arq;
      }
    a[p][p] = app;
    a[q][q] = aqq;
    a[p][q] = a[q][p] = 0;
  }
  std::array<double, 3> values{a[0][0], a[1][1], a[2][2]};
  std::sort(values.begin(), values.end(), std::greater<double>());
  return values;
}
} // namespace spjutsim::fem
