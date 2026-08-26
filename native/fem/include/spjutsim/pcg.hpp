#pragma once
#include "spjutsim/sparse.hpp"
namespace spjutsim::fem {
bool apply_symmetric_constraints(CsrMatrix &, std::vector<double> &,
                                 const std::vector<PrescribedDof> &,
                                 Diagnostic &);
SolverDiagnostics solve_pcg(const CsrMatrix &, const std::vector<double> &,
                            std::vector<double> &, const SolveSettings &,
                            Diagnostic &);
} // namespace spjutsim::fem
