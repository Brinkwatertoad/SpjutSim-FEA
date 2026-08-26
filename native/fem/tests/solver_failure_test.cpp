#include "spjutsim/pcg.hpp"
#include "test_support.hpp"

using namespace spjutsim::fem;
int main() {
  Context under;
  require(under.load_mesh(cube_mesh()), "underconstraint mesh rejected");
  require(under.set_material({1e9, .25, 0}),
          "underconstraint material rejected");
  require(under.set_constraints({{0, 0}, {1, 0}, {2, 0}}),
          "basic constraints rejected");
  require(!under.preflight() &&
              under.last_diagnostic().code == ErrorCode::likely_rigid_body_mode,
          "underconstrained mesh reached allocation");
  Context conflict;
  require(conflict.load_mesh(cube_mesh()), "conflict mesh rejected");
  require(!conflict.set_constraints({{0, 0}, {0, 1}}) &&
              conflict.last_diagnostic().code == ErrorCode::constraint_conflict,
          "conflicting constraints accepted");
  auto malformed = cube_mesh();
  malformed.tet4_connectivity[0] = 99;
  Context bad;
  require(!bad.load_mesh(malformed) &&
              bad.last_diagnostic().code == ErrorCode::mesh_invalid_index,
          "missing-node connectivity accepted");
  malformed = cube_mesh();
  std::swap(malformed.tet4_connectivity[1], malformed.tet4_connectivity[2]);
  require(!bad.load_mesh(malformed) &&
              bad.last_diagnostic().code == ErrorCode::mesh_invalid_jacobian,
          "inverted element accepted");
  Context limited;
  configure_axial(limited);
  SolveSettings one;
  one.max_iterations = 1;
  one.relative_tolerance = 1e-14;
  require(!limited.solve(one) &&
              limited.last_diagnostic().code == ErrorCode::solver_not_converged,
          "iteration limit returned plausible result");
  require(limited.last_solver_diagnostics().iterations == 1 &&
              std::isfinite(
                  limited.last_solver_diagnostics().final_relative_residual) &&
              limited.last_solver_diagnostics().termination ==
                  TerminationReason::iteration_limit,
          "nonconvergence diagnostics omitted iterations or residual");
  Context cancelled;
  configure_axial(cancelled);
  SolveSettings cancel;
  cancel.is_cancelled = []() { return true; };
  require(!cancelled.solve(cancel) &&
              cancelled.last_diagnostic().code == ErrorCode::cancelled,
          "assembly cancellation ignored");
  Context nonfinite;
  configure_axial(nonfinite);
  auto invalid_loads = axial_loads();
  invalid_loads.nodal_forces_n.assign(24, 0);
  invalid_loads.nodal_forces_n[4] = std::numeric_limits<double>::quiet_NaN();
  require(nonfinite.set_loads(invalid_loads),
          "load staging unexpectedly failed");
  require(!nonfinite.preflight() &&
              nonfinite.last_diagnostic().code == ErrorCode::invalid_argument,
          "non-finite load passed preflight");
  Context overflow_material;
  require(overflow_material.load_mesh(cube_mesh()),
          "overflow material mesh rejected");
  require(!overflow_material.set_material(
              {std::numeric_limits<double>::max(), .49, 0}) &&
              overflow_material.last_diagnostic().code ==
                  ErrorCode::material_invalid,
          "non-finite constitutive response passed material validation");
  Context imbalance;
  configure_axial(imbalance);
  SolveSettings exact;
  exact.equilibrium_tolerance = 1e-30;
  require(!imbalance.solve(exact) && imbalance.last_diagnostic().code ==
                                         ErrorCode::equilibrium_check_failed,
          "equilibrium failure did not invalidate result");
  CsrMatrix nonspd;
  nonspd.graph.degree_of_freedom_count = 1;
  nonspd.graph.row_pointers = {0, 1};
  nonspd.graph.column_indices = {0};
  nonspd.values = {-1};
  std::vector<double> x;
  Diagnostic d;
  auto stats = solve_pcg(nonspd, {1}, x, {}, d);
  require(!stats.converged && d.code == ErrorCode::solver_non_spd,
          "non-SPD system was not diagnosed");
  return 0;
}
