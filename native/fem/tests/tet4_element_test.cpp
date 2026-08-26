#include "spjutsim/tet4.hpp"
#include "test_support.hpp"

#include <array>
#include <numeric>

using namespace spjutsim::fem;
int main() {
  const std::array<double, 12> x{0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1};
  Diagnostic d;
  Tet4Data e;
  require(build_tet4_data(x, e, d), "unit tetrahedron geometry failed");
  require(near(e.volume_m3, 1.0 / 6.0), "unit tetrahedron volume wrong");
  std::array<double, 12> rigid{2, -3, 4, 2, -3, 4, 2, -3, 4, 2, -3, 4};
  auto strain = tet4_strain(e, rigid);
  for (double v : strain)
    require(std::abs(v) < 1e-14, "rigid translation created strain");
  std::array<double, 12> rotation{};
  for (int n = 0; n < 4; ++n) {
    rotation[n * 3] = -x[n * 3 + 1];
    rotation[n * 3 + 1] = x[n * 3];
  }
  strain = tet4_strain(e, rotation);
  for (double v : strain)
    require(std::abs(v) < 1e-14, "rigid rotation created strain");
  std::array<double, 12> u{};
  for (int n = 0; n < 4; ++n) {
    const double px = x[n * 3], py = x[n * 3 + 1], pz = x[n * 3 + 2];
    u[n * 3] = 1 + 0.01 * px + 0.02 * py + 0.03 * pz;
    u[n * 3 + 1] = -2 - 0.01 * px + 0.04 * py + 0.05 * pz;
    u[n * 3 + 2] = 3 + 0.08 * px + 0.06 * py + 0.07 * pz;
  }
  strain = tet4_strain(e, u);
  const std::array<double, 6> expected{.01, .04, .07, .01, .11, .11};
  for (int i = 0; i < 6; ++i)
    require(near(strain[i], expected[i]), "constant strain patch failed");
  Material m{200e9, .3, 0};
  const auto constitutive = isotropic_constitutive_matrix(m);
  const auto stress = stress_from_strain(constitutive, strain);
  const auto k = tet4_stiffness(e, constitutive);
  for (int i = 0; i < 12; ++i)
    for (int j = 0; j < 12; ++j)
      require(near(k[i * 12 + j], k[j * 12 + i], 1e-13, 1e-4),
              "element stiffness is not symmetric");
  double energy = 0;
  for (int i = 0; i < 12; ++i)
    for (int j = 0; j < 12; ++j)
      energy += .5 * u[i] * k[i * 12 + j] * u[j];
  require(energy > 0, "non-rigid field did not have positive energy");
  require(von_mises_stress({100, 100, 100, 0, 0, 0}) < 1e-12,
          "hydrostatic stress has von Mises stress");
  auto principal = principal_stresses({12, -4, 7, 0, 0, 0});
  require(near(principal[0], 12) && near(principal[1], 7) &&
              near(principal[2], -4),
          "principal stresses wrong");
  principal = principal_stresses({0, 0, 0, 5, 0, 0});
  require(near(principal[0], 5) && near(principal[1], 0) &&
              near(principal[2], -5),
          "shear principal stresses wrong");
  std::array<double, 9> tri{0, 0, 0, 1, 0, 0, 0, 1, 0};
  auto pressure = triangle_pressure_force(tri, 12, d);
  require(d.code == ErrorCode::none, "pressure integration failed");
  require(near(pressure[2] + pressure[5] + pressure[8], -6),
          "pressure resultant not conserved");
  auto total = triangle_total_force(tri, .5, {2, 3, 4}, d);
  for (int a = 0; a < 3; ++a)
    require(near(total[a] + total[3 + a] + total[6 + a], 2 + a),
            "total face force not conserved");
  std::array<double, 9> large_tri{0, 0, 0, 2, 0, 0, 0, 2, 0};
  auto small_share = triangle_total_force(tri, 2.5, {10, 0, 0}, d);
  auto large_share = triangle_total_force(large_tri, 2.5, {10, 0, 0}, d);
  double integrated = 0;
  for (int n = 0; n < 3; ++n)
    integrated += small_share[n * 3] + large_share[n * 3];
  require(near(integrated, 10),
          "area-weighted total force was not conserved across unequal faces");
  require(near(large_share[0] / small_share[0], 4),
          "total force was not distributed by surface area");
  auto body = tet4_body_force(e.volume_m3, 24, {0, 0, -10});
  require(near(body[2] + body[5] + body[8] + body[11], -40),
          "body force not conserved");
  std::array<double, 12> inverted{0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1};
  require(!build_tet4_data(inverted, e, d) &&
              d.code == ErrorCode::mesh_invalid_jacobian,
          "inverted Tet4 accepted");
  (void)stress;
  return 0;
}
