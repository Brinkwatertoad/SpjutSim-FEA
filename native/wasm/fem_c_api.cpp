// Narrow Emscripten accessors over the versioned native FEM C ABI.
#include "spjutsim/fem_c_api.h"

#include <cmath>
#include <cstdint>
#include <emscripten/heap.h>
#include <array>

namespace {
FemMemoryEstimate memory_estimate{};
FemResultInfo result_info{};
FemErrorInfo error_info{};
std::array<std::uint64_t, 3> phase_memory_bytes{};

void sample_phase(uint32_t phase, void *) {
  if (phase < phase_memory_bytes.size())
    phase_memory_bytes[phase] = emscripten_get_heap_size();
}

template <typename T> void initialize(T &value) {
  value = {};
  value.api_version = SPJUTSIM_FEM_API_VERSION;
  value.struct_size = sizeof(T);
}
} // namespace

extern "C" {
uint32_t fem_wasm_api_version() { return SPJUTSIM_FEM_API_VERSION; }

int fem_wasm_preflight(FemContext *context, double device_memory_gib,
                       double wasm_heap_cap_bytes, double safety_multiplier) {
  initialize(memory_estimate);
  if (!std::isfinite(wasm_heap_cap_bytes) || wasm_heap_cap_bytes < 0)
    return -1;
  return fem_estimate_memory(context, device_memory_gib,
                             static_cast<uint64_t>(wasm_heap_cap_bytes),
                             safety_multiplier, &memory_estimate);
}

double fem_wasm_memory_value(uint32_t key) {
  switch (key) {
  case 0: return static_cast<double>(memory_estimate.model_version);
  case 1: return static_cast<double>(memory_estimate.classification);
  case 2: return static_cast<double>(memory_estimate.node_count);
  case 3: return static_cast<double>(memory_estimate.element_count);
  case 4: return static_cast<double>(memory_estimate.degree_of_freedom_count);
  case 5: return static_cast<double>(memory_estimate.adjacency_edge_count);
  case 6: return static_cast<double>(memory_estimate.exact_nnz);
  case 7: return static_cast<double>(memory_estimate.modeled_peak_bytes);
  case 8: return static_cast<double>(memory_estimate.estimated_peak_bytes);
  case 9: return static_cast<double>(memory_estimate.wasm_heap_cap_bytes);
  case 10: return memory_estimate.safety_multiplier;
  case 11: return memory_estimate.device_memory_gib_hint;
  case 12: return memory_estimate.exceeds_wasm_cap;
  case 13: return memory_estimate.requires_eight_gib_confirmation;
  case 14: return static_cast<double>(memory_estimate.mesh_storage_bytes);
  case 15: return static_cast<double>(memory_estimate.graph_bytes);
  case 16: return static_cast<double>(memory_estimate.matrix_values_bytes);
  case 17: return static_cast<double>(memory_estimate.matrix_index_bytes);
  case 18: return static_cast<double>(memory_estimate.row_pointer_bytes);
  case 19: return static_cast<double>(memory_estimate.assembly_work_bytes);
  case 20: return static_cast<double>(memory_estimate.solver_work_bytes);
  case 21: return static_cast<double>(memory_estimate.result_bytes);
  case 22: return static_cast<double>(memory_estimate.runtime_overhead_bytes);
  default: return 0;
  }
}

int fem_wasm_solve(FemContext *context, double relative_tolerance,
                   double equilibrium_tolerance, uint32_t max_iterations) {
  FemSolveSettings settings{};
  settings.api_version = SPJUTSIM_FEM_API_VERSION;
  settings.struct_size = sizeof(settings);
  settings.relative_tolerance = relative_tolerance;
  settings.equilibrium_tolerance = equilibrium_tolerance;
  settings.max_iterations = max_iterations;
  settings.cancellation_check_interval = 8;
  phase_memory_bytes = {};
  fem_set_phase_callback(context, sample_phase, nullptr);
  return fem_solve(context, &settings);
}

double fem_wasm_phase_memory_value(uint32_t key) {
  return key < phase_memory_bytes.size()
             ? static_cast<double>(phase_memory_bytes[key])
             : 0;
}

int fem_wasm_read_results(FemContext *context) {
  initialize(result_info);
  return fem_get_result_info(context, &result_info);
}

double fem_wasm_result_value(uint32_t key) {
  switch (key) {
  case 0: return result_info.node_count;
  case 1: return result_info.element_count;
  case 2: return result_info.degree_of_freedom_count;
  case 3: return result_info.iterations;
  case 4: return result_info.termination_reason;
  case 5: return result_info.final_relative_residual;
  case 6: return result_info.solve_duration_ms;
  case 7: return result_info.strain_energy_j;
  case 8: return result_info.force_balance_relative_residual;
  case 9: return result_info.total_reaction_n[0];
  case 10: return result_info.total_reaction_n[1];
  case 11: return result_info.total_reaction_n[2];
  case 12: return result_info.total_applied_force_n[0];
  case 13: return result_info.total_applied_force_n[1];
  case 14: return result_info.total_applied_force_n[2];
  case 15: return result_info.raw_von_mises_max_pa;
  case 16: return result_info.raw_max_principal_pa;
  case 17: return result_info.raw_min_principal_pa;
  case 18: return result_info.raw_von_mises_element;
  case 19: return result_info.raw_max_principal_element;
  case 20: return result_info.raw_min_principal_element;
  case 21: return result_info.recovery_sample_count;
  case 22: return result_info.raw_von_mises_sample;
  case 23: return result_info.raw_max_principal_sample;
  case 24: return result_info.raw_min_principal_sample;
  default: return 0;
  }
}

const double *fem_wasm_result_pointer(uint32_t key) {
  switch (key) {
  case 0: return result_info.displacement_m;
  case 1: return result_info.displacement_magnitude_m;
  case 2: return result_info.element_strain;
  case 3: return result_info.element_stress_pa;
  case 4: return result_info.element_von_mises_pa;
  case 5: return result_info.element_max_principal_pa;
  case 6: return result_info.element_min_principal_pa;
  case 7: return result_info.reaction_n;
  case 8: return result_info.recovery_strain;
  case 9: return result_info.recovery_stress_pa;
  case 10: return result_info.recovery_von_mises_pa;
  case 11: return result_info.recovery_max_principal_pa;
  case 12: return result_info.recovery_min_principal_pa;
  default: return nullptr;
  }
}

const uint32_t *fem_wasm_result_index_pointer(uint32_t key) {
  return key == 0 ? result_info.recovery_sample_element : nullptr;
}

int fem_wasm_read_error(FemContext *context) {
  initialize(error_info);
  return fem_get_last_error(context, &error_info);
}

const char *fem_wasm_error_string(uint32_t key) {
  switch (key) {
  case 0: return error_info.code;
  case 1: return error_info.stage;
  case 2: return error_info.user_message;
  case 3: return error_info.developer_message;
  default: return "";
  }
}

double fem_wasm_error_value(uint32_t key) {
  switch (key) {
  case 0: return error_info.solver_iterations;
  case 1: return error_info.solver_termination_reason;
  case 2: return error_info.solver_final_relative_residual;
  case 3: return error_info.solver_duration_ms;
  case 4: return error_info.recoverable;
  default: return 0;
  }
}
}
