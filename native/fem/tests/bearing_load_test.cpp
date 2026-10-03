#include "test_support.hpp"
#include "spjutsim/bearing_load.hpp"
using namespace spjutsim::fem;

int main() {
  for (unsigned count : {16u, 64u, 128u}) {
    for (int sign : {-1, 1}) {
      for (bool quadratic : {false, true}) {
        Mesh mesh;
        SurfaceLoad load;
        load.type = SurfaceLoadType::bearing;
        load.nodes_per_face = quadratic ? 6 : 3;
        load.cylinder_axis = {0, 0, 1};
        load.reference_m = {0, 0, .5};
        load.radius_m = .5;
        load.band_length_m = 1;
        load.total_force_n = {100 * std::cos(.31), 100 * std::sin(.31), 0};
        for (unsigned i = 0; i < count; ++i) {
          for (double z : {0., 1.}) {
            double angle = i * 2 * std::acos(-1.) / count;
            mesh.node_positions_m.insert(mesh.node_positions_m.end(),
                                         {.5 * std::cos(angle), .5 * std::sin(angle), z});
          }
        }
        for (unsigned i = 0; i < count; ++i) {
          auto a = i * 2, b = ((i + 1) % count) * 2;
          for (auto triangle : {std::array<unsigned, 3>{a, b, b + 1},
                                std::array<unsigned, 3>{a, b + 1, a + 1}}) {
            if (sign < 0) std::swap(triangle[1], triangle[2]);
            load.triangle_connectivity.insert(load.triangle_connectivity.end(),
                                              triangle.begin(), triangle.end());
            if (quadratic) {
              for (auto edge : {std::array<unsigned, 2>{0, 1}, {1, 2}, {2, 0}}) {
                Vector3 middle{};
                for (int k = 0; k < 3; ++k)
                  middle[k] = (mesh.node_positions_m[triangle[edge[0]] * 3 + k] +
                               mesh.node_positions_m[triangle[edge[1]] * 3 + k]) / 2;
                double radial = std::hypot(middle[0], middle[1]);
                middle[0] *= .5 / radial;
                middle[1] *= .5 / radial;
                load.triangle_connectivity.push_back(mesh.node_positions_m.size() / 3);
                mesh.node_positions_m.insert(mesh.node_positions_m.end(), middle.begin(), middle.end());
              }
            }
          }
        }
        const double c=std::cos(.37),s=std::sin(.37);
        auto rotate=[&](Vector3 v){return Vector3{v[0],c*v[1]-s*v[2],s*v[1]+c*v[2]};};
        for(unsigned n=0;n<mesh.node_positions_m.size();n+=3){
          auto position=rotate({mesh.node_positions_m[n],mesh.node_positions_m[n+1],mesh.node_positions_m[n+2]});
          for(int a=0;a<3;a++)mesh.node_positions_m[n+a]=position[a]+a+2;
        }
        load.reference_m=rotate(load.reference_m);
        for(int a=0;a<3;a++)load.reference_m[a]+=a+2;
        load.cylinder_axis=rotate(load.cylinder_axis);
        Diagnostic d;
        SurfaceResultants r;
        std::vector<double> f(mesh.node_positions_m.size());
        for (int reversal : {1, -1}) {
          load.total_force_n = rotate({reversal * 100 * std::cos(.31), reversal * 100 * std::sin(.31), 0});
          std::fill(f.begin(), f.end(), 0);
          require(integrate_bearing_load(mesh, load, &f, r, d), "bearing band: " + d.message);
          for (int a = 0; a < 3; ++a) {
            require(near(r.force_n[a], load.total_force_n[a], .005, 1e-10), "transverse force direction/resultant");
            require(std::abs(r.moment_nm[a]) < .005 * 100, "no spurious band-center torque");
          }
        }
        // Removing only the unloaded quarter keeps the same wrench. Native
        // validation must still reject the incomplete declared band.
        auto full_band = load.triangle_connectivity;
        load.triangle_connectivity.clear();
        auto direction = rotate({-100 * std::cos(.31), -100 * std::sin(.31), 0});
        for (std::size_t t=0;t<full_band.size();t+=load.nodes_per_face) {
          Vector3 a{},b{},c{};
          for (int k=0;k<3;k++) {
            a[k]=mesh.node_positions_m[full_band[t]*3+k];
            b[k]=mesh.node_positions_m[full_band[t+1]*3+k];
            c[k]=mesh.node_positions_m[full_band[t+2]*3+k];
          }
          auto normal=cross3(subtract3(b,a),subtract3(c,a));
          if(dot3(normal,direction)<.2*100*std::sqrt(dot3(normal,normal)))
            load.triangle_connectivity.insert(load.triangle_connectivity.end(),
              full_band.begin()+t,full_band.begin()+t+load.nodes_per_face);
        }
        require(!integrate_bearing_load(mesh,load,nullptr,r,d),
                "native bearing accepted a band missing unloaded faces");
        load.triangle_connectivity=full_band;
        load.moment_nm={1,0,0};
        require(!integrate_bearing_load(mesh,load,nullptr,r,d),"bearing load silently accepted an independent moment");
        load.moment_nm={0,0,0};
        auto valid_axis = load.cylinder_axis;
        load.cylinder_axis = {0, 0, std::numeric_limits<double>::quiet_NaN()};
        require(!integrate_bearing_load(mesh, load, nullptr, r, d), "nonfinite cylinder axis rejected");
        load.cylinder_axis = valid_axis;
        load.total_force_n = rotate({0, 0, 100});
        require(!integrate_bearing_load(mesh, load, nullptr, r, d), "axial bearing force rejected");
      }
    }
  }
}
