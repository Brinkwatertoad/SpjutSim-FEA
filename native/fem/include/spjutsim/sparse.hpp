#pragma once
#include "spjutsim/fem_types.hpp"
namespace spjutsim::fem {
struct CsrGraph {
  std::uint32_t degree_of_freedom_count = 0;
  std::uint64_t adjacency_edge_count = 0;
  std::vector<std::uint32_t> row_pointers, column_indices;
};
struct CsrMatrix {
  CsrGraph graph;
  std::vector<double> values;
};
bool checked_scalar_graph_counts(std::uint64_t, std::uint64_t, std::uint64_t &,
                                 std::uint64_t &, Diagnostic &);
bool build_csr_graph(std::uint32_t, const std::vector<std::uint32_t> &,
                     CsrGraph &, Diagnostic &);
std::uint32_t csr_position(const CsrGraph &, std::uint32_t, std::uint32_t);
void csr_multiply(const CsrMatrix &, const std::vector<double> &,
                  std::vector<double> &);
MemoryEstimate
estimate_memory(const Mesh &, const CsrGraph &,
                double device_memory_gib_hint = 0.0,
                std::uint64_t wasm_heap_cap_bytes = kDefaultWasmHeapCapBytes,
                double safety_multiplier = kDefaultMemorySafetyMultiplier);
} // namespace spjutsim::fem
