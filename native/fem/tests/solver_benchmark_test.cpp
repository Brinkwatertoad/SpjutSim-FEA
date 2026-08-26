#include "test_support.hpp"

#include <cstring>

using namespace spjutsim::fem;
int main() {
  Context context;
  configure_axial(context);
  require(context.preflight(),
          "axial preflight failed: " + context.last_diagnostic().message);
  require(context.memory_estimate().exact_nnz ==
              context.graph().column_indices.size(),
          "preflight and actual graph nnz differ");
  SolveSettings settings;
  settings.relative_tolerance = 1e-11;
  require(context.solve(settings),
          "axial solve failed: " + context.last_diagnostic().message);
  const auto first = context.results();
  require(first.solver.converged &&
              first.solver.final_relative_residual < 1e-11,
          "axial PCG did not meet tolerance");
  for (std::uint32_t node : {1u, 3u, 5u, 7u})
    require(near(first.displacement_m[node * 3], 1e-6, 2e-8, 1e-12),
            "axial displacement missed closed form");
  for (std::size_t e = 0; e < 6; ++e) {
    require(near(first.element_stress_pa[e * 6], 1000, 2e-8, 1e-5),
            "axial stress missed closed form");
    for (int c = 1; c < 6; ++c)
      require(std::abs(first.element_stress_pa[e * 6 + c]) < 1e-4,
              "axial patch has spurious stress");
  }
  require(near(first.total_applied_force_n[0], 1000, 1e-12, 1e-9) &&
              near(first.total_reaction_n[0], -1000, 1e-10, 1e-7),
          "reaction equilibrium wrong");
  require(first.force_balance_relative_residual < 1e-10,
          "force balance residual too high");
  require(near(first.strain_energy_j, 0.0005, 2e-8, 1e-12),
          "strain energy wrong");
  require(near(first.raw_von_mises_max.value, 1000, 2e-8, 1e-5),
          "raw stress extremum wrong");
  require(context.solve(settings), "deterministic repeated solve failed");
  const auto &second = context.results();
  require(first.displacement_m.size() == second.displacement_m.size() &&
              std::memcmp(first.displacement_m.data(),
                          second.displacement_m.data(),
                          first.displacement_m.size() * sizeof(double)) == 0,
          "repeated displacement results differ bitwise");
  require(first.element_stress_pa == second.element_stress_pa,
          "repeated stress results differ");
  Context prescribed;
  require(prescribed.load_mesh(cube_mesh()), "prescribed mesh rejected");
  require(prescribed.set_material({1e9, .25, 0}),
          "prescribed material rejected");
  auto prescribed_constraints = axial_constraints();
  for (std::uint32_t node : {1u, 3u, 5u, 7u})
    prescribed_constraints.push_back({node * 3, 1e-6});
  require(prescribed.set_constraints(prescribed_constraints),
          "nonzero prescribed constraints rejected");
  require(prescribed.set_loads({}), "prescribed empty loads rejected");
  require(prescribed.solve(settings), "prescribed displacement solve failed: " +
                                          prescribed.last_diagnostic().message);
  for (std::uint32_t node : {1u, 3u, 5u, 7u})
    require(
        near(prescribed.results().displacement_m[node * 3], 1e-6, 1e-12, 1e-15),
        "prescribed displacement was not enforced");
  require(near(prescribed.results().raw_von_mises_max.value, 1000, 2e-8, 1e-5),
          "prescribed displacement stress wrong");
  require(std::abs(prescribed.results().total_reaction_n[0]) < 1e-6,
          "prescribed displacement reactions do not self-equilibrate");
  Context gravity;
  require(gravity.load_mesh(cube_mesh()), "gravity mesh rejected");
  require(gravity.set_material({1e9, .25, 1000}), "gravity material rejected");
  require(gravity.set_constraints({{0, 0},
                                   {1, 0},
                                   {2, 0},
                                   {6, 0},
                                   {7, 0},
                                   {8, 0},
                                   {12, 0},
                                   {13, 0},
                                   {14, 0},
                                   {18, 0},
                                   {19, 0},
                                   {20, 0}}),
          "gravity constraints rejected");
  Loads loads;
  loads.gravity_enabled = true;
  loads.gravity_m_s2 = {0, 0, -10};
  require(gravity.set_loads(loads), "gravity load rejected");
  require(gravity.solve(),
          "gravity solve failed: " + gravity.last_diagnostic().message);
  require(
      near(gravity.results().total_applied_force_n[2], -10000, 1e-10, 1e-6) &&
          near(gravity.results().total_reaction_n[2], 10000, 1e-9, 1e-5),
      "gravity resultant/reaction wrong");
  Context pressure;
  require(pressure.load_mesh(cube_mesh()), "pressure mesh rejected");
  require(pressure.set_material({1e9, .25, 0}), "pressure material rejected");
  require(pressure.set_constraints({{0, 0},
                                    {1, 0},
                                    {2, 0},
                                    {6, 0},
                                    {7, 0},
                                    {8, 0},
                                    {12, 0},
                                    {13, 0},
                                    {14, 0},
                                    {18, 0},
                                    {19, 0},
                                    {20, 0}}),
          "pressure constraints rejected");
  Loads pressure_loads;
  SurfaceLoad pressure_load;
  pressure_load.type = SurfaceLoadType::pressure;
  pressure_load.pressure_pa = 1000;
  pressure_load.triangle_connectivity = {1, 3, 7, 1, 7, 5};
  pressure_loads.surface_loads.push_back(pressure_load);
  require(pressure.set_loads(pressure_loads), "pressure load rejected");
  require(pressure.solve(),
          "pressure solve failed: " + pressure.last_diagnostic().message);
  require(
      near(pressure.results().total_applied_force_n[0], -1000, 1e-12, 1e-8) &&
          near(pressure.results().total_reaction_n[0], 1000, 1e-9, 1e-5),
      "pressure resultant/reaction wrong");
  return 0;
}
