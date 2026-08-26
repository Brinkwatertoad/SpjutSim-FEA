#include "spjutsim/fem_c_api.h"

#include "spjutsim/fem_context.hpp"

#include <exception>
#include <limits>
#include <new>

struct FemContext {
  spjutsim::fem::Context implementation;
  spjutsim::fem::Loads loads;
  spjutsim::fem::Diagnostic bridge_error;
};

namespace {
using namespace spjutsim::fem;
int status(bool ok) { return ok ? 0 : -1; }
bool valid_header(std::uint32_t version, std::uint32_t size,
                  std::size_t required) {
  return version == SPJUTSIM_FEM_API_VERSION && size >= required;
}
template <typename Operation>
int guarded(FemContext *context, Operation &&operation) noexcept {
  if (!context)
    return -1;
  try {
    context->bridge_error = {};
    return operation();
  } catch (const std::bad_alloc &) {
    context->bridge_error = {
        ErrorCode::memory_limit_exceeded,
        "The native FEM API could not allocate the requested input buffers.",
        {},
        true};
  } catch (const std::exception &error) {
    context->bridge_error = {ErrorCode::invalid_argument,
                             "The native FEM API rejected the request.",
                             error.what(), true};
  } catch (...) {
    context->bridge_error = {ErrorCode::invalid_argument,
                             "The native FEM API rejected the request.",
                             {},
                             true};
  }
  return -1;
}
} // namespace

