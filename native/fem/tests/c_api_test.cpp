#include "spjutsim/fem_c_api.h"
#include "test_support.hpp"

#include <cstring>

int main() {
  auto mesh = cube_mesh();
  FemContext *context = fem_create();
  require(context != nullptr, "C API context allocation failed");
  require(fem_load_mesh(context, mesh.node_positions_m.data(), 8,
                        mesh.tet4_connectivity.data(), 6, 7) != 0,
          "unsupported element type accepted");
  FemErrorInfo error{SPJUTSIM_FEM_API_VERSION, sizeof(FemErrorInfo)};
  require(fem_get_last_error(context, &error) == 0 &&
              std::strcmp(error.code, "UNSUPPORTED_ELEMENT_TYPE") == 0,
          "C API did not return versioned unsupported-element diagnostic");
  require(fem_load_mesh(context, mesh.node_positions_m.data(), 8,
                        mesh.tet4_connectivity.data(), 6, 4) == 0,
          "C API mesh load failed");
  require(fem_set_material(context, 1e9, .25, 1000) == 0,
          "C API material failed");
  auto constraints = axial_constraints();
  std::vector<uint32_t> dofs;
  std::vector<double> values;
  for (auto c : constraints) {
    dofs.push_back(c.dof);
    values.push_back(c.value_m);
  }
  require(fem_set_constraints(context, dofs.data(), values.data(),
                              static_cast<uint32_t>(dofs.size())) == 0,
          "C API constraints failed");
  const uint32_t face[] = {1, 3, 7, 1, 7, 5};
  const double force[] = {1000, 0, 0};
  require(fem_add_total_face_force(context, face, 2, 3, force) == 0,
          "C API surface force failed");
  FemMemoryEstimate estimate{SPJUTSIM_FEM_API_VERSION,
                             sizeof(FemMemoryEstimate)};
  require(fem_estimate_memory(context, 8, 3758096384ULL, 1.5, &estimate) == 0,
          "C API preflight failed");
  require(estimate.degree_of_freedom_count == 24 && estimate.exact_nnz > 0,
          "C API estimate fields missing");
  FemMemoryEstimate capped{SPJUTSIM_FEM_API_VERSION, sizeof(FemMemoryEstimate)};
  require(fem_estimate_memory(context, 0, 1024, 1.5, &capped) == 0 &&
              capped.exceeds_wasm_cap,
          "C API hid an over-cap estimate");
  require(fem_estimate_memory(context, 8, 3758096384ULL, 1.5, &estimate) == 0,
          "C API preflight restore failed");
  FemSolveSettings settings{
      SPJUTSIM_FEM_API_VERSION, sizeof(FemSolveSettings), 1e-11, 1e-6, 0, 8};
  require(fem_solve(context, &settings) == 0, "C API solve failed");
  FemResultInfo result{SPJUTSIM_FEM_API_VERSION, sizeof(FemResultInfo)};
  require(fem_get_result_info(context, &result) == 0,
          "C API result view failed");
  require(result.node_count == 8 && result.element_count == 6 &&
              result.recovery_sample_count == 6 &&
              near(result.total_reaction_n[0], -1000, 1e-9, 1e-6),
          "C API result contract wrong");
  require(std::isfinite(result.solve_duration_ms) &&
              result.solve_duration_ms >= 0,
          "C API omitted solve duration");
  FemResultInfo wrong{99, sizeof(FemResultInfo)};
  require(fem_get_result_info(context, &wrong) != 0,
          "C API accepted mismatched result ABI version");
  fem_destroy(context);
  return 0;
}
