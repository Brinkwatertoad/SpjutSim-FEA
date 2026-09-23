#include "test_support.hpp"
#include "spjutsim/constraint_basis.hpp"
#include <map>
#include <chrono>
#include <iomanip>
using namespace spjutsim::fem;
namespace {
struct Fixture { Mesh mesh; std::vector<std::uint32_t> face; };
Fixture bar(bool half, bool quadratic) {
  Fixture f; const int layers=half?2:3;
  auto node=[](int x,int y,int z){return static_cast<std::uint32_t>(y*4+z*2+x);};
  for(int y=0;y<layers;y++)for(int z=0;z<2;z++)for(int x=0;x<2;x++) {
    f.mesh.node_positions_m.insert(f.mesh.node_positions_m.end(),{double(x),double(y)*.5-(half?0:.5),double(z)});
  }
  const int local[6][4]={{0,1,3,7},{0,3,2,7},{0,2,6,7},{0,6,4,7},{0,4,5,7},{0,5,1,7}};
  for(int y=0;y<layers-1;y++) {
    const std::uint32_t v[]={node(0,y,0),node(1,y,0),node(0,y+1,0),node(1,y+1,0),node(0,y,1),node(1,y,1),node(0,y+1,1),node(1,y+1,1)};
    for(const auto &tet:local)for(int a:tet)f.mesh.tet4_connectivity.push_back(v[a]);
    f.face.insert(f.face.end(),{v[1],v[3],v[7],v[1],v[7],v[5]});
  }
  if(!quadratic)return f;
  std::map<std::pair<std::uint32_t,std::uint32_t>,std::uint32_t> edges;
  auto mid=[&](std::uint32_t a,std::uint32_t b){
    auto key=std::minmax(a,b);auto found=edges.find(key);if(found!=edges.end())return found->second;
    auto n=static_cast<std::uint32_t>(f.mesh.node_positions_m.size()/3);edges[key]=n;
    for(int i=0;i<3;i++)f.mesh.node_positions_m.push_back((f.mesh.node_positions_m[a*3+i]+f.mesh.node_positions_m[b*3+i])*.5);
    return n;
  };
  std::vector<std::uint32_t> cells,faces;
  const int pairs[6][2]={{0,1},{1,2},{2,0},{0,3},{2,3},{3,1}};
  for(size_t e=0;e<f.mesh.tet4_connectivity.size();e+=4) {
    auto v=&f.mesh.tet4_connectivity[e];cells.insert(cells.end(),v,v+4);
    for(const auto &edge:pairs)cells.push_back(mid(v[edge[0]],v[edge[1]]));
  }
  for(size_t e=0;e<f.face.size();e+=3){auto v=&f.face[e];faces.insert(faces.end(),v,v+3);faces.insert(faces.end(),{mid(v[0],v[1]),mid(v[1],v[2]),mid(v[2],v[0])});}
  f.mesh.tet4_connectivity=std::move(cells);f.face=std::move(faces);f.mesh.element_type=ElementType::tet10;return f;
}
std::array<double,3> rotate(std::array<double,3> v) {
  const double c=std::cos(.63),s=std::sin(.63),d=std::cos(.41),t=std::sin(.41);
  return {c*v[0]-s*(d*v[1]-t*v[2]),s*v[0]+c*(d*v[1]-t*v[2]),t*v[1]+d*v[2]};
}
}
int main() {
  std::cout << std::setprecision(17);
  for(bool quadratic:{false,true})for(bool half:{false,true})for(bool rotated:{false,true}) {
    auto fixture=bar(half,quadratic);auto &mesh=fixture.mesh;std::vector<PrescribedDof> constraints;std::vector<double> expected;
    for(size_t n=0;n<mesh.node_positions_m.size();n+=3) {
      std::array<double,3> p{mesh.node_positions_m[n],mesh.node_positions_m[n+1],mesh.node_positions_m[n+2]};
      auto u=std::array<double,3>{1e-6*p[0],-.25e-6*p[1],-.25e-6*p[2]};
      for(int a=0;a<3;a++)if(p[a]==0){std::array<double,3> axis{};axis[a]=1;constraints.push_back({static_cast<std::uint32_t>(n+a),0,rotated?rotate(axis):std::array<double,3>{}});}
      if(rotated){p=rotate(p);u=rotate(u);}for(int a=0;a<3;a++){mesh.node_positions_m[n+a]=p[a];expected.push_back(u[a]);}
    }
    Context context;require(context.load_mesh(mesh)&&context.set_material({1e9,.25,0})&&context.set_constraints(constraints),"symmetry setup");
    Loads loads;SurfaceLoad load;load.type=SurfaceLoadType::pressure;load.pressure_pa=-1000;load.nodes_per_face=quadratic?6:3;load.triangle_connectivity=fixture.face;loads.surface_loads.push_back(load);
    require(context.set_loads(loads),"symmetry load");SolveSettings settings;settings.relative_tolerance=1e-11;
    require(context.solve(settings),"symmetry solve: "+context.last_diagnostic().message);
    auto &r=context.results();double error=0;for(size_t i=0;i<expected.size();i++)error=std::max(error,std::abs(r.displacement_m[i]-expected[i]));
    require(error<1e-13,"full/half rotated displacement mismatch");
    require(near(r.raw_von_mises_max.value,1000,1e-7,1e-5),"full/half stress mismatch");
    require(near(r.strain_energy_j,half?.00025:.0005,1e-7,1e-12),"explicit half loading energy mismatch");
    require(r.force_balance_relative_residual<1e-9,"full/half equilibrium");
    std::cout<<"{\"element\":\""<<(quadratic?"tet10":"tet4")<<"\",\"half\":"<<half<<",\"rotated\":"<<rotated<<",\"maxDisplacementErrorM\":"<<error<<",\"stressPa\":"<<r.raw_von_mises_max.value<<",\"energyJ\":"<<r.strain_energy_j<<",\"equilibrium\":"<<r.force_balance_relative_residual<<"}\n";
  }
  ConstraintBases bases;Diagnostic diagnostic;std::vector<PrescribedDof> global,local;
  for(unsigned n=0;n<100000;++n){global.push_back({n*3,0});local.push_back({n*3,0,rotate({1,0,0})});}
  auto start=std::chrono::steady_clock::now();require(build_constraint_bases(global,bases,diagnostic)&&bases.empty(),"global-only allocated bases");
  double global_ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();
  start=std::chrono::steady_clock::now();require(build_constraint_bases(local,bases,diagnostic)&&bases.size()==local.size(),"basis benchmark");
  double local_ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();
  std::cout<<"{\"basisNodes\":100000,\"basisPayloadBytesPerNode\":"<<sizeof(ConstraintBasis)<<",\"globalMs\":"<<global_ms<<",\"localMs\":"<<local_ms<<"}\n";
}
