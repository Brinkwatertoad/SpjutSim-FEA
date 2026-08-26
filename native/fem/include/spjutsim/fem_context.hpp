#pragma once

#include "spjutsim/fem_types.hpp"
#include "spjutsim/sparse.hpp"

namespace spjutsim::fem {

class Context {
public:
  static constexpr std::uint32_t protocol_version() noexcept {
    return kApiVersion;
  }

  bool load_mesh(Mesh mesh);
  bool set_material(Material material);
  bool set_constraints(std::vector<PrescribedDof> constraints);
  bool set_loads(Loads loads);
  bool preflight(double device_memory_gib_hint = 0.0,
                 std::uint64_t wasm_heap_cap_bytes = kDefaultWasmHeapCapBytes,
                 double safety_multiplier = kDefaultMemorySafetyMultiplier);
  bool solve(const SolveSettings &settings = {});

  const MemoryEstimate &memory_estimate() const noexcept {
    return memory_estimate_;
  }
  const Results &results() const noexcept { return results_; }
  const Diagnostic &last_diagnostic() const noexcept { return diagnostic_; }
  const SolverDiagnostics &last_solver_diagnostics() const noexcept {
    return solver_diagnostics_;
  }
  const CsrGraph &graph() const noexcept { return graph_; }

private:
  void invalidate_analysis();
  bool validate_and_prepare_constraints();

  Mesh mesh_;
  Material material_;
  Loads loads_;
  std::vector<PrescribedDof> constraints_;
  CsrGraph graph_;
  MemoryEstimate memory_estimate_;
  Results results_;
  Diagnostic diagnostic_;
  SolverDiagnostics solver_diagnostics_;
  bool mesh_valid_ = false;
  bool material_valid_ = false;
  bool graph_valid_ = false;
};

} // namespace spjutsim::fem
