#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <limits>
#include <string>
#include <vector>

namespace spjutsim::fem {

inline constexpr std::uint32_t kApiVersion = 1;
inline constexpr double kDefaultJacobianRelativeTolerance = 1.0e-12;
inline constexpr double kDefaultPcgRelativeTolerance = 1.0e-8;
inline constexpr double kDefaultEquilibriumTolerance = 1.0e-6;
inline constexpr double kDefaultMemorySafetyMultiplier = 1.5;
inline constexpr std::uint64_t kDefaultWasmHeapCapBytes = 3758096384ULL;
inline constexpr std::uint64_t kEightGiB = 8589934592ULL;

enum class ErrorCode {
  none,
  invalid_argument,
  unsupported_element_type,
  mesh_invalid_index,
  mesh_invalid_jacobian,
  material_invalid,
  constraint_conflict,
  likely_rigid_body_mode,
  graph_index_overflow,
  memory_limit_exceeded,
  cancelled,
  solver_non_finite,
  solver_non_spd,
  solver_stagnated,
  solver_not_converged,
  equilibrium_check_failed
};

const char *error_code_name(ErrorCode code) noexcept;
const char *error_stage(ErrorCode code) noexcept;

struct Diagnostic {
  ErrorCode code = ErrorCode::none;
  std::string message;
  std::string detail;
  bool recoverable = true;
};

struct Mesh {
  std::vector<double> node_positions_m;
  std::vector<std::uint32_t> tet4_connectivity;
};

struct Material {
  double youngs_modulus_pa = 0.0;
  double poisson_ratio = 0.0;
  double density_kg_m3 = 0.0;
};

struct PrescribedDof {
  std::uint32_t dof = 0;
  double value_m = 0.0;
};

enum class SurfaceLoadType { pressure, total_force };

struct SurfaceLoad {
  SurfaceLoadType type = SurfaceLoadType::pressure;
  std::vector<std::uint32_t> triangle_connectivity;
  double pressure_pa = 0.0;
  std::array<double, 3> total_force_n{0.0, 0.0, 0.0};
};

struct Loads {
  std::vector<double> nodal_forces_n;
  std::vector<SurfaceLoad> surface_loads;
  bool gravity_enabled = false;
  std::array<double, 3> gravity_m_s2{0.0, 0.0, -9.80665};
};

struct SolveSettings {
  double relative_tolerance = kDefaultPcgRelativeTolerance;
  double equilibrium_tolerance = kDefaultEquilibriumTolerance;
  std::uint32_t max_iterations = 0;
  std::uint32_t cancellation_check_interval = 8;
  std::function<bool()> is_cancelled;
};

enum class TerminationReason {
  converged,
  cancelled,
  non_finite,
  non_spd,
  stagnated,
  iteration_limit
};
const char *termination_reason_name(TerminationReason reason) noexcept;

struct SolverDiagnostics {
  std::uint32_t iterations = 0;
  double final_relative_residual = std::numeric_limits<double>::infinity();
  double duration_ms = 0.0;
  TerminationReason termination = TerminationReason::iteration_limit;
  bool converged = false;
};

struct Extremum {
  double value = 0.0;
  std::uint32_t element_index = 0;
};

struct Results {
  std::vector<double> displacement_m;
  std::vector<double> displacement_magnitude_m;
  std::vector<double> element_strain;
  std::vector<double> element_stress_pa;
  std::vector<double> element_von_mises_pa;
  std::vector<double> element_max_principal_pa;
  std::vector<double> element_min_principal_pa;
  std::vector<double> reaction_n;
  std::array<double, 3> total_reaction_n{0.0, 0.0, 0.0};
  std::array<double, 3> total_applied_force_n{0.0, 0.0, 0.0};
  double strain_energy_j = 0.0;
  double force_balance_relative_residual = 0.0;
  Extremum raw_von_mises_max;
  Extremum raw_max_principal;
  Extremum raw_min_principal;
  SolverDiagnostics solver;
};

enum class MemoryClassification { likely_safe, caution, likely_insufficient };
const char *
memory_classification_name(MemoryClassification classification) noexcept;

struct MemoryEstimate {
  std::uint32_t version = 1;
  std::uint64_t node_count = 0, element_count = 0, degree_of_freedom_count = 0;
  std::uint64_t adjacency_edge_count = 0, exact_nnz = 0;
  std::uint64_t mesh_storage_bytes = 0, graph_bytes = 0;
  std::uint64_t matrix_values_bytes = 0, matrix_index_bytes = 0,
                row_pointer_bytes = 0;
  std::uint64_t assembly_work_bytes = 0, solver_work_bytes = 0,
                result_bytes = 0;
  std::uint64_t runtime_overhead_bytes = 0, modeled_peak_bytes = 0;
  double safety_multiplier = kDefaultMemorySafetyMultiplier;
  std::uint64_t estimated_peak_bytes = 0;
  std::uint64_t wasm_heap_cap_bytes = kDefaultWasmHeapCapBytes;
  double device_memory_gib_hint = 0.0;
  MemoryClassification classification = MemoryClassification::likely_safe;
  bool exceeds_wasm_cap = false;
  bool requires_eight_gib_confirmation = false;
};

} // namespace spjutsim::fem
