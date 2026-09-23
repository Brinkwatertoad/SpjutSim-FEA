#pragma once
#include "spjutsim/sparse.hpp"
#include <map>
namespace spjutsim::fem {
// Columns are global directions of the nodal coordinate basis.
struct ConstraintBasis {
  std::array<std::array<double,3>,3> axes{};
  std::array<double,3> values{};
  unsigned rank = 0;
};
using ConstraintBases = std::map<std::uint32_t, ConstraintBasis>;
std::array<double,3> constraint_direction(const PrescribedDof &);
bool build_constraint_bases(const std::vector<PrescribedDof> &, ConstraintBases &, Diagnostic &);
void transform_constraint_system(CsrMatrix &, std::vector<double> &, const ConstraintBases &);
void restore_global_displacement(std::vector<double> &, const ConstraintBases &);
}
