#include "spjutsim/pcg.hpp"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>

namespace spjutsim::fem {
namespace {
double dot(const std::vector<double> &a, const std::vector<double> &b) {
  double s = 0;
  for (std::size_t i = 0; i < a.size(); ++i)
    s += a[i] * b[i];
  return s;
}
bool finite_vector(const std::vector<double> &a) {
  return std::all_of(a.begin(), a.end(),
                     [](double v) { return std::isfinite(v); });
}
} // namespace

bool apply_symmetric_constraints(CsrMatrix &matrix, std::vector<double> &rhs,
                                 const std::vector<PrescribedDof> &constraints,
                                 Diagnostic &diagnostic) {
  const auto n = matrix.graph.degree_of_freedom_count;
  if (rhs.size() != n ||
      matrix.values.size() != matrix.graph.column_indices.size()) {
    diagnostic = {ErrorCode::invalid_argument,
                  "The assembled linear system is inconsistent.",
                  {},
                  false};
    return false;
  }
  std::vector<double> prescribed(n, std::numeric_limits<double>::quiet_NaN());
  for (const auto &c : constraints) {
    if (c.dof >= n || !std::isfinite(c.value_m)) {
      diagnostic = {ErrorCode::invalid_argument,
                    "A prescribed displacement is invalid.",
                    {},
                    true};
      return false;
    }
    if (std::isfinite(prescribed[c.dof]) && prescribed[c.dof] != c.value_m) {
      diagnostic = {ErrorCode::constraint_conflict,
                    "Two supports prescribe different values on the same "
                    "degree of freedom.",
                    {},
                    true};
      return false;
    }
    prescribed[c.dof] = c.value_m;
  }
  for (std::uint32_t row = 0; row < n; ++row)
    for (std::uint32_t p = matrix.graph.row_pointers[row];
         p < matrix.graph.row_pointers[row + 1]; ++p) {
      const auto col = matrix.graph.column_indices[p];
      if (!std::isfinite(prescribed[row]) && std::isfinite(prescribed[col]))
        rhs[row] -= matrix.values[p] * prescribed[col];
    }
  for (std::uint32_t row = 0; row < n; ++row)
    for (std::uint32_t p = matrix.graph.row_pointers[row];
         p < matrix.graph.row_pointers[row + 1]; ++p) {
      const auto col = matrix.graph.column_indices[p];
      if (std::isfinite(prescribed[row]) || std::isfinite(prescribed[col]))
        matrix.values[p] =
            (row == col && std::isfinite(prescribed[row])) ? 1.0 : 0.0;
    }
  for (const auto &c : constraints)
    rhs[c.dof] = c.value_m;
  diagnostic = {};
  return true;
}

static SolverDiagnostics solve_pcg_impl(const CsrMatrix &a,
                                        const std::vector<double> &b,
                                        std::vector<double> &x,
                                        const SolveSettings &settings,
                                        Diagnostic &diagnostic) {
  SolverDiagnostics stats;
  const auto n = a.graph.degree_of_freedom_count;
  if (n == 0 || b.size() != n || !(settings.relative_tolerance > 0) ||
      !std::isfinite(settings.relative_tolerance)) {
    diagnostic = {ErrorCode::invalid_argument,
                  "PCG settings or system dimensions are invalid.",
                  {},
                  true};
    return stats;
  }
  x.assign(n, 0.0);
  std::vector<double> r = b, z(n), p(n), ap, diag(n);
  const double bnorm = std::sqrt(dot(b, b));
  const double reference = std::max(bnorm, std::numeric_limits<double>::min());
  for (std::uint32_t i = 0; i < n; ++i) {
    const auto pos = csr_position(a.graph, i, i);
    if (pos == std::numeric_limits<std::uint32_t>::max()) {
      diagnostic = {ErrorCode::solver_non_spd,
                    "The stiffness matrix has no diagonal entry.",
                    {},
                    true};
      stats.termination = TerminationReason::non_spd;
      return stats;
    }
    diag[i] = a.values[pos];
    if (!(diag[i] > 0) || !std::isfinite(diag[i])) {
      diagnostic = {
          ErrorCode::solver_non_spd,
          "The Jacobi preconditioner found a non-positive stiffness diagonal.",
          "The model may be underconstrained or ill-conditioned.", true};
      stats.termination = TerminationReason::non_spd;
      return stats;
    }
    z[i] = r[i] / diag[i];
    p[i] = z[i];
  }
  double rz = dot(r, z), residual = std::sqrt(dot(r, r)) / reference;
  stats.final_relative_residual = residual;
  if (!std::isfinite(rz) || !std::isfinite(residual)) {
    diagnostic = {ErrorCode::solver_non_finite,
                  "The solver produced a non-finite initial residual.",
                  {},
                  true};
    stats.termination = TerminationReason::non_finite;
    return stats;
  }
  if (residual <= settings.relative_tolerance) {
    stats.converged = true;
    stats.termination = TerminationReason::converged;
    diagnostic = {};
    return stats;
  }
  const std::uint32_t max_iter =
      settings.max_iterations
          ? settings.max_iterations
          : std::max<std::uint32_t>(
                1000, n > std::numeric_limits<std::uint32_t>::max() / 10
                          ? std::numeric_limits<std::uint32_t>::max()
                          : 10 * n);
  double best = residual;
  std::uint32_t stagnant = 0;
  const auto check =
      std::max<std::uint32_t>(1, settings.cancellation_check_interval);
  for (std::uint32_t iter = 1; iter <= max_iter; ++iter) {
    if (iter % check == 0 && settings.is_cancelled && settings.is_cancelled()) {
      stats.iterations = iter - 1;
      stats.termination = TerminationReason::cancelled;
      diagnostic = {ErrorCode::cancelled, "The solve was cancelled.", {}, true};
      return stats;
    }
    csr_multiply(a, p, ap);
    const double curvature = dot(p, ap);
    if (!(curvature > 0) || !std::isfinite(curvature)) {
      stats.iterations = iter - 1;
      stats.termination = std::isfinite(curvature)
                              ? TerminationReason::non_spd
                              : TerminationReason::non_finite;
      diagnostic = {
          std::isfinite(curvature) ? ErrorCode::solver_non_spd
                                   : ErrorCode::solver_non_finite,
          "PCG detected behavior inconsistent with a finite SPD stiffness "
          "matrix.",
          "Check constraints, element quality, conditioning, and assembly.",
          true};
      return stats;
    }
    const double alpha = rz / curvature;
    for (std::uint32_t i = 0; i < n; ++i) {
      x[i] += alpha * p[i];
      r[i] -= alpha * ap[i];
    }
    residual = std::sqrt(dot(r, r)) / reference;
    stats.iterations = iter;
    stats.final_relative_residual = residual;
    if (!std::isfinite(residual) || !finite_vector(x)) {
      stats.termination = TerminationReason::non_finite;
      diagnostic = {ErrorCode::solver_non_finite,
                    "The solver produced non-finite values.",
                    {},
                    true};
      return stats;
    }
    if (residual <= settings.relative_tolerance) {
      // Confirm convergence with a fresh residual instead of trusting only the
      // recursively updated PCG residual, which can drift after many
      // iterations.
      csr_multiply(a, x, ap);
      for (std::uint32_t i = 0; i < n; ++i)
        r[i] = b[i] - ap[i];
      residual = std::sqrt(dot(r, r)) / reference;
      stats.final_relative_residual = residual;
      if (!std::isfinite(residual)) {
        stats.termination = TerminationReason::non_finite;
        diagnostic = {ErrorCode::solver_non_finite,
                      "The recomputed solver residual is non-finite.",
                      {},
                      true};
        return stats;
      }
      if (residual <= settings.relative_tolerance) {
        stats.converged = true;
        stats.termination = TerminationReason::converged;
        diagnostic = {};
        return stats;
      }
      for (std::uint32_t i = 0; i < n; ++i) {
        z[i] = r[i] / diag[i];
        p[i] = z[i];
      }
      rz = dot(r, z);
      best = std::min(best, residual);
      stagnant = 0;
      continue;
    }
    if (residual < best * (1.0 - 1e-6)) {
      best = residual;
      stagnant = 0;
    } else if (++stagnant >= 100) {
      stats.termination = TerminationReason::stagnated;
      diagnostic = {ErrorCode::solver_stagnated,
                    "The solver residual stagnated before convergence.",
                    {},
                    true};
      return stats;
    }
    for (std::uint32_t i = 0; i < n; ++i)
      z[i] = r[i] / diag[i];
    const double next_rz = dot(r, z);
    if (!std::isfinite(next_rz)) {
      stats.termination = TerminationReason::non_finite;
      diagnostic = {ErrorCode::solver_non_finite,
                    "The preconditioned residual became non-finite.",
                    {},
                    true};
      return stats;
    }
    const double beta = next_rz / rz;
    for (std::uint32_t i = 0; i < n; ++i)
      p[i] = z[i] + beta * p[i];
    rz = next_rz;
  }
  stats.termination = TerminationReason::iteration_limit;
  diagnostic = {ErrorCode::solver_not_converged,
                "The solver reached its iteration limit before convergence.",
                {},
                true};
  return stats;
}

SolverDiagnostics solve_pcg(const CsrMatrix &a, const std::vector<double> &b,
                            std::vector<double> &x,
                            const SolveSettings &settings,
                            Diagnostic &diagnostic) {
  const auto started = std::chrono::steady_clock::now();
  auto stats = solve_pcg_impl(a, b, x, settings, diagnostic);
  stats.duration_ms = std::chrono::duration<double, std::milli>(
                          std::chrono::steady_clock::now() - started)
                          .count();
  return stats;
}
} // namespace spjutsim::fem
