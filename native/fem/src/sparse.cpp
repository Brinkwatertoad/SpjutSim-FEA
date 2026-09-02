#include "spjutsim/sparse.hpp"

#include <algorithm>
#include <cmath>
#include <limits>

namespace spjutsim::fem {
namespace {
constexpr std::uint64_t kGiB = 1073741824ULL;
constexpr std::uint64_t kRuntimeOverhead = 64ULL * 1024ULL * 1024ULL;

bool mul_add(std::uint64_t a, std::uint64_t b, std::uint64_t c,
             std::uint64_t &out) {
  if (a != 0 && b > (std::numeric_limits<std::uint64_t>::max() - c) / a)
    return false;
  out = a * b + c;
  return true;
}
} // namespace

bool checked_scalar_graph_counts(std::uint64_t nodes, std::uint64_t edges,
                                 std::uint64_t &dofs, std::uint64_t &nnz,
                                 Diagnostic &diagnostic) {
  if (!mul_add(nodes, 3, 0, dofs) ||
      dofs > std::numeric_limits<std::uint32_t>::max() ||
      !mul_add(edges, 18, nodes * 9, nnz) ||
      nnz > std::numeric_limits<std::uint32_t>::max()) {
    diagnostic = {
        ErrorCode::graph_index_overflow,
        "The mesh sparsity graph exceeds the supported 32-bit solver index "
        "range.",
        "DOF and CSR nonzero counts must fit uint32_t before allocation.",
        true};
    return false;
  }
  diagnostic = {};
  return true;
}

bool build_csr_graph(std::uint32_t node_count,
                     const std::vector<std::uint32_t> &connectivity,
                     std::uint32_t arity,
                     CsrGraph &out, Diagnostic &diagnostic) {
  if (node_count == 0 || (arity != 4 && arity != 10) ||
      connectivity.empty() || connectivity.size() % arity != 0) {
    diagnostic = {ErrorCode::invalid_argument,
                  "Tetrahedral connectivity is empty or incomplete.",
                  {},
                  true};
    return false;
  }
  std::uint64_t preliminary_dofs = 0, preliminary_nnz = 0;
  if (!checked_scalar_graph_counts(node_count, 0, preliminary_dofs,
                                   preliminary_nnz, diagnostic))
    return false;
  (void)preliminary_dofs;
  (void)preliminary_nnz;
  std::vector<std::uint32_t> adjacency_reservations(node_count, 0);
  for (std::size_t e = 0; e < connectivity.size(); e += arity)
    for (std::uint32_t a = 0; a < arity; ++a) {
      if (connectivity[e + a] >= node_count) {
        diagnostic = {ErrorCode::mesh_invalid_index,
                      "The mesh references a missing node.",
                      {},
                      true};
        return false;
      }
      if (adjacency_reservations[connectivity[e + a]] >
          std::numeric_limits<std::uint32_t>::max() - (arity - 1)) {
        diagnostic = {ErrorCode::graph_index_overflow,
                      "The node adjacency count exceeds the supported range.",
                      {},
                      true};
        return false;
      }
      adjacency_reservations[connectivity[e + a]] += arity - 1;
    }
  std::vector<std::vector<std::uint32_t>> adjacency(node_count);
  for (std::uint32_t node = 0; node < node_count; ++node)
    adjacency[node].reserve(adjacency_reservations[node]);
  for (std::size_t e = 0; e < connectivity.size(); e += arity) {
    for (std::uint32_t a = 0; a < arity; ++a) {
      const auto na = connectivity[e + a];
      if (na >= node_count) {
        diagnostic = {ErrorCode::mesh_invalid_index,
                      "The mesh references a missing node.",
                      {},
                      true};
        return false;
      }
      for (std::uint32_t b = a + 1; b < arity; ++b) {
        const auto nb = connectivity[e + b];
        if (nb >= node_count) {
          diagnostic = {ErrorCode::mesh_invalid_index,
                        "The mesh references a missing node.",
                        {},
                        true};
          return false;
        }
        if (na == nb) {
          diagnostic = {ErrorCode::mesh_invalid_jacobian,
                        "A tetrahedral element repeats a node index.",
                        {},
                        true};
          return false;
        }
        adjacency[na].push_back(nb);
        adjacency[nb].push_back(na);
      }
    }
  }
  std::uint64_t directed_edges = 0;
  for (auto &row : adjacency) {
    std::sort(row.begin(), row.end());
    row.erase(std::unique(row.begin(), row.end()), row.end());
    directed_edges += row.size();
  }
  adjacency_reservations.clear();
  adjacency_reservations.shrink_to_fit();
  if (directed_edges % 2 != 0) {
    diagnostic = {ErrorCode::invalid_argument,
                  "The mesh adjacency graph is inconsistent.",
                  {},
                  false};
    return false;
  }
  const std::uint64_t edge_count = directed_edges / 2;
  std::uint64_t dofs = 0, nnz = 0;
  if (!checked_scalar_graph_counts(node_count, edge_count, dofs, nnz,
                                   diagnostic))
    return false;

  CsrGraph graph;
  graph.degree_of_freedom_count = static_cast<std::uint32_t>(dofs);
  graph.adjacency_edge_count = edge_count;
  graph.row_pointers.resize(static_cast<std::size_t>(dofs) + 1);
  graph.column_indices.reserve(static_cast<std::size_t>(nnz));
  for (std::uint32_t node = 0; node < node_count; ++node) {
    std::vector<std::uint32_t> coupled = adjacency[node];
    coupled.push_back(node);
    std::sort(coupled.begin(), coupled.end());
    for (std::uint32_t component = 0; component < 3; ++component) {
      const auto row = node * 3 + component;
      graph.row_pointers[row] =
          static_cast<std::uint32_t>(graph.column_indices.size());
      for (const auto other : coupled)
        for (std::uint32_t other_component = 0; other_component < 3;
             ++other_component)
          graph.column_indices.push_back(other * 3 + other_component);
    }
  }
  graph.row_pointers[dofs] =
      static_cast<std::uint32_t>(graph.column_indices.size());
  if (graph.column_indices.size() != nnz) {
    diagnostic = {ErrorCode::invalid_argument,
                  "The CSR graph count is inconsistent.",
                  {},
                  false};
    return false;
  }
  out = std::move(graph);
  diagnostic = {};
  return true;
}

std::uint32_t csr_position(const CsrGraph &graph, std::uint32_t row,
                           std::uint32_t column) {
  if (row >= graph.degree_of_freedom_count)
    return std::numeric_limits<std::uint32_t>::max();
  const auto begin = graph.column_indices.begin() + graph.row_pointers[row];
  const auto end = graph.column_indices.begin() + graph.row_pointers[row + 1];
  const auto found = std::lower_bound(begin, end, column);
  return found != end && *found == column
             ? static_cast<std::uint32_t>(found - graph.column_indices.begin())
             : std::numeric_limits<std::uint32_t>::max();
}

void csr_multiply(const CsrMatrix &matrix, const std::vector<double> &x,
                  std::vector<double> &out) {
  const auto n = matrix.graph.degree_of_freedom_count;
  out.assign(n, 0.0);
  for (std::uint32_t row = 0; row < n; ++row)
    for (std::uint32_t p = matrix.graph.row_pointers[row];
         p < matrix.graph.row_pointers[row + 1]; ++p)
      out[row] += matrix.values[p] * x[matrix.graph.column_indices[p]];
}

MemoryEstimate estimate_memory(const Mesh &mesh, const CsrGraph &graph,
                               double device_gib, std::uint64_t cap,
                               double multiplier) {
  MemoryEstimate e;
  e.node_count = mesh.node_positions_m.size() / 3;
  const auto arity = nodes_per_element(mesh);
  e.element_count = mesh.tet4_connectivity.size() / arity;
  e.degree_of_freedom_count = graph.degree_of_freedom_count;
  e.adjacency_edge_count = graph.adjacency_edge_count;
  e.exact_nnz = graph.column_indices.size();
  e.safety_multiplier = multiplier;
  e.wasm_heap_cap_bytes = cap;
  e.device_memory_gib_hint = device_gib;
  e.mesh_storage_bytes = mesh.node_positions_m.size() * sizeof(double) +
                         mesh.tet4_connectivity.size() * sizeof(std::uint32_t);
  e.matrix_values_bytes = e.exact_nnz * sizeof(double);
  e.matrix_index_bytes = e.exact_nnz * sizeof(std::uint32_t);
  e.row_pointer_bytes = (e.degree_of_freedom_count + 1) * sizeof(std::uint32_t);
  // The graph builder reserves arity - 1 neighbors per node occurrence
  // before sorting duplicate connectivity edges away.
  e.graph_bytes = (arity * (arity - 1) * e.element_count) *
                      sizeof(std::uint32_t) +
                  e.node_count * sizeof(std::vector<std::uint32_t>);
  const auto local_dofs = arity * 3;
  e.assembly_work_bytes =
      (local_dofs * local_dofs + 6 * local_dofs + local_dofs) *
      sizeof(double);
  // external/RHS plus PCG solution, r, z, p, Ap, and Jacobi diagonal.
  e.solver_work_bytes = 8 * e.degree_of_freedom_count * sizeof(double);
  // u, reactions, nodal magnitudes, element averages, and raw recovery data.
  const auto samples_per_element = arity == 10 ? 4 : 1;
  e.result_bytes =
      (2 * e.degree_of_freedom_count + e.node_count + 15 * e.element_count +
       15 * samples_per_element * e.element_count) *
      sizeof(double);
  e.runtime_overhead_bytes = kRuntimeOverhead;
  const auto sparse_structure =
      e.mesh_storage_bytes + e.matrix_index_bytes + e.row_pointer_bytes;
  const auto graph_phase = sparse_structure + e.graph_bytes;
  const auto solve_base = sparse_structure + e.matrix_values_bytes;
  const auto assembly_phase = solve_base + e.assembly_work_bytes +
                              2 * e.degree_of_freedom_count * sizeof(double);
  const auto pcg_phase = solve_base + e.solver_work_bytes;
  const auto postprocess_phase = solve_base + e.result_bytes +
                                 3 * e.degree_of_freedom_count * sizeof(double);
  e.modeled_peak_bytes =
      std::max({graph_phase, assembly_phase, pcg_phase, postprocess_phase}) +
      e.runtime_overhead_bytes;
  if (!(multiplier >= 1.0) || !std::isfinite(multiplier) ||
      static_cast<long double>(e.modeled_peak_bytes) * multiplier >
          static_cast<long double>(std::numeric_limits<std::uint64_t>::max()))
    e.estimated_peak_bytes = std::numeric_limits<std::uint64_t>::max();
  else
    e.estimated_peak_bytes = static_cast<std::uint64_t>(
        std::ceil(e.modeled_peak_bytes * multiplier));
  e.exceeds_wasm_cap = cap == 0 || e.estimated_peak_bytes > cap;
  e.requires_eight_gib_confirmation = e.estimated_peak_bytes >= kEightGiB;
  if (e.exceeds_wasm_cap)
    e.classification = MemoryClassification::likely_insufficient;
  else if (device_gib > 0.0 && std::isfinite(device_gib)) {
    const double ratio =
        e.estimated_peak_bytes / (device_gib * static_cast<double>(kGiB));
    e.classification = ratio > 0.5
                           ? MemoryClassification::likely_insufficient
                           : (ratio > 0.25 || e.estimated_peak_bytes >= 4 * kGiB
                                  ? MemoryClassification::caution
                                  : MemoryClassification::likely_safe);
  } else
    e.classification = e.estimated_peak_bytes >= 2 * kGiB
                           ? MemoryClassification::caution
                           : MemoryClassification::likely_safe;
  return e;
}
} // namespace spjutsim::fem
