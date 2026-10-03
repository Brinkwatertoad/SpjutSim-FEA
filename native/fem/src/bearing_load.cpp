#include "spjutsim/bearing_load.hpp"

#include <algorithm>
#include <cmath>

namespace spjutsim::fem {
bool integrate_bearing_load(const Mesh &mesh, const SurfaceLoad &load,
                            std::vector<double> *forces,
                            SurfaceResultants &result, Diagnostic &diagnostic) {
  result = {};
  auto invalid = [&](const char *message) {
    diagnostic = {ErrorCode::invalid_argument, message, {}, true};
    return false;
  };
  if (dot3(load.moment_nm, load.moment_nm) != 0)
    return invalid("Bearing loading does not support an independent moment. Use a separate moment load.");
  const double magnitude = std::sqrt(dot3(load.total_force_n, load.total_force_n));
  const double axis_squared = dot3(load.cylinder_axis, load.cylinder_axis);
  if (!(magnitude > 0) || !std::isfinite(magnitude) ||
      !std::isfinite(dot3(load.reference_m, load.reference_m)) ||
      !std::isfinite(axis_squared) || std::abs(axis_squared - 1) > 1e-10 ||
      !(load.radius_m > 0) || !std::isfinite(load.radius_m) ||
      !(load.band_length_m > 0) || !std::isfinite(load.band_length_m)) {
    return invalid("A bearing load needs a finite nonzero force and a validated cylindrical band.");
  }
  if (std::abs(dot3(load.total_force_n, load.cylinder_axis)) > magnitude * 1e-10) {
    return invalid("Bearing force must be transverse to the cylinder axis. Use another load type for axial force.");
  }
  if (forces && forces->size() != mesh.node_positions_m.size()) {
    return invalid("The bearing force buffer does not match the mesh.");
  }
  Vector3 direction{};
  for (int axis = 0; axis < 3; ++axis)
    direction[axis] = load.total_force_n[axis] / magnitude;
  auto traction = [&](const SurfacePoint &point) {
    const double cosine = std::max(0., -dot3(point.normal, direction));
    Vector3 value{};
    for (int axis = 0; axis < 3; ++axis)
      value[axis] = -point.normal[axis] * cosine;
    return value;
  };
  SurfaceResultants unit;
  bool geometry_valid = true;
  double area_m2 = 0;
  if (!visit_surface(mesh, load, [&](const SurfacePoint &point) {
        area_m2 += point.area_weight_m2;
        const auto offset = subtract3(point.position_m, load.reference_m);
        const double axial = dot3(offset, load.cylinder_axis);
        Vector3 radial = offset;
        for (int axis = 0; axis < 3; ++axis)
          radial[axis] -= axial * load.cylinder_axis[axis];
        const double radius = std::sqrt(dot3(radial, radial));
        if (std::abs(radius - load.radius_m) > load.radius_m * .05 ||
            std::abs(axial) > load.band_length_m * (.5 + 1e-8) ||
            std::abs(dot3(point.normal, load.cylinder_axis)) > .05)
          geometry_valid = false;
        accumulate_traction(point, traction(point), load, nullptr, unit);
      }, diagnostic))
    return false;
  // Even an omitted unloaded sector can preserve the requested wrench.
  // Check declared full-band area independently of resultant normalization.
  const double expected_area = 2 * std::acos(-1.) * load.radius_m * load.band_length_m;
  if (!std::isfinite(expected_area) || !std::isfinite(area_m2) ||
      std::abs(area_m2 / expected_area - 1) > .05)
    return invalid("The bearing boundary does not cover the declared full cylindrical band within 5%. Select the complete band and refine the mesh.");
  if (!geometry_valid) {
    return invalid("The selected boundary does not resolve the declared cylindrical band. Check the target and refine the mesh.");
  }
  const double projection = dot3(unit.force_n, direction);
  if (!(projection > 0) || !std::isfinite(projection)) {
    return invalid("The selected bearing band has no resolved loaded half. Check the selection and refine the mesh.");
  }
  const double normalization = magnitude / projection;
  for (int axis = 0; axis < 3; ++axis) {
    result.force_n[axis] = unit.force_n[axis] * normalization;
    result.moment_nm[axis] = unit.moment_nm[axis] * normalization;
  }
  const auto residual = subtract3(result.force_n, load.total_force_n);
  // 0.5% is a discretization limit, never a correction to traction or direction.
  if (std::sqrt(dot3(residual, residual)) > magnitude * .005 ||
      std::sqrt(dot3(result.moment_nm, result.moment_nm)) >
          magnitude * std::max(load.radius_m, load.band_length_m) * .005) {
    return invalid("The bearing mesh does not reproduce the requested transverse force and zero center moment within 0.5%. Refine the mesh.");
  }
  if (forces) {
    result = {};
    if (!visit_surface(mesh, load, [&](const SurfacePoint &point) {
          auto value = traction(point);
          for (double &component : value)
            component *= normalization;
          accumulate_traction(point, value, load, forces, result);
        }, diagnostic))
      return false;
  }
  return true;
}
} // namespace spjutsim::fem
