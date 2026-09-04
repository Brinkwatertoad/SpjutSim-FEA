#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SPJUTSIM_FEM_API_VERSION 2u

typedef struct FemContext FemContext;
typedef void (*FemPhaseCallback)(uint32_t phase, void *user_data);

typedef struct FemSolveSettings {
  uint32_t api_version;
  uint32_t struct_size;
  double relative_tolerance;
  double equilibrium_tolerance;
  uint32_t max_iterations;
  uint32_t cancellation_check_interval;
} FemSolveSettings;

typedef struct FemMemoryEstimate {
  uint32_t api_version, struct_size, model_version, classification;
  uint64_t node_count, element_count, degree_of_freedom_count,
      adjacency_edge_count, exact_nnz;
  uint64_t mesh_storage_bytes, graph_bytes, matrix_values_bytes,
      matrix_index_bytes, row_pointer_bytes;
  uint64_t assembly_work_bytes, solver_work_bytes, result_bytes,
      runtime_overhead_bytes;
  uint64_t modeled_peak_bytes, estimated_peak_bytes, wasm_heap_cap_bytes;
  double safety_multiplier, device_memory_gib_hint;
  uint8_t exceeds_wasm_cap, requires_eight_gib_confirmation;
} FemMemoryEstimate;

typedef struct FemResultInfo {
  uint32_t api_version, struct_size, node_count, element_count,
      degree_of_freedom_count, recovery_sample_count;
  uint32_t iterations, termination_reason;
  double final_relative_residual, solve_duration_ms, strain_energy_j,
      force_balance_relative_residual;
  double total_reaction_n[3], total_applied_force_n[3];
  double raw_von_mises_max_pa, raw_max_principal_pa, raw_min_principal_pa;
  uint32_t raw_von_mises_element, raw_max_principal_element,
      raw_min_principal_element;
  uint32_t raw_von_mises_sample, raw_max_principal_sample,
      raw_min_principal_sample;
  const double *displacement_m;
  const double *displacement_magnitude_m;
  const double *element_strain;
  const double *element_stress_pa;
  const double *element_von_mises_pa;
  const double *element_max_principal_pa;
  const double *element_min_principal_pa;
  const double *reaction_n;
  const double *recovery_strain;
  const double *recovery_stress_pa;
  const double *recovery_von_mises_pa;
  const double *recovery_max_principal_pa;
  const double *recovery_min_principal_pa;
  const uint32_t *recovery_sample_element;
} FemResultInfo;

typedef struct FemErrorInfo {
  uint32_t api_version, struct_size;
  const char *code;
  const char *stage;
  const char *user_message;
  const char *developer_message;
  uint32_t solver_iterations, solver_termination_reason;
  double solver_final_relative_residual, solver_duration_ms;
  uint8_t recoverable;
} FemErrorInfo;

FemContext *fem_create(void);
void fem_destroy(FemContext *context);
int fem_load_mesh(FemContext *context, const double *node_positions_m,
                  uint32_t node_count, const uint32_t *element_connectivity,
                  uint32_t element_count, uint32_t nodes_per_element);
int fem_set_material(FemContext *context, double youngs_modulus_pa,
                     double poisson_ratio, double density_kg_m3);
int fem_set_constraints(FemContext *context, const uint32_t *dof_indices,
                        const double *values_m, uint32_t count);
int fem_clear_loads(FemContext *context);
int fem_set_nodal_forces(FemContext *context, const double *forces_n,
                         uint32_t degree_of_freedom_count);
int fem_add_pressure(FemContext *context, const uint32_t *triangles,
                     uint32_t triangle_count, uint32_t nodes_per_face,
                     double pressure_pa);
int fem_add_total_face_force(FemContext *context, const uint32_t *triangles,
                             uint32_t triangle_count, uint32_t nodes_per_face,
                             const double force_n[3]);
int fem_set_gravity(FemContext *context, int enabled,
                    const double acceleration_m_s2[3]);
int fem_set_phase_callback(FemContext *context, FemPhaseCallback callback,
                           void *user_data);
int fem_estimate_memory(FemContext *context, double device_memory_gib_hint,
                        uint64_t wasm_heap_cap_bytes, double safety_multiplier,
                        FemMemoryEstimate *out);
int fem_solve(FemContext *context, const FemSolveSettings *settings);
int fem_get_result_info(FemContext *context, FemResultInfo *out);
int fem_get_last_error(FemContext *context, FemErrorInfo *out);

#ifdef __cplusplus
}
#endif