extern "C" {
FemContext *fem_create(void) {
  try {
    return new FemContext;
  } catch (...) {
    return nullptr;
  }
}
void fem_destroy(FemContext *context) { delete context; }
int fem_load_mesh(FemContext *c, const double *positions, uint32_t nodes,
                  const uint32_t *connectivity, uint32_t elements,
                  uint32_t nodes_per_element) {
  if (!c || !positions || !connectivity || nodes == 0 || elements == 0)
    return -1;
  return guarded(c, [&]() {
    if (nodes_per_element != 4) {
      c->bridge_error = {ErrorCode::unsupported_element_type,
                         "Only four-node tetrahedral elements are supported by "
                         "this solver version.",
                         {},
                         true};
      return -1;
    }
    if (nodes > std::numeric_limits<uint32_t>::max() / 3 ||
        static_cast<std::size_t>(nodes) >
            std::numeric_limits<std::size_t>::max() / 3 ||
        static_cast<std::size_t>(elements) >
            std::numeric_limits<std::size_t>::max() / 4) {
      c->bridge_error = {
          ErrorCode::graph_index_overflow,
          "The mesh buffer sizes exceed the supported 32-bit solver range.",
          {},
          true};
      return -1;
    }
    Mesh m;
    m.node_positions_m.assign(positions,
                              positions + static_cast<std::size_t>(nodes) * 3);
    m.tet4_connectivity.assign(
        connectivity, connectivity + static_cast<std::size_t>(elements) * 4);
    return status(c->implementation.load_mesh(std::move(m)));
  });
}
int fem_set_material(FemContext *c, double e, double nu, double density) {
  return guarded(c, [&]() {
    return status(c->implementation.set_material({e, nu, density}));
  });
}
int fem_set_constraints(FemContext *c, const uint32_t *dofs,
                        const double *values, uint32_t count) {
  if (!c || (count && (!dofs || !values)))
    return -1;
  return guarded(c, [&]() {
    std::vector<PrescribedDof> constraints;
    constraints.reserve(count);
    for (uint32_t i = 0; i < count; ++i)
      constraints.push_back({dofs[i], values[i]});
    return status(c->implementation.set_constraints(std::move(constraints)));
  });
}
int fem_clear_loads(FemContext *c) {
  return guarded(c, [&]() {
    c->loads = {};
    return status(c->implementation.set_loads(c->loads));
  });
}
int fem_set_nodal_forces(FemContext *c, const double *forces, uint32_t count) {
  if (!c || (count && !forces))
    return -1;
  return guarded(c, [&]() {
    if (count)
      c->loads.nodal_forces_n.assign(forces, forces + count);
    else
      c->loads.nodal_forces_n.clear();
    return status(c->implementation.set_loads(c->loads));
  });
}
int fem_add_pressure(FemContext *c, const uint32_t *triangles, uint32_t count,
                     double pressure) {
  if (!c || !triangles || count == 0)
    return -1;
  return guarded(c, [&]() {
    if (static_cast<std::size_t>(count) >
        std::numeric_limits<std::size_t>::max() / 3)
      return -1;
    SurfaceLoad load;
    load.type = SurfaceLoadType::pressure;
    load.pressure_pa = pressure;
    load.triangle_connectivity.assign(
        triangles, triangles + static_cast<std::size_t>(count) * 3);
    c->loads.surface_loads.push_back(std::move(load));
    return status(c->implementation.set_loads(c->loads));
  });
}
int fem_add_total_face_force(FemContext *c, const uint32_t *triangles,
                             uint32_t count, const double force[3]) {
  if (!c || !triangles || !force || count == 0)
    return -1;
  return guarded(c, [&]() {
    if (static_cast<std::size_t>(count) >
        std::numeric_limits<std::size_t>::max() / 3)
      return -1;
    SurfaceLoad load;
    load.type = SurfaceLoadType::total_force;
    load.total_force_n = {force[0], force[1], force[2]};
    load.triangle_connectivity.assign(
        triangles, triangles + static_cast<std::size_t>(count) * 3);
    c->loads.surface_loads.push_back(std::move(load));
    return status(c->implementation.set_loads(c->loads));
  });
}
int fem_set_gravity(FemContext *c, int enabled, const double a[3]) {
  if (!c || !a)
    return -1;
  return guarded(c, [&]() {
    c->loads.gravity_enabled = enabled != 0;
    c->loads.gravity_m_s2 = {a[0], a[1], a[2]};
    return status(c->implementation.set_loads(c->loads));
  });
}
int fem_estimate_memory(FemContext *c, double device, uint64_t cap,
                        double multiplier, FemMemoryEstimate *out) {
  if (!c || !out ||
      !valid_header(out->api_version, out->struct_size, sizeof(*out)))
    return -1;
  return guarded(c, [&]() {
    const bool valid = c->implementation.preflight(device, cap, multiplier);
    if (!valid && c->implementation.last_diagnostic().code !=
                      ErrorCode::memory_limit_exceeded)
      return -1;
    const auto &e = c->implementation.memory_estimate();
    out->model_version = e.version;
    out->classification = static_cast<uint32_t>(e.classification);
    out->node_count = e.node_count;
    out->element_count = e.element_count;
    out->degree_of_freedom_count = e.degree_of_freedom_count;
    out->adjacency_edge_count = e.adjacency_edge_count;
    out->exact_nnz = e.exact_nnz;
    out->mesh_storage_bytes = e.mesh_storage_bytes;
    out->graph_bytes = e.graph_bytes;
    out->matrix_values_bytes = e.matrix_values_bytes;
    out->matrix_index_bytes = e.matrix_index_bytes;
    out->row_pointer_bytes = e.row_pointer_bytes;
    out->assembly_work_bytes = e.assembly_work_bytes;
    out->solver_work_bytes = e.solver_work_bytes;
    out->result_bytes = e.result_bytes;
    out->runtime_overhead_bytes = e.runtime_overhead_bytes;
    out->modeled_peak_bytes = e.modeled_peak_bytes;
    out->estimated_peak_bytes = e.estimated_peak_bytes;
    out->wasm_heap_cap_bytes = e.wasm_heap_cap_bytes;
    out->safety_multiplier = e.safety_multiplier;
    out->device_memory_gib_hint = e.device_memory_gib_hint;
    out->exceeds_wasm_cap = e.exceeds_wasm_cap;
    out->requires_eight_gib_confirmation = e.requires_eight_gib_confirmation;
    return 0;
  });
}
int fem_solve(FemContext *c, const FemSolveSettings *settings) {
  if (!c || !settings ||
      !valid_header(settings->api_version, settings->struct_size,
                    sizeof(*settings)))
    return -1;
  return guarded(c, [&]() {
    SolveSettings s;
    s.relative_tolerance = settings->relative_tolerance;
    s.equilibrium_tolerance = settings->equilibrium_tolerance;
    s.max_iterations = settings->max_iterations;
    s.cancellation_check_interval = settings->cancellation_check_interval;
    return status(c->implementation.solve(s));
  });
}
int fem_get_result_info(FemContext *c, FemResultInfo *out) {
  if (!c || !out ||
      !valid_header(out->api_version, out->struct_size, sizeof(*out)))
    return -1;
  const auto &r = c->implementation.results();
  if (!r.solver.converged)
    return -1;
  out->node_count = static_cast<uint32_t>(r.displacement_magnitude_m.size());
  out->element_count = static_cast<uint32_t>(r.element_von_mises_pa.size());
  out->degree_of_freedom_count = static_cast<uint32_t>(r.displacement_m.size());
  out->iterations = r.solver.iterations;
  out->termination_reason = static_cast<uint32_t>(r.solver.termination);
  out->final_relative_residual = r.solver.final_relative_residual;
  out->solve_duration_ms = r.solver.duration_ms;
  out->strain_energy_j = r.strain_energy_j;
  out->force_balance_relative_residual = r.force_balance_relative_residual;
  for (int i = 0; i < 3; ++i) {
    out->total_reaction_n[i] = r.total_reaction_n[i];
    out->total_applied_force_n[i] = r.total_applied_force_n[i];
  }
  out->raw_von_mises_max_pa = r.raw_von_mises_max.value;
  out->raw_max_principal_pa = r.raw_max_principal.value;
  out->raw_min_principal_pa = r.raw_min_principal.value;
  out->raw_von_mises_element = r.raw_von_mises_max.element_index;
  out->raw_max_principal_element = r.raw_max_principal.element_index;
  out->raw_min_principal_element = r.raw_min_principal.element_index;
  out->displacement_m = r.displacement_m.data();
  out->displacement_magnitude_m = r.displacement_magnitude_m.data();
  out->element_strain = r.element_strain.data();
  out->element_stress_pa = r.element_stress_pa.data();
  out->element_von_mises_pa = r.element_von_mises_pa.data();
  out->element_max_principal_pa = r.element_max_principal_pa.data();
  out->element_min_principal_pa = r.element_min_principal_pa.data();
  out->reaction_n = r.reaction_n.data();
  return 0;
}
int fem_get_last_error(FemContext *c, FemErrorInfo *out) {
  if (!c || !out ||
      !valid_header(out->api_version, out->struct_size, sizeof(*out)))
    return -1;
  const auto &d = c->bridge_error.code != ErrorCode::none
                      ? c->bridge_error
                      : c->implementation.last_diagnostic();
  out->code = error_code_name(d.code);
  out->stage = error_stage(d.code);
  out->user_message = d.message.c_str();
  out->developer_message = d.detail.c_str();
  const auto &solver = c->implementation.last_solver_diagnostics();
  out->solver_iterations = solver.iterations;
  out->solver_termination_reason = static_cast<uint32_t>(solver.termination);
  out->solver_final_relative_residual = solver.final_relative_residual;
  out->solver_duration_ms = solver.duration_ms;
  out->recoverable = d.recoverable;
  return 0;
}
}
