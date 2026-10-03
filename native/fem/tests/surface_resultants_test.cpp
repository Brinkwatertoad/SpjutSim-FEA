#include "test_support.hpp"
#include "spjutsim/surface_resultants.hpp"
using namespace spjutsim::fem;
int main() {
  auto mesh=cube_mesh(); SurfaceLoad load;
  load.type=SurfaceLoadType::resultant;load.nodes_per_face=3;
  load.triangle_connectivity={1,3,7,1,7,5};
  load.total_force_n={0,0,0};load.moment_nm={10,0,0};load.reference_m={1,.5,.5};
  Diagnostic d; SurfaceResultants r;std::vector<double> f(24,0);
  require(integrate_resultant_load(mesh,load,&f,r,d),"pure couple: "+d.message);
  for(int a=0;a<3;a++){require(near(r.force_n[a],0,0,1e-12),"pure couple has zero force");require(near(r.moment_nm[a],a==0?10:0,1e-12,1e-12),"pure couple torque");}
  auto original=f;load.reference_m={10,-3,2};f.assign(24,0);
  require(integrate_resultant_load(mesh,load,&f,r,d),"translated reference");
  for(unsigned i=0;i<24;i++)require(near(f[i],original[i],1e-12,1e-12),"reference-point invariant pure couple");
  load.total_force_n={0,20,0};load.moment_nm={0,0,40};load.reference_m={-1,.5,.5};f.assign(24,0);
  require(integrate_resultant_load(mesh,load,&f,r,d),"offset force");
  require(near(r.force_n[1],20,1e-12) && near(r.moment_nm[2],40,1e-12),"offset wrench");
  original=f;load.reference_m={1,.5,.5};load.moment_nm={0,0,0};f.assign(24,0);
  require(integrate_resultant_load(mesh,load,&f,r,d),"shifted force reference");
  for(unsigned i=0;i<24;i++)require(near(f[i],original[i],1e-12,1e-12),"reference-point invariant force");
  const double c=std::cos(.4),s=std::sin(.4);
  auto rotate=[&](std::array<double,3> v){return std::array<double,3>{c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]};};
  for(unsigned n=0;n<24;n+=3){auto x=rotate({mesh.node_positions_m[n],mesh.node_positions_m[n+1],mesh.node_positions_m[n+2]});for(int a=0;a<3;a++)mesh.node_positions_m[n+a]=x[a]+(a+1)*2;}
  load.total_force_n=rotate(load.total_force_n);load.reference_m=rotate(load.reference_m);for(int a=0;a<3;a++)load.reference_m[a]+=(a+1)*2;f.assign(24,0);
  require(integrate_resultant_load(mesh,load,&f,r,d),"rigid transformation");
  for(unsigned n=0;n<24;n+=3){auto want=rotate({original[n],original[n+1],original[n+2]});for(int a=0;a<3;a++)require(near(f[n+a],want[a],1e-12,1e-12),"rotated nodal wrench");}
  auto quadratic=cube_mesh();SurfaceLoad qload;
  qload.type=SurfaceLoadType::resultant;qload.nodes_per_face=6;qload.moment_nm={10,2,-3};qload.reference_m={1,.5,.5};
  for(auto triangle:{std::array<unsigned,3>{1,3,7},std::array<unsigned,3>{1,7,5}}){
    qload.triangle_connectivity.insert(qload.triangle_connectivity.end(),triangle.begin(),triangle.end());
    for(auto edge:{std::array<unsigned,2>{0,1},std::array<unsigned,2>{1,2},std::array<unsigned,2>{2,0}}){
      unsigned middle=quadratic.node_positions_m.size()/3;
      for(int a=0;a<3;a++)quadratic.node_positions_m.push_back((quadratic.node_positions_m[triangle[edge[0]]*3+a]+quadratic.node_positions_m[triangle[edge[1]]*3+a])/2);
      qload.triangle_connectivity.push_back(middle);
    }
  }
  std::vector<double> qforces(quadratic.node_positions_m.size());
  require(integrate_resultant_load(quadratic,qload,&qforces,r,d),"Tri6 couple integration");
  for(int a=0;a<3;a++)require(near(r.moment_nm[a],qload.moment_nm[a],1e-12),"Tri6 realized moment");
  auto disconnected=cube_mesh();SurfaceLoad patches=qload;patches.nodes_per_face=3;patches.triangle_connectivity={1,3,7,0,6,4};
  require(integrate_resultant_load(disconnected,patches,nullptr,r,d),"disconnected patches");
  for(int a=0;a<3;a++)require(near(r.force_n[a],0,0,1e-12)&&near(r.moment_nm[a],patches.moment_nm[a],1e-12),"disconnected pure couple");
  Context context;configure_axial(context);Loads applied;SurfaceLoad couple;
  require(context.preflight(),"resultant diagnostic memory baseline");auto result_memory_baseline=context.memory_estimate().modeled_peak_bytes;
  couple.type=SurfaceLoadType::resultant;couple.triangle_connectivity={1,3,7,1,7,5};couple.moment_nm={10,0,0};couple.reference_m={1,.5,.5};applied.surface_loads={couple};
  require(context.set_loads(applied) && context.preflight(),"native couple preflight");
  require(context.memory_estimate().modeled_peak_bytes>=result_memory_baseline+6*sizeof(double),"preflight omitted realized resultant storage");
  require(context.solve(),"native couple solve");
  require(context.results().strain_energy_j>1e-12,"couple must produce nonzero deformation energy");
  Context memory;configure_axial(memory);require(memory.preflight(),"surface input memory baseline");auto baseline=memory.memory_estimate().modeled_peak_bytes;
  auto many=axial_loads();auto face=many.surface_loads[0].triangle_connectivity;for(int i=0;i<100;i++)many.surface_loads[0].triangle_connectivity.insert(many.surface_loads[0].triangle_connectivity.end(),face.begin(),face.end());
  require(memory.set_loads(many) && memory.preflight(),"expanded surface input preflight");
  require(memory.memory_estimate().modeled_peak_bytes>=baseline+100*face.size()*sizeof(unsigned),"preflight omitted surface-load connectivity storage");
  load.triangle_connectivity={1,1,1};require(!integrate_resultant_load(mesh,load,nullptr,r,d),"degenerate selection must fail");
}
