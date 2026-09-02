#include "spjutsim/fem_context.hpp"
#include "test_support.hpp"

#include <array>

using namespace spjutsim::fem;

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
  return 0;
}
