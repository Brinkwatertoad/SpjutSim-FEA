#include "spjutsim/fem_context.hpp"
#include "test_support.hpp"

#include <array>
#include <map>
#include <utility>

using namespace spjutsim::fem;

namespace {
Mesh slender_tet10_mesh() {
  constexpr int divisions = 4;
  Mesh mesh;
  auto vertex = [](int x, int y, int z) {
    return static_cast<std::uint32_t>(
        (z * (divisions + 1) + y) * (divisions + 1) + x);
  };
  for (int z = 0; z <= divisions; ++z)
    for (int y = 0; y <= divisions; ++y)
      for (int x = 0; x <= divisions; ++x) {
        mesh.node_positions_m.push_back(10.0 * x / divisions);
        mesh.node_positions_m.push_back(1.0 * y / divisions);
        mesh.node_positions_m.push_back(1.0 * z / divisions);
      }
  constexpr int tetrahedra[6][4] = {
      {0, 1, 3, 7}, {0, 3, 2, 7}, {0, 2, 6, 7},
      {0, 6, 4, 7}, {0, 4, 5, 7}, {0, 5, 1, 7}};
  constexpr int edges[6][2] = {
      {0, 1}, {1, 2}, {2, 0}, {0, 3}, {2, 3}, {3, 1}};
  std::map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t>
      midpoint_nodes;
  for (int z = 0; z < divisions; ++z)
    for (int y = 0; y < divisions; ++y)
      for (int x = 0; x < divisions; ++x) {
        const std::uint32_t vertices[8] = {
            vertex(x, y, z),         vertex(x + 1, y, z),
            vertex(x, y + 1, z),     vertex(x + 1, y + 1, z),
            vertex(x, y, z + 1),     vertex(x + 1, y, z + 1),
            vertex(x, y + 1, z + 1), vertex(x + 1, y + 1, z + 1)};
        for (const auto &local : tetrahedra) {
          std::array<std::uint32_t, 4> corners{
              vertices[local[0]], vertices[local[1]], vertices[local[2]],
              vertices[local[3]]};
          mesh.tet4_connectivity.insert(mesh.tet4_connectivity.end(),
                                        corners.begin(), corners.end());
          for (const auto &edge : edges) {
            const auto key = std::minmax(corners[edge[0]], corners[edge[1]]);
            auto found = midpoint_nodes.find(key);
            if (found == midpoint_nodes.end()) {
              const auto midpoint = static_cast<std::uint32_t>(
                  mesh.node_positions_m.size() / 3);
              midpoint_nodes.emplace(key, midpoint);
              for (int axis = 0; axis < 3; ++axis)
                mesh.node_positions_m.push_back(
                    0.5 * (mesh.node_positions_m[key.first * 3 + axis] +
                           mesh.node_positions_m[key.second * 3 + axis]));
              mesh.tet4_connectivity.push_back(midpoint);
            } else {
              mesh.tet4_connectivity.push_back(found->second);
            }
          }
        }
      }
  mesh.element_type = ElementType::tet10;
  return mesh;
}
} // namespace

