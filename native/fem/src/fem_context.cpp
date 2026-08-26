#include "spjutsim/fem_context.hpp"

#include "spjutsim/pcg.hpp"
#include "spjutsim/tet4.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <new>
#include <numeric>
#include <unordered_map>

namespace spjutsim::fem {
namespace {
Diagnostic make_error(ErrorCode code, const char *message,
                      const char *detail = "") {
  return {code, message, detail, true};
}
std::array<double, 12> element_coordinates(const Mesh &mesh,
                                           std::size_t offset) {
  std::array<double, 12> x{};
  for (int n = 0; n < 4; ++n)
    for (int axis = 0; axis < 3; ++axis)
      x[n * 3 + axis] =
          mesh.node_positions_m[mesh.tet4_connectivity[offset + n] * 3 + axis];
  return x;
}
std::array<double, 9>
triangle_coordinates(const Mesh &mesh,
                     const std::vector<std::uint32_t> &indices,
                     std::size_t offset) {
  std::array<double, 9> x{};
  for (int n = 0; n < 3; ++n)
    for (int axis = 0; axis < 3; ++axis)
      x[n * 3 + axis] = mesh.node_positions_m[indices[offset + n] * 3 + axis];
  return x;
}
double triangle_area(const std::array<double, 9> &x) {
  const double ax = x[3] - x[0], ay = x[4] - x[1], az = x[5] - x[2],
               bx = x[6] - x[0], by = x[7] - x[1], bz = x[8] - x[2];
  const double nx = ay * bz - az * by, ny = az * bx - ax * bz,
               nz = ax * by - ay * bx;
  return 0.5 * std::sqrt(nx * nx + ny * ny + nz * nz);
}
class DisjointSet {
public:
  explicit DisjointSet(std::size_t n) : p_(n), rank_(n) {
    std::iota(p_.begin(), p_.end(), 0);
  }
  std::uint32_t find(std::uint32_t x) {
    while (p_[x] != x) {
      p_[x] = p_[p_[x]];
      x = p_[x];
    }
    return x;
  }
  void unite(std::uint32_t a, std::uint32_t b) {
    a = find(a);
    b = find(b);
    if (a == b)
      return;
    if (rank_[a] < rank_[b])
      std::swap(a, b);
    p_[b] = a;
    if (rank_[a] == rank_[b])
      ++rank_[a];
  }

private:
  std::vector<std::uint32_t> p_;
  std::vector<unsigned char> rank_;
};
int matrix_rank_6(std::vector<std::array<double, 6>> rows) {
  double scale = 0;
  for (const auto &r : rows)
    for (double v : r)
      scale = std::max(scale, std::abs(v));
  const double tolerance = std::max(1.0, scale) * 1e-10;
  int rank = 0;
  for (int col = 0; col < 6 && rank < static_cast<int>(rows.size()); ++col) {
    int pivot = rank;
    for (int row = rank + 1; row < static_cast<int>(rows.size()); ++row)
      if (std::abs(rows[row][col]) > std::abs(rows[pivot][col]))
        pivot = row;
    if (std::abs(rows[pivot][col]) <= tolerance)
      continue;
    std::swap(rows[pivot], rows[rank]);
    const double divisor = rows[rank][col];
    for (int c = col; c < 6; ++c)
      rows[rank][c] /= divisor;
    for (int row = 0; row < static_cast<int>(rows.size()); ++row)
      if (row != rank) {
        const double factor = rows[row][col];
        for (int c = col; c < 6; ++c)
          rows[row][c] -= factor * rows[rank][c];
      }
    ++rank;
  }
  return rank;
}
bool has_six_rigid_constraints(const Mesh &mesh,
                               const std::vector<PrescribedDof> &constraints,
                               Diagnostic &diagnostic) {
  const auto nodes =
      static_cast<std::uint32_t>(mesh.node_positions_m.size() / 3);
  DisjointSet sets(nodes);
  for (std::size_t e = 0; e < mesh.tet4_connectivity.size(); e += 4)
    for (int n = 1; n < 4; ++n)
      sets.unite(mesh.tet4_connectivity[e], mesh.tet4_connectivity[e + n]);
  std::unordered_map<std::uint32_t, std::vector<std::uint32_t>> component_nodes;
  for (std::uint32_t n = 0; n < nodes; ++n)
    component_nodes[sets.find(n)].push_back(n);
  std::unordered_map<std::uint32_t, std::vector<PrescribedDof>>
      component_constraints;
  for (const auto &c : constraints)
    component_constraints[sets.find(c.dof / 3)].push_back(c);
  for (const auto &entry : component_nodes) {
    std::array<double, 3> center{};
    for (auto n : entry.second)
      for (int a = 0; a < 3; ++a)
        center[a] += mesh.node_positions_m[n * 3 + a];
    for (double &v : center)
      v /= entry.second.size();
    double coordinate_scale = 0;
    for (auto n : entry.second)
      for (int a = 0; a < 3; ++a)
        coordinate_scale =
            std::max(coordinate_scale,
                     std::abs(mesh.node_positions_m[n * 3 + a] - center[a]));
    coordinate_scale =
        std::max(coordinate_scale, std::numeric_limits<double>::min());
    std::vector<std::array<double, 6>> rows;
    for (const auto &c : component_constraints[entry.first]) {
      const auto node = c.dof / 3, axis = c.dof % 3;
      const double x = (mesh.node_positions_m[node * 3] - center[0]) /
                       coordinate_scale,
                   y = (mesh.node_positions_m[node * 3 + 1] - center[1]) /
                       coordinate_scale,
                   z = (mesh.node_positions_m[node * 3 + 2] - center[2]) /
                       coordinate_scale;
      if (axis == 0)
        rows.push_back({1, 0, 0, 0, z, -y});
      else if (axis == 1)
        rows.push_back({0, 1, 0, -z, 0, x});
      else
        rows.push_back({0, 0, 1, y, -x, 0});
    }
    if (matrix_rank_6(std::move(rows)) < 6) {
      diagnostic =
          make_error(ErrorCode::likely_rigid_body_mode,
                     "The supports do not suppress all rigid-body motion.",
                     "Each connected mesh component must constrain six "
                     "independent rigid modes.");
      return false;
    }
  }
  return true;
}
void add_element_vector(std::vector<double> &global,
                        const std::vector<std::uint32_t> &conn,
                        std::size_t offset,
                        const std::array<double, 12> &local) {
  for (int n = 0; n < 4; ++n)
    for (int a = 0; a < 3; ++a)
      global[conn[offset + n] * 3 + a] += local[n * 3 + a];
}
} // namespace

const char *error_code_name(ErrorCode code) noexcept {
  switch (code) {
  case ErrorCode::none:
    return "NONE";
  case ErrorCode::invalid_argument:
    return "INVALID_ARGUMENT";
  case ErrorCode::unsupported_element_type:
    return "UNSUPPORTED_ELEMENT_TYPE";
  case ErrorCode::mesh_invalid_index:
    return "MESH_INVALID_INDEX";
  case ErrorCode::mesh_invalid_jacobian:
    return "MESH_INVALID_JACOBIAN";
  case ErrorCode::material_invalid:
    return "MATERIAL_INVALID";
  case ErrorCode::constraint_conflict:
    return "CONSTRAINT_CONFLICT";
  case ErrorCode::likely_rigid_body_mode:
    return "LIKELY_RIGID_BODY_MODE";
  case ErrorCode::graph_index_overflow:
    return "GRAPH_INDEX_OVERFLOW";
  case ErrorCode::memory_limit_exceeded:
    return "MEMORY_LIMIT_EXCEEDED";
  case ErrorCode::cancelled:
    return "SOLVE_CANCELLED";
  case ErrorCode::solver_non_finite:
    return "SOLVER_NON_FINITE";
  case ErrorCode::solver_non_spd:
    return "SOLVER_NON_SPD";
  case ErrorCode::solver_stagnated:
    return "SOLVER_STAGNATED";
  case ErrorCode::solver_not_converged:
    return "SOLVER_NOT_CONVERGED";
  case ErrorCode::equilibrium_check_failed:
    return "EQUILIBRIUM_CHECK_FAILED";
  }
  return "UNKNOWN";
}
const char *error_stage(ErrorCode code) noexcept {
  switch (code) {
  case ErrorCode::mesh_invalid_index:
  case ErrorCode::mesh_invalid_jacobian:
  case ErrorCode::unsupported_element_type:
    return "mesh";
  case ErrorCode::material_invalid:
  case ErrorCode::constraint_conflict:
  case ErrorCode::likely_rigid_body_mode:
  case ErrorCode::graph_index_overflow:
  case ErrorCode::memory_limit_exceeded:
    return "preflight";
  case ErrorCode::solver_non_finite:
  case ErrorCode::solver_non_spd:
  case ErrorCode::solver_stagnated:
  case ErrorCode::solver_not_converged:
  case ErrorCode::cancelled:
    return "solve";
  case ErrorCode::equilibrium_check_failed:
    return "postprocess";
  default:
    return "input";
  }
}
const char *termination_reason_name(TerminationReason r) noexcept {
  switch (r) {
  case TerminationReason::converged:
    return "CONVERGED";
  case TerminationReason::cancelled:
    return "CANCELLED";
  case TerminationReason::non_finite:
    return "NON_FINITE";
  case TerminationReason::non_spd:
    return "NON_SPD";
  case TerminationReason::stagnated:
    return "STAGNATED";
  case TerminationReason::iteration_limit:
    return "ITERATION_LIMIT";
  }
  return "UNKNOWN";
}
const char *memory_classification_name(MemoryClassification c) noexcept {
  switch (c) {
  case MemoryClassification::likely_safe:
    return "LIKELY_SAFE";
  case MemoryClassification::caution:
    return "CAUTION";
  case MemoryClassification::likely_insufficient:
    return "LIKELY_INSUFFICIENT";
  }
  return "UNKNOWN";
}

void Context::invalidate_analysis() {
  results_ = {};
  memory_estimate_ = {};
  diagnostic_ = {};
  solver_diagnostics_ = {};
}
bool Context::load_mesh(Mesh mesh) {
  mesh_valid_ = graph_valid_ = false;
  invalidate_analysis();
  if (mesh.node_positions_m.empty() || mesh.node_positions_m.size() % 3 ||
      mesh.tet4_connectivity.empty() || mesh.tet4_connectivity.size() % 4) {
    diagnostic_ = make_error(ErrorCode::invalid_argument,
                             "The Tet4 mesh buffers are empty or incomplete.");
    return false;
  }
  if (mesh.node_positions_m.size() / 3 >
      std::numeric_limits<std::uint32_t>::max()) {
    diagnostic_ = make_error(
        ErrorCode::graph_index_overflow,
        "The mesh node count exceeds the supported 32-bit index range.");
    return false;
  }
  Diagnostic d;
  for (std::size_t e = 0; e < mesh.tet4_connectivity.size(); e += 4) {
    for (int n = 0; n < 4; ++n)
      if (mesh.tet4_connectivity[e + n] >= mesh.node_positions_m.size() / 3) {
        diagnostic_ = make_error(ErrorCode::mesh_invalid_index,
                                 "The mesh references a missing node.");
        return false;
      }
    Tet4Data data;
    if (!build_tet4_data(element_coordinates(mesh, e), data, d)) {
      diagnostic_ = d;
      return false;
    }
  }
  CsrGraph graph;
  try {
    if (!build_csr_graph(
            static_cast<std::uint32_t>(mesh.node_positions_m.size() / 3),
            mesh.tet4_connectivity, graph, d)) {
      diagnostic_ = d;
      return false;
    }
  } catch (const std::bad_alloc &) {
    diagnostic_ =
        make_error(ErrorCode::memory_limit_exceeded,
                   "The solver could not allocate the mesh topology graph.");
    return false;
  }
  mesh_ = std::move(mesh);
  graph_ = std::move(graph);
  mesh_valid_ = graph_valid_ = true;
  diagnostic_ = {};
  return true;
}
bool Context::set_material(Material m) {
  invalidate_analysis();
  material_valid_ = false;
  if (!(m.youngs_modulus_pa > 0) || !std::isfinite(m.youngs_modulus_pa) ||
      !(m.poisson_ratio > -1.0 && m.poisson_ratio < 0.5) ||
      !std::isfinite(m.poisson_ratio) || m.density_kg_m3 < 0 ||
      !std::isfinite(m.density_kg_m3)) {
    diagnostic_ = make_error(ErrorCode::material_invalid,
                             "Enter finite isotropic material properties with "
                             "E > 0 and -1 < nu < 0.5.");
    return false;
  }
  const auto constitutive = isotropic_constitutive_matrix(m);
  if (!std::all_of(constitutive.begin(), constitutive.end(),
                   [](double value) { return std::isfinite(value); })) {
    diagnostic_ = make_error(
        ErrorCode::material_invalid,
        "The material properties produce a non-finite constitutive matrix.");
    return false;
  }
  material_ = m;
  material_valid_ = true;
  diagnostic_ = {};
  return true;
}
bool Context::set_constraints(std::vector<PrescribedDof> c) {
  constraints_ = std::move(c);
  invalidate_analysis();
  try {
    return validate_and_prepare_constraints();
  } catch (const std::bad_alloc &) {
    diagnostic_ = make_error(
        ErrorCode::memory_limit_exceeded,
        "The solver could not allocate the constraint preflight data.");
    return false;
  }
}
bool Context::set_loads(Loads l) {
  loads_ = std::move(l);
  invalidate_analysis();
  diagnostic_ = {};
  return true;
}
bool Context::validate_and_prepare_constraints() {
  if (!mesh_valid_) {
    diagnostic_ = make_error(ErrorCode::invalid_argument,
                             "Load a valid mesh before defining supports.");
    return false;
  }
  std::sort(constraints_.begin(), constraints_.end(),
            [](const auto &a, const auto &b) { return a.dof < b.dof; });
  std::vector<PrescribedDof> unique;
  for (const auto &c : constraints_) {
    if (c.dof >= graph_.degree_of_freedom_count || !std::isfinite(c.value_m)) {
      diagnostic_ = make_error(ErrorCode::invalid_argument,
                               "A prescribed displacement is invalid.");
      return false;
    }
    if (!unique.empty() && unique.back().dof == c.dof) {
      if (unique.back().value_m != c.value_m) {
        diagnostic_ = make_error(ErrorCode::constraint_conflict,
                                 "Two supports prescribe different values on "
                                 "the same degree of freedom.");
        return false;
      }
    } else
      unique.push_back(c);
  }
  constraints_ = std::move(unique);
  diagnostic_ = {};
  return true;
}
bool Context::preflight(double device_gib, std::uint64_t cap,
                        double multiplier) {
  if (!(device_gib >= 0.0) || !std::isfinite(device_gib) || cap == 0 ||
      !(multiplier >= 1.0) || !std::isfinite(multiplier)) {
    diagnostic_ = make_error(
        ErrorCode::invalid_argument,
        "Memory preflight settings must be finite and use a positive cap and "
        "a safety multiplier of at least one.");
    return false;
  }
  if (!mesh_valid_ || !graph_valid_) {
    diagnostic_ = make_error(ErrorCode::invalid_argument,
                             "Load a valid Tet4 mesh before preflight.");
    return false;
  }
  if (!material_valid_) {
    diagnostic_ =
        make_error(ErrorCode::material_invalid,
                   "Define a valid isotropic material before preflight.");
    return false;
  }
  try {
    if (!validate_and_prepare_constraints())
      return false;
    if (!has_six_rigid_constraints(mesh_, constraints_, diagnostic_))
      return false;
  } catch (const std::bad_alloc &) {
    diagnostic_ = make_error(
        ErrorCode::memory_limit_exceeded,
        "The solver could not allocate the rigid-mode preflight data.");
    return false;
  }
  if (loads_.gravity_enabled && !(material_.density_kg_m3 > 0)) {
    diagnostic_ = make_error(ErrorCode::material_invalid,
                             "Gravity requires a positive material density.");
    return false;
  }
  if (!loads_.nodal_forces_n.empty() &&
      loads_.nodal_forces_n.size() != graph_.degree_of_freedom_count) {
    diagnostic_ = make_error(
        ErrorCode::invalid_argument,
        "The nodal load buffer must contain one value per degree of freedom.");
    return false;
  }
  if (!std::all_of(loads_.nodal_forces_n.begin(), loads_.nodal_forces_n.end(),
                   [](double value) { return std::isfinite(value); }) ||
      !std::all_of(loads_.gravity_m_s2.begin(), loads_.gravity_m_s2.end(),
                   [](double value) { return std::isfinite(value); })) {
    diagnostic_ =
        make_error(ErrorCode::invalid_argument,
                   "Loads and gravity must contain only finite values.");
    return false;
  }
  for (const auto &load : loads_.surface_loads) {
    if (load.triangle_connectivity.empty() ||
        load.triangle_connectivity.size() % 3) {
      diagnostic_ =
          make_error(ErrorCode::invalid_argument,
                     "A surface load has incomplete triangle connectivity.");
      return false;
    }
    for (auto n : load.triangle_connectivity)
      if (n >= mesh_.node_positions_m.size() / 3) {
        diagnostic_ = make_error(ErrorCode::mesh_invalid_index,
                                 "A surface load references a missing node.");
        return false;
      }
    if ((load.type == SurfaceLoadType::pressure &&
         !std::isfinite(load.pressure_pa)) ||
        (load.type == SurfaceLoadType::total_force &&
         !std::all_of(load.total_force_n.begin(), load.total_force_n.end(),
                      [](double value) { return std::isfinite(value); }))) {
      diagnostic_ =
          make_error(ErrorCode::invalid_argument,
                     "Surface loads must contain only finite values.");
      return false;
    }
  }
  memory_estimate_ =
      estimate_memory(mesh_, graph_, device_gib, cap, multiplier);
  if (memory_estimate_.exceeds_wasm_cap) {
    diagnostic_ = make_error(
        ErrorCode::memory_limit_exceeded,
        "The estimated solve peak exceeds the configured WebAssembly heap cap.",
        "Use a coarser mesh before solving.");
    return false;
  }
  diagnostic_ = {};
  return true;
}

bool Context::solve(const SolveSettings &settings) {
  const double hint = memory_estimate_.device_memory_gib_hint;
  const auto cap = memory_estimate_.wasm_heap_cap_bytes
                       ? memory_estimate_.wasm_heap_cap_bytes
                       : kDefaultWasmHeapCapBytes;
  const double multiplier = memory_estimate_.safety_multiplier >= 1
                                ? memory_estimate_.safety_multiplier
                                : kDefaultMemorySafetyMultiplier;
  if (!preflight(hint, cap, multiplier))
    return false;
  results_ = {};
  CsrMatrix matrix;
  try {
    matrix.values.assign(graph_.column_indices.size(), 0.0);
    matrix.graph = std::move(graph_);
    graph_valid_ = false;
    auto restore_graph = [&]() {
      graph_ = std::move(matrix.graph);
      graph_valid_ = true;
    };
    const auto dofs = matrix.graph.degree_of_freedom_count;
    std::vector<double> external(dofs, 0.0);
    if (!loads_.nodal_forces_n.empty())
      external = loads_.nodal_forces_n;
    const auto d = isotropic_constitutive_matrix(material_);
    Diagnostic local;
    for (std::size_t e = 0; e < mesh_.tet4_connectivity.size(); e += 4) {
      if ((e / 4) % 256 == 0 && settings.is_cancelled &&
          settings.is_cancelled()) {
        restore_graph();
        diagnostic_ = make_error(ErrorCode::cancelled,
                                 "The solve was cancelled during assembly.");
        return false;
      }
      Tet4Data data;
      if (!build_tet4_data(element_coordinates(mesh_, e), data, local)) {
        restore_graph();
        diagnostic_ = local;
        return false;
      }
      const auto ke = tet4_stiffness(data, d);
      for (int a = 0; a < 4; ++a)
        for (int ca = 0; ca < 3; ++ca) {
          const auto row = mesh_.tet4_connectivity[e + a] * 3 + ca;
          for (int b = 0; b < 4; ++b)
            for (int cb = 0; cb < 3; ++cb) {
              const auto col = mesh_.tet4_connectivity[e + b] * 3 + cb,
                         pos = csr_position(matrix.graph, row, col);
              matrix.values[pos] += ke[(a * 3 + ca) * 12 + b * 3 + cb];
            }
        }
      if (loads_.gravity_enabled)
        add_element_vector(external, mesh_.tet4_connectivity, e,
                           tet4_body_force(data.volume_m3,
                                           material_.density_kg_m3,
                                           loads_.gravity_m_s2));
    }
    for (const auto &load : loads_.surface_loads) {
      double total_area = 0;
      if (load.type == SurfaceLoadType::total_force)
        for (std::size_t t = 0; t < load.triangle_connectivity.size(); t += 3)
          total_area += triangle_area(
              triangle_coordinates(mesh_, load.triangle_connectivity, t));
      for (std::size_t t = 0; t < load.triangle_connectivity.size(); t += 3) {
        if ((t / 3) % 1024 == 0 && settings.is_cancelled &&
            settings.is_cancelled()) {
          restore_graph();
          diagnostic_ = make_error(
              ErrorCode::cancelled,
              "The solve was cancelled during surface-load integration.");
          return false;
        }
        const auto x =
            triangle_coordinates(mesh_, load.triangle_connectivity, t);
        const auto f = load.type == SurfaceLoadType::pressure
                           ? triangle_pressure_force(x, load.pressure_pa, local)
                           : triangle_total_force(x, total_area,
                                                  load.total_force_n, local);
        if (local.code != ErrorCode::none) {
          restore_graph();
          diagnostic_ = local;
          return false;
        }
        for (int n = 0; n < 3; ++n)
          for (int a = 0; a < 3; ++a)
            external[load.triangle_connectivity[t + n] * 3 + a] += f[n * 3 + a];
      }
    }
    std::vector<double> rhs = external;
    if (!apply_symmetric_constraints(matrix, rhs, constraints_, diagnostic_)) {
      restore_graph();
      return false;
    }
    std::vector<double> u;
    const auto solver = solve_pcg(matrix, rhs, u, settings, diagnostic_);
    solver_diagnostics_ = solver;
    if (!solver.converged) {
      restore_graph();
      return false;
    }
    Results result;
    result.solver = solver;
    result.displacement_m = std::move(u);
    result.displacement_magnitude_m.resize(mesh_.node_positions_m.size() / 3);
    result.reaction_n.assign(dofs, 0.0);
    const auto elements = mesh_.tet4_connectivity.size() / 4;
    result.element_strain.resize(elements * 6);
    result.element_stress_pa.resize(elements * 6);
    result.element_von_mises_pa.resize(elements);
    result.element_max_principal_pa.resize(elements);
    result.element_min_principal_pa.resize(elements);
    std::vector<double> internal(dofs, 0.0);
    result.raw_von_mises_max.value = -std::numeric_limits<double>::infinity();
    result.raw_max_principal.value = -std::numeric_limits<double>::infinity();
    result.raw_min_principal.value = std::numeric_limits<double>::infinity();
    for (std::size_t e = 0; e < mesh_.tet4_connectivity.size(); e += 4) {
      if ((e / 4) % 256 == 0 && settings.is_cancelled &&
          settings.is_cancelled()) {
        restore_graph();
        diagnostic_ =
            make_error(ErrorCode::cancelled,
                       "The solve was cancelled during stress recovery.");
        return false;
      }
      Tet4Data data;
      build_tet4_data(element_coordinates(mesh_, e), data, local);
      std::array<double, 12> ue{}, fe{};
      for (int n = 0; n < 4; ++n)
        for (int a = 0; a < 3; ++a)
          ue[n * 3 + a] =
              result.displacement_m[mesh_.tet4_connectivity[e + n] * 3 + a];
      const auto strain = tet4_strain(data, ue);
      const auto stress = stress_from_strain(d, strain);
      for (int i = 0; i < 12; ++i)
        for (int q = 0; q < 6; ++q)
          fe[i] += data.b[q * 12 + i] * stress[q] * data.volume_m3;
      add_element_vector(internal, mesh_.tet4_connectivity, e, fe);
      const auto principal = principal_stresses(stress);
      const auto vm = von_mises_stress(stress);
      const auto ei = e / 4;
      for (int i = 0; i < 6; ++i) {
        result.element_strain[ei * 6 + i] = strain[i];
        result.element_stress_pa[ei * 6 + i] = stress[i];
      }
      result.element_von_mises_pa[ei] = vm;
      result.element_max_principal_pa[ei] = principal[0];
      result.element_min_principal_pa[ei] = principal[2];
      if (vm > result.raw_von_mises_max.value)
        result.raw_von_mises_max = {vm, static_cast<std::uint32_t>(ei)};
      if (principal[0] > result.raw_max_principal.value)
        result.raw_max_principal = {principal[0],
                                    static_cast<std::uint32_t>(ei)};
      if (principal[2] < result.raw_min_principal.value)
        result.raw_min_principal = {principal[2],
                                    static_cast<std::uint32_t>(ei)};
      for (int i = 0; i < 12; ++i)
        result.strain_energy_j += 0.5 * ue[i] * fe[i];
    }
    std::vector<unsigned char> constrained(dofs, 0);
    for (const auto &c : constraints_)
      constrained[c.dof] = 1;
    double force_scale = 0;
    for (std::uint32_t i = 0; i < dofs; ++i) {
      result.total_applied_force_n[i % 3] += external[i];
      force_scale += std::abs(external[i]);
      if (constrained[i]) {
        result.reaction_n[i] = internal[i] - external[i];
        result.total_reaction_n[i % 3] += result.reaction_n[i];
        force_scale += std::abs(result.reaction_n[i]);
      }
    }
    double balance2 = 0;
    for (int a = 0; a < 3; ++a) {
      const double balance =
          result.total_applied_force_n[a] + result.total_reaction_n[a];
      balance2 += balance * balance;
    }
    result.force_balance_relative_residual =
        std::sqrt(balance2) /
        std::max(force_scale, std::numeric_limits<double>::min());
    for (std::size_t n = 0; n < result.displacement_magnitude_m.size(); ++n) {
      const double x = result.displacement_m[n * 3],
                   y = result.displacement_m[n * 3 + 1],
                   z = result.displacement_m[n * 3 + 2];
      result.displacement_magnitude_m[n] = std::sqrt(x * x + y * y + z * z);
    }
    restore_graph();
    if (!std::isfinite(result.force_balance_relative_residual) ||
        result.force_balance_relative_residual >
            settings.equilibrium_tolerance) {
      diagnostic_ = make_error(
          ErrorCode::equilibrium_check_failed,
          "The solved result failed the global force-balance check.");
      return false;
    }
    results_ = std::move(result);
    diagnostic_ = {};
    return true;
  } catch (const std::bad_alloc &) {
    if (graph_.row_pointers.empty() && !matrix.graph.row_pointers.empty())
      graph_ = std::move(matrix.graph);
    graph_valid_ = !graph_.row_pointers.empty();
    diagnostic_ =
        make_error(ErrorCode::memory_limit_exceeded,
                   "The solver could not allocate its modeled working memory.");
    return false;
  }
}
} // namespace spjutsim::fem
