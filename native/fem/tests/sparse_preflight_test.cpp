#include "spjutsim/sparse.hpp"
#include "test_support.hpp"

#include <limits>

using namespace spjutsim::fem;
int main() {
  Diagnostic d;
  CsrGraph a, b;
  auto mesh = cube_mesh();
  require(build_csr_graph(8, mesh.tet4_connectivity, 4, a, d),
          "cube graph failed");
  require(build_csr_graph(8, mesh.tet4_connectivity, 4, b, d),
          "repeated cube graph failed");
  require(a.row_pointers == b.row_pointers &&
              a.column_indices == b.column_indices,
          "graph construction is not deterministic");
  require(a.column_indices.size() == 9 * 8 + 18 * a.adjacency_edge_count,
          "exact scalar nnz formula mismatch");
  for (std::uint32_t row = 0; row < a.degree_of_freedom_count; ++row)
    require(std::is_sorted(a.column_indices.begin() + a.row_pointers[row],
                           a.column_indices.begin() + a.row_pointers[row + 1]),
            "CSR columns not sorted");
  std::uint64_t dofs = 0, nnz = 0;
  require(!checked_scalar_graph_counts(
              std::numeric_limits<std::uint32_t>::max(), 0, dofs, nnz, d) &&
              d.code == ErrorCode::graph_index_overflow,
          "DOF overflow was not rejected");
  require(!checked_scalar_graph_counts(
              1, std::numeric_limits<std::uint32_t>::max(), dofs, nnz, d) &&
              d.code == ErrorCode::graph_index_overflow,
          "nnz overflow was not rejected");
  auto estimate = estimate_memory(mesh, a, 8.0, kDefaultWasmHeapCapBytes, 1.5);
  require(estimate.degree_of_freedom_count == 24 &&
              estimate.exact_nnz == a.column_indices.size(),
          "preflight topology counts wrong");
  require(estimate.matrix_values_bytes ==
              a.column_indices.size() * sizeof(double),
          "matrix value allocation estimate drifted");
  require(estimate.matrix_index_bytes ==
              a.column_indices.size() * sizeof(std::uint32_t),
          "matrix index allocation estimate drifted");
  require(estimate.row_pointer_bytes ==
              a.row_pointers.size() * sizeof(std::uint32_t),
          "row pointer allocation estimate drifted");
  require(estimate.modeled_peak_bytes > estimate.matrix_values_bytes &&
              estimate.estimated_peak_bytes >= estimate.modeled_peak_bytes,
          "peak model omitted allocations or safety factor");
  require(estimate.classification == MemoryClassification::likely_safe,
          "tiny graph was not classified safe");
  auto capped = estimate_memory(mesh, a, 0.0, 1024, 1.5);
  require(capped.exceeds_wasm_cap &&
              capped.classification ==
                  MemoryClassification::likely_insufficient,
          "WASM cap did not gate estimate");
  auto eight = estimate_memory(
      mesh, a, 0.0, std::numeric_limits<std::uint64_t>::max(), 200.0);
  require(eight.requires_eight_gib_confirmation,
          "8 GiB confirmation state missing");
  return 0;
}