int main() {
  Mesh mesh;
  mesh.node_positions_m = {
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1,
      .5, 0, 0, .5, .5, 0, 0, .5, 0, 0, 0, .5, 0, .5, .5, .5, 0, .5};
  mesh.tet4_connectivity = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9};
  mesh.element_type = ElementType::tet10;

  Context context;
  require(context.load_mesh(mesh), "Tet10 solver mesh rejected");
  require(context.set_material({200e9, .3, 24}), "Tet10 material rejected");
  std::vector<PrescribedDof> constraints;
  for (std::uint32_t node = 0; node < 10; ++node) {
    const auto x = mesh.node_positions_m[node * 3];
    const auto y = mesh.node_positions_m[node * 3 + 1];
    const auto z = mesh.node_positions_m[node * 3 + 2];
    const std::array<double, 3> u{
        .01 * x + .02 * y + .03 * z,
        -.01 * x + .04 * y + .05 * z,
        .08 * x + .06 * y + .07 * z};
    for (std::uint32_t axis = 0; axis < 3; ++axis)
      constraints.push_back({node * 3 + axis, u[axis]});
  }
  require(context.set_constraints(std::move(constraints)),
          "Tet10 affine constraints rejected");
  require(context.set_loads({}), "Tet10 empty loads rejected");
  require(context.preflight(), "Tet10 preflight failed");
  require(context.solve(), "Tet10 solve failed");
  const auto &result = context.results();
  require(result.recovery_von_mises_pa.size() == 4 &&
              result.recovery_sample_element ==
                  std::vector<std::uint32_t>({0, 0, 0, 0}),
          "Tet10 recovery samples were not preserved");
  const std::array<double, 6> expected{.01, .04, .07, .01, .11, .11};
  for (std::size_t sample = 0; sample < 4; ++sample)
    for (std::size_t component = 0; component < 6; ++component)
      require(near(result.recovery_strain[sample * 6 + component],
                   expected[component], 1e-9, 1e-11),
              "Tet10 affine solve did not recover constant strain");
  require(result.raw_von_mises_max.sample_index < 4,
          "Tet10 raw extremum omitted its recovery sample");

  Context loaded;
  require(loaded.load_mesh(mesh), "loaded Tet10 mesh rejected");
  require(loaded.set_material({200e9, .3, 24}), "loaded Tet10 material rejected");
  std::vector<PrescribedDof> fixed;
  for (std::uint32_t dof = 0; dof < 30; ++dof)
    fixed.push_back({dof, 0});
  require(loaded.set_constraints(std::move(fixed)), "loaded Tet10 supports rejected");
  Loads loads;
  loads.gravity_enabled = true;
  loads.gravity_m_s2 = {0, 0, -10};
  SurfaceLoad pressure;
  pressure.type = SurfaceLoadType::pressure;
  pressure.nodes_per_face = 6;
  pressure.pressure_pa = 12;
  pressure.triangle_connectivity = {0, 2, 1, 6, 5, 4};
  loads.surface_loads.push_back(pressure);
  require(loaded.set_loads(std::move(loads)), "Tet10 loads rejected");
  require(loaded.solve(), "loaded Tet10 solve failed");
  require(near(loaded.results().total_applied_force_n[2], -34, 1e-10, 1e-10) &&
              near(loaded.results().total_reaction_n[2], 34, 1e-10, 1e-10),
          "Tet10 pressure/gravity resultants did not equilibrate");

  Context free_dofs;
  auto slender = slender_tet10_mesh();
  require(free_dofs.load_mesh(slender), "multi-element Tet10 mesh rejected");
  require(free_dofs.set_material({200e9, .3, 0}),
          "multi-element Tet10 material rejected");
  std::vector<PrescribedDof> fixed_face;
  Loads end_load;
  end_load.nodal_forces_n.assign(slender.node_positions_m.size(), 0.0);
  std::uint32_t loaded_nodes = 0;
  for (std::uint32_t node = 0; node < slender.node_positions_m.size() / 3;
       ++node) {
    const double x = slender.node_positions_m[node * 3];
    if (std::abs(x) < 1e-12)
      for (std::uint32_t axis = 0; axis < 3; ++axis)
        fixed_face.push_back({node * 3 + axis, 0});
    if (std::abs(x - 10.0) < 1e-12)
      ++loaded_nodes;
  }
  for (std::uint32_t node = 0; node < slender.node_positions_m.size() / 3;
       ++node)
    if (std::abs(slender.node_positions_m[node * 3] - 10.0) < 1e-12)
      end_load.nodal_forces_n[node * 3] = 1000.0 / loaded_nodes;
  require(free_dofs.set_constraints(std::move(fixed_face)),
          "multi-element Tet10 supports rejected");
  require(free_dofs.set_loads(std::move(end_load)),
          "multi-element Tet10 load rejected");
  require(free_dofs.solve(),
          "free-DOF Tet10 solve stopped before convergence: " +
              free_dofs.last_diagnostic().message);
  require(free_dofs.results().solver.final_relative_residual < 1e-8,
          "free-DOF Tet10 solve did not reach the requested residual");
  return 0;
}
