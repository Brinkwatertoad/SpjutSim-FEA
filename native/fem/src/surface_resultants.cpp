#include "spjutsim/surface_resultants.hpp"

#include <algorithm>
#include <cmath>

namespace spjutsim::fem {
Vector3 cross3(const Vector3 &a, const Vector3 &b) {
  return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]};
}
Vector3 subtract3(const Vector3 &a, const Vector3 &b) {
  return {a[0] - b[0], a[1] - b[1], a[2] - b[2]};
}
double dot3(const Vector3 &a, const Vector3 &b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
namespace {
bool invalid(Diagnostic &d, const char *message) {
  d = {ErrorCode::invalid_argument, message, {}, true};
  return false;
}
bool finite(const Vector3 &v) {
  return std::all_of(v.begin(), v.end(), [](double x) { return std::isfinite(x); });
}
// Positive degree-five Dunavant rule. Weights sum to the reference area 1/2.
constexpr double points[7][4] = {
    {1. / 3, 1. / 3, 1. / 3, .225 / 2},
    {.059715871789770, .470142064105115, .470142064105115, .132394152788506 / 2},
    {.470142064105115, .059715871789770, .470142064105115, .132394152788506 / 2},
    {.470142064105115, .470142064105115, .059715871789770, .132394152788506 / 2},
    {.797426985353087, .101286507323456, .101286507323456, .125939180544827 / 2},
    {.101286507323456, .797426985353087, .101286507323456, .125939180544827 / 2},
    {.101286507323456, .101286507323456, .797426985353087, .125939180544827 / 2}};
}

bool visit_surface(const Mesh &mesh, const SurfaceLoad &load,
                   const std::function<void(const SurfacePoint &)> &visit,
                   Diagnostic &d) {
  const auto count = load.nodes_per_face;
  if ((count != 3 && count != 6) || load.triangle_connectivity.empty() ||
      load.triangle_connectivity.size() % count)
    return invalid(d, "The selected surface has incomplete Tri3/Tri6 connectivity.");
  const double dl[3][2] = {{-1, -1}, {1, 0}, {0, 1}};
  const int edges[3][2] = {{0, 1}, {1, 2}, {2, 0}};
  for (std::size_t offset = 0; offset < load.triangle_connectivity.size(); offset += count) {
    std::array<Vector3, 6> x{};
    for (unsigned n = 0; n < count; ++n) {
      auto node = load.triangle_connectivity[offset + n];
      if (node >= mesh.node_positions_m.size() / 3)
        return invalid(d, "The selected surface references a missing node.");
      for (int a = 0; a < 3; ++a) x[n][a] = mesh.node_positions_m[node * 3 + a];
      if (!finite(x[n])) return invalid(d, "Surface coordinates must be finite.");
    }
    for (const auto &q : points) {
      SurfacePoint p;
      p.connectivity_offset = offset;
      double derivatives[6][2]{};
      for (int n = 0; n < 3; ++n) {
        p.shape[n] = count == 3 ? q[n] : q[n] * (2 * q[n] - 1);
        for (int a = 0; a < 2; ++a)
          derivatives[n][a] = dl[n][a] * (count == 3 ? 1 : 4 * q[n] - 1);
      }
      if (count == 6) {
        for (int e = 0; e < 3; ++e) {
          auto i = edges[e][0], j = edges[e][1];
          p.shape[e + 3] = 4 * q[i] * q[j];
          for (int a = 0; a < 2; ++a)
            derivatives[e + 3][a] = 4 * (dl[i][a] * q[j] + q[i] * dl[j][a]);
        }
      }
      Vector3 tangent[2]{};
      // Relative coordinates avoid cancellation in translated models.
      p.position_m = x[0];
      for (unsigned n = 0; n < count; ++n) {
        for (int a = 0; a < 3; ++a) {
          double delta = x[n][a] - x[0][a];
          p.position_m[a] += p.shape[n] * delta;
          for (int k = 0; k < 2; ++k) tangent[k][a] += derivatives[n][k] * delta;
        }
      }
      auto area = cross3(tangent[0], tangent[1]);
      double jac = std::sqrt(dot3(area, area));
      if (!(jac > 0) || !std::isfinite(jac))
        return invalid(d, "The selected surface contains a degenerate triangle. Remesh or select a finite-area face.");
      for (int a = 0; a < 3; ++a) p.normal[a] = area[a] / jac;
      p.area_weight_m2 = q[3] * jac;
      visit(p);
    }
  }
  d = {};
  return true;
}

void accumulate_traction(const SurfacePoint &p, const Vector3 &traction,
                         const SurfaceLoad &load, std::vector<double> *forces,
                         SurfaceResultants &r) {
  Vector3 f{};
  for (int a = 0; a < 3; ++a) {
    f[a] = traction[a] * p.area_weight_m2;
    r.force_n[a] += f[a];
  }
  auto m = cross3(subtract3(p.position_m, load.reference_m), f);
  for (int a = 0; a < 3; ++a) r.moment_nm[a] += m[a];
  if (forces) {
    for (unsigned n = 0; n < load.nodes_per_face; ++n)
      for (int a = 0; a < 3; ++a)
        (*forces)[load.triangle_connectivity[p.connectivity_offset + n] * 3 + a] += p.shape[n] * f[a];
  }
}

bool integrate_resultant_load(const Mesh &mesh, const SurfaceLoad &load,
                              std::vector<double> *forces, SurfaceResultants &r,
                              Diagnostic &d) {
  r = {};
  if (!finite(load.total_force_n) || !finite(load.moment_nm) || !finite(load.reference_m))
    return invalid(d, "Surface force, moment and reference point must be finite.");
  if (forces && forces->size() != mesh.node_positions_m.size())
    return invalid(d, "The surface force buffer does not match the mesh.");
  if (load.triangle_connectivity.empty())
    return invalid(d, "Select finite-area faces for the resultant load.");
  auto node = load.triangle_connectivity.front();
  if (node >= mesh.node_positions_m.size() / 3)
    return invalid(d, "The selected surface references a missing node.");
  double area = 0;
  Vector3 center{}, anchor{};
  for (int a = 0; a < 3; ++a) anchor[a] = mesh.node_positions_m[node * 3 + a];
  if (!visit_surface(mesh, load, [&](const SurfacePoint &p) {
        area += p.area_weight_m2;
        for (int a = 0; a < 3; ++a)
          center[a] += (p.position_m[a] - anchor[a]) * p.area_weight_m2;
      }, d)) return false;
  if (!(area > 0) || !std::isfinite(area))
    return invalid(d, "The selected faces have no usable finite surface area.");
  for (int a = 0; a < 3; ++a) center[a] = anchor[a] + center[a] / area;

  // C = integral (|r|^2 I - r r^T) dA; traction = F/A + lambda cross r.
  double matrix[3][4]{};
  if (!visit_surface(mesh, load, [&](const SurfacePoint &p) {
        auto delta = subtract3(p.position_m, center);
        double rr = dot3(delta, delta);
        for (int a = 0; a < 3; ++a)
          for (int b = 0; b < 3; ++b)
            matrix[a][b] += ((a == b ? rr : 0) - delta[a] * delta[b]) * p.area_weight_m2;
      }, d)) return false;
  auto shift = cross3(subtract3(center, load.reference_m), load.total_force_n);
  double scale = std::max({matrix[0][0], matrix[1][1], matrix[2][2]});
  if (!(scale > 0) || !std::isfinite(scale))
    return invalid(d, "The selected surface cannot distribute a moment. Select a wider finite-area region.");
  for (int a = 0; a < 3; ++a) matrix[a][3] = load.moment_nm[a] - shift[a];
  for (int k = 0; k < 3; ++k) {
    int pivot = k;
    for (int a = k + 1; a < 3; ++a)
      if (std::abs(matrix[a][k]) > std::abs(matrix[pivot][k])) pivot = a;
    if (std::abs(matrix[pivot][k]) <= scale * 1e-10)
      return invalid(d, "The selected surface is too narrow or poorly resolved to distribute all moment components. Select a wider region or refine the mesh.");
    for (int b = k; b < 4; ++b) std::swap(matrix[k][b], matrix[pivot][b]);
    double value = matrix[k][k];
    for (int b = k; b < 4; ++b) matrix[k][b] /= value;
    for (int a = 0; a < 3; ++a) {
      if (a == k) continue;
      double factor = matrix[a][k];
      for (int b = k; b < 4; ++b) matrix[a][b] -= factor * matrix[k][b];
    }
  }
  Vector3 lambda{matrix[0][3], matrix[1][3], matrix[2][3]};
  if (!finite(lambda))
    return invalid(d, "The requested surface resultant exceeds the supported numerical range.");
  if (!visit_surface(mesh, load, [&](const SurfacePoint &p) {
        auto t = cross3(lambda, subtract3(p.position_m, center));
        for (int a = 0; a < 3; ++a) t[a] += load.total_force_n[a] / area;
        accumulate_traction(p, t, load, forces, r);
      }, d)) return false;

  // Verify with a characteristic boundary length and force/moment scales.
  auto df = subtract3(r.force_n, load.total_force_n);
  auto dm = subtract3(r.moment_nm, load.moment_nm);
  auto arm = subtract3(center, load.reference_m);
  double length = std::sqrt(scale / area);
  double fs = std::sqrt(dot3(load.total_force_n, load.total_force_n));
  double ms = std::sqrt(dot3(load.moment_nm, load.moment_nm)) + fs * (length + std::sqrt(dot3(arm, arm)));
  if (!finite(r.force_n) || !finite(r.moment_nm) ||
      std::sqrt(dot3(df, df)) > 1e-9 * (fs + ms / length) + 1e-12 ||
      std::sqrt(dot3(dm, dm)) > 1e-9 * ms + 1e-12)
    return invalid(d, "The selected surface failed force/moment integration. Refine the mesh or choose a better resolved target.");
  return true;
}
} // namespace spjutsim::fem
